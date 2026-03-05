import fs from 'node:fs';
import fsp from 'node:fs/promises';

import '@fastify/multipart';
import { AssetIdSchema, AssetTypeSchema, UploadAssetResponseSchema } from '@dnd-vtt/shared';
import type { FastifyPluginAsync } from 'fastify';

import {
  AssetServiceError,
  AssetValidationError,
  createAssetForRoom,
  getAssetById,
  resolveAssetPath
} from '../assets/service.js';
import { LocalStrictAccessError } from '../rooms/localStrict.js';
import { getRoomMemberForClientId, getRoomStorageMode } from '../rooms/service.js';
import { emitRoomAssetCreated } from '../ws/room-events.js';

const resolveClientIdHeader = (headers: Record<string, unknown>): string | null => {
  const rawValue = headers['x-client-id'];

  if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
    return rawValue.trim();
  }

  if (Array.isArray(rawValue) && typeof rawValue[0] === 'string' && rawValue[0].trim().length > 0) {
    return rawValue[0].trim();
  }

  return null;
};

const resolveStringField = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (value && typeof value === 'object' && 'value' in value) {
    const fieldValue = (value as { value?: unknown }).value;

    if (typeof fieldValue === 'string' && fieldValue.trim().length > 0) {
      return fieldValue.trim();
    }
  }

  return null;
};

export const assetRoutes: FastifyPluginAsync = async (app) => {
  app.post('/assets/upload', async (request, reply) => {
    const clientId = resolveClientIdHeader(request.headers as Record<string, unknown>);

    if (!clientId) {
      return reply.status(400).send({
        code: 'CLIENT_ID_REQUIRED',
        message: 'x-client-id header is required'
      });
    }

    const filePart = await request.file();

    if (!filePart) {
      return reply.status(400).send({
        code: 'FILE_REQUIRED',
        message: 'No file uploaded'
      });
    }

    const roomId = resolveStringField((filePart.fields as Record<string, unknown>)['roomId']);
    const requestedType = resolveStringField((filePart.fields as Record<string, unknown>)['type']);

    if (!roomId || !requestedType) {
      return reply.status(400).send({
        code: 'INVALID_MULTIPART_FIELDS',
        message: 'roomId and type fields are required'
      });
    }

    const parsedType = AssetTypeSchema.safeParse(requestedType);

    if (!parsedType.success) {
      return reply.status(400).send({
        code: 'INVALID_ASSET_TYPE',
        message: parsedType.error.message
      });
    }

    if (parsedType.data !== 'MAP' && parsedType.data !== 'TOKEN_IMAGE') {
      return reply.status(400).send({
        code: 'UNSUPPORTED_ASSET_TYPE',
        message: 'Only MAP and TOKEN_IMAGE uploads are supported'
      });
    }

    const member = await getRoomMemberForClientId(roomId, clientId);

    if (!member) {
      return reply.status(403).send({
        code: 'FORBIDDEN',
        message: 'You are not a member of this room'
      });
    }

    const storageMode = await getRoomStorageMode(roomId);
    if (storageMode === 'LOCAL') {
      return reply.status(400).send({
        code: 'LOCAL_MODE_NO_SERVER_ASSETS',
        message: 'Asset upload endpoint is disabled for LOCAL rooms'
      });
    }

    try {
      const fileBuffer = await filePart.toBuffer();
      const uploadedAsset = await createAssetForRoom({
        roomId,
        ownerUserId: member.userId,
        type: parsedType.data,
        mime: filePart.mimetype,
        size: fileBuffer.byteLength,
        originalName: filePart.filename,
        fileBuffer
      });

      emitRoomAssetCreated({
        roomId,
        asset: uploadedAsset
      });

      return reply.status(201).send(
        UploadAssetResponseSchema.parse({
          asset: uploadedAsset
        })
      );
    } catch (error) {
      if (
        error instanceof AssetValidationError ||
        error instanceof AssetServiceError ||
        error instanceof LocalStrictAccessError
      ) {
        return reply.status(error.statusCode).send({
          code: error.code,
          message: error.message
        });
      }

      const candidateError = error as { code?: unknown; message?: unknown };

      if (
        candidateError &&
        candidateError.code === 'FST_REQ_FILE_TOO_LARGE' &&
        typeof candidateError.message === 'string'
      ) {
        return reply.status(413).send({
          code: 'FILE_TOO_LARGE',
          message: candidateError.message
        });
      }

      throw error;
    }
  });

  app.get('/assets/:id', async (request, reply) => {
    const params = request.params as { id?: unknown };
    const parsedAssetId = AssetIdSchema.safeParse(params.id);

    if (!parsedAssetId.success) {
      return reply.status(400).send({
        code: 'INVALID_ASSET_ID',
        message: parsedAssetId.error.message
      });
    }

    const query = request.query as { clientId?: unknown };
    const clientId = resolveStringField(query.clientId);

    if (!clientId) {
      return reply.status(400).send({
        code: 'CLIENT_ID_REQUIRED',
        message: 'clientId query parameter is required'
      });
    }

    try {
      const asset = await getAssetById(parsedAssetId.data);
      const member = await getRoomMemberForClientId(asset.roomId, clientId);

      if (!member) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'You are not allowed to access this asset'
        });
      }

      const storageMode = await getRoomStorageMode(asset.roomId);
      if (storageMode === 'LOCAL') {
        return reply.status(404).send({
          code: 'ASSET_NOT_AVAILABLE_IN_LOCAL_MODE',
          message: 'LOCAL rooms do not serve assets from server storage'
        });
      }

      const filePath = resolveAssetPath(asset.storageKey);

      await fsp.access(filePath);

      reply.header('Content-Length', asset.size.toString());
      reply.type(asset.mime);
      return reply.send(fs.createReadStream(filePath));
    } catch (error) {
      if (error instanceof AssetServiceError || error instanceof LocalStrictAccessError) {
        return reply.status(error.statusCode).send({
          code: error.code,
          message: error.message
        });
      }

      const candidateError = error as NodeJS.ErrnoException;

      if (candidateError.code === 'ENOENT') {
        return reply.status(404).send({
          code: 'ASSET_FILE_NOT_FOUND',
          message: 'Asset file does not exist on disk'
        });
      }

      throw error;
    }
  });
};
