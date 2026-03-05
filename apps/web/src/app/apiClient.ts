import {
  ListRoomAssetsResponseSchema,
  SetRoomMapRequestSchema,
  SetRoomMapResponseSchema,
  CreateRoomRequestSchema,
  CreateRoomResponseSchema,
  JoinRoomRequestSchema,
  JoinRoomResponseSchema,
  RoomStateResponseSchema,
  UploadAssetResponseSchema,
  type AssetType,
  type CreateRoomRequest,
  type CreateRoomResponse,
  type JoinRoomRequest,
  type JoinRoomResponse,
  type RoomAsset,
  type RoomStateResponse
} from '@dnd-vtt/shared';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type ApiErrorPayload = {
  code?: string;
  message?: string;
};

const parseApiError = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as ApiErrorPayload;

    if (payload.code && payload.message) {
      return `${payload.code}: ${payload.message}`;
    }

    if (payload.message) {
      return payload.message;
    }
  } catch {
    // Ignore JSON parse errors and fallback to status text.
  }

  return `${response.status} ${response.statusText}`;
};

const postJson = async <TRequest, TResponse>(args: {
  path: string;
  requestSchema: { parse: (value: unknown) => TRequest };
  responseSchema: { parse: (value: unknown) => TResponse };
  payload: TRequest;
  headers?: Record<string, string>;
}): Promise<TResponse> => {
  const requestBody = args.requestSchema.parse(args.payload);

  const response = await fetch(`${apiBaseUrl}${args.path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(args.headers ?? {})
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const body = (await response.json()) as unknown;
  return args.responseSchema.parse(body);
};

export const createRoom = async (payload: CreateRoomRequest): Promise<CreateRoomResponse> => {
  return postJson({
    path: '/rooms',
    requestSchema: CreateRoomRequestSchema,
    responseSchema: CreateRoomResponseSchema,
    payload
  });
};

export const joinRoom = async (payload: JoinRoomRequest): Promise<JoinRoomResponse> => {
  return postJson({
    path: '/rooms/join',
    requestSchema: JoinRoomRequestSchema,
    responseSchema: JoinRoomResponseSchema,
    payload
  });
};

export const fetchRoomState = async (roomId: string): Promise<RoomStateResponse> => {
  const response = await fetch(`${apiBaseUrl}/rooms/${roomId}/state`);

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const body = (await response.json()) as unknown;
  return RoomStateResponseSchema.parse(body);
};

export const buildAssetUrl = (assetId: string, clientId: string): string => {
  const encodedAssetId = encodeURIComponent(assetId);
  const encodedClientId = encodeURIComponent(clientId);
  return `${apiBaseUrl}/assets/${encodedAssetId}?clientId=${encodedClientId}`;
};

export const uploadMapAsset = async (args: {
  roomId: string;
  clientId: string;
  file: File;
}): Promise<RoomAsset> => {
  return uploadRoomAsset({
    roomId: args.roomId,
    clientId: args.clientId,
    file: args.file,
    type: 'MAP'
  });
};

export const uploadRoomAsset = async (args: {
  roomId: string;
  clientId: string;
  file: File;
  type: AssetType;
}): Promise<RoomAsset> => {
  const formData = new FormData();
  formData.append('roomId', args.roomId);
  formData.append('type', args.type);
  formData.append('file', args.file);

  const response = await fetch(`${apiBaseUrl}/assets/upload`, {
    method: 'POST',
    headers: {
      'x-client-id': args.clientId
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const body = (await response.json()) as unknown;
  return UploadAssetResponseSchema.parse(body).asset;
};

export const listRoomAssets = async (args: {
  roomId: string;
  clientId: string;
  type?: AssetType;
}): Promise<RoomAsset[]> => {
  const query = args.type ? `?type=${encodeURIComponent(args.type)}` : '';

  const response = await fetch(`${apiBaseUrl}/rooms/${args.roomId}/assets${query}`, {
    method: 'GET',
    headers: {
      'x-client-id': args.clientId
    }
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const body = (await response.json()) as unknown;
  return ListRoomAssetsResponseSchema.parse(body).assets;
};

export const setRoomMap = async (args: {
  roomId: string;
  assetId: string;
  clientId: string;
}) => {
  return postJson({
    path: `/rooms/${args.roomId}/map`,
    requestSchema: SetRoomMapRequestSchema,
    responseSchema: SetRoomMapResponseSchema,
    payload: {
      assetId: args.assetId
    },
    headers: {
      'x-client-id': args.clientId
    }
  });
};
