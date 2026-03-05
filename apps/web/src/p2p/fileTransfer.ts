import { sha256Hex } from '../local/hash';

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  {
    urls: 'stun:stun.l.google.com:19302'
  }
];

const DATA_CHANNEL_LABEL = 'dnd-chat-file';
const DATA_CHUNK_BYTES = 64 * 1024;
const BUFFER_HIGH_WATERMARK = 1024 * 1024;

type TransferRole = 'sender' | 'receiver';

export type FileSignalKind = 'offer' | 'answer' | 'ice';

export type OutboundFileSignal = {
  toUserId: string;
  transferId: string;
  hash: string;
  kind: FileSignalKind;
  data: unknown;
};

export type FileTransferProgress = {
  transferId: string;
  hash: string;
  remoteUserId: string;
  direction: 'send' | 'receive';
  bytesTransferred: number;
  totalBytes: number;
  percent: number;
};

export type FileTransferComplete = {
  transferId: string;
  hash: string;
  remoteUserId: string;
  name: string;
  mime: string;
  size: number;
  blob: Blob;
};

type PendingSendMeta = {
  blob: Blob;
  name: string;
  mime: string;
  size: number;
};

type TransferState = {
  transferId: string;
  hash: string;
  remoteUserId: string;
  role: TransferRole;
  peer: RTCPeerConnection;
  channel: RTCDataChannel | null;
  meta: {
    name: string;
    mime: string;
    size: number;
  } | null;
  receivedParts: Uint8Array[];
  receivedBytes: number;
  pendingSend: PendingSendMeta | null;
  closed: boolean;
};

type FileTransferManagerOptions = {
  onSignal: (signal: OutboundFileSignal) => void;
  onProgress?: (progress: FileTransferProgress) => void;
  onComplete?: (payload: FileTransferComplete) => void;
  onError?: (payload: { transferId: string; hash: string; remoteUserId: string; message: string }) => void;
  rtcConfiguration?: RTCConfiguration;
};

const percentFromBytes = (bytesTransferred: number, totalBytes: number): number => {
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((bytesTransferred / totalBytes) * 100)));
};

const normalizeIceCandidate = (candidateLike: unknown): RTCIceCandidateInit | null => {
  if (!candidateLike || typeof candidateLike !== 'object') {
    return null;
  }

  const candidate = candidateLike as Partial<RTCIceCandidateInit>;
  if (!candidate.candidate || typeof candidate.candidate !== 'string') {
    return null;
  }

  const normalized: RTCIceCandidateInit = {
    candidate: candidate.candidate,
    sdpMid: typeof candidate.sdpMid === 'string' ? candidate.sdpMid : null,
    sdpMLineIndex: typeof candidate.sdpMLineIndex === 'number' ? candidate.sdpMLineIndex : null
  };

  if (typeof candidate.usernameFragment === 'string') {
    normalized.usernameFragment = candidate.usernameFragment;
  }

  return normalized;
};

const toUint8Array = async (value: Blob | ArrayBuffer | Uint8Array): Promise<Uint8Array> => {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  return new Uint8Array(await value.arrayBuffer());
};

const waitForDataChannelDrain = async (channel: RTCDataChannel): Promise<void> => {
  if (channel.bufferedAmount < BUFFER_HIGH_WATERMARK) {
    return;
  }

  await new Promise<void>((resolve) => {
    const onBufferedAmountLow = () => {
      channel.removeEventListener('bufferedamountlow', onBufferedAmountLow);
      resolve();
    };

    channel.bufferedAmountLowThreshold = BUFFER_HIGH_WATERMARK / 2;
    channel.addEventListener('bufferedamountlow', onBufferedAmountLow);
  });
};

export class FileTransferManager {
  private readonly options: FileTransferManagerOptions;
  private readonly transfers = new Map<string, TransferState>();

  constructor(options: FileTransferManagerOptions) {
    this.options = options;
  }

  async startSending(args: {
    transferId: string;
    hash: string;
    remoteUserId: string;
    blob: Blob;
    name: string;
    mime: string;
    size: number;
  }): Promise<void> {
    const transfer = this.createTransfer({
      transferId: args.transferId,
      hash: args.hash,
      remoteUserId: args.remoteUserId,
      role: 'sender'
    });

    transfer.pendingSend = {
      blob: args.blob,
      name: args.name,
      mime: args.mime,
      size: args.size
    };

    const channel = transfer.peer.createDataChannel(DATA_CHANNEL_LABEL, {
      ordered: true
    });
    this.attachDataChannel(transfer, channel);

    const offer = await transfer.peer.createOffer();
    await transfer.peer.setLocalDescription(offer);
    this.options.onSignal({
      toUserId: transfer.remoteUserId,
      transferId: transfer.transferId,
      hash: transfer.hash,
      kind: 'offer',
      data: offer
    });
  }

  async handleSignal(args: {
    fromUserId: string;
    transferId: string;
    hash: string;
    kind: FileSignalKind;
    data: unknown;
  }): Promise<void> {
    if (args.kind === 'offer') {
      const offer = args.data as RTCSessionDescriptionInit;
      const transfer = this.createTransfer({
        transferId: args.transferId,
        hash: args.hash,
        remoteUserId: args.fromUserId,
        role: 'receiver'
      });

      await transfer.peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await transfer.peer.createAnswer();
      await transfer.peer.setLocalDescription(answer);

      this.options.onSignal({
        toUserId: args.fromUserId,
        transferId: args.transferId,
        hash: args.hash,
        kind: 'answer',
        data: answer
      });
      return;
    }

    const transfer = this.transfers.get(args.transferId);
    if (!transfer || transfer.closed) {
      return;
    }

    if (args.kind === 'answer') {
      const answer = args.data as RTCSessionDescriptionInit;
      await transfer.peer.setRemoteDescription(new RTCSessionDescription(answer));
      return;
    }

    const candidate = normalizeIceCandidate(args.data);
    if (!candidate) {
      return;
    }

    await transfer.peer.addIceCandidate(new RTCIceCandidate(candidate));
  }

  cancelTransfer(transferId: string): void {
    const transfer = this.transfers.get(transferId);
    if (!transfer) {
      return;
    }

    this.closeTransfer(transfer, true);
  }

  dispose(): void {
    for (const transfer of this.transfers.values()) {
      this.closeTransfer(transfer, false);
    }
    this.transfers.clear();
  }

  private createTransfer(args: {
    transferId: string;
    hash: string;
    remoteUserId: string;
    role: TransferRole;
  }): TransferState {
    const existing = this.transfers.get(args.transferId);
    if (existing) {
      return existing;
    }

    const peer = new RTCPeerConnection(
      this.options.rtcConfiguration ?? {
        iceServers: DEFAULT_ICE_SERVERS
      }
    );

    const transfer: TransferState = {
      transferId: args.transferId,
      hash: args.hash,
      remoteUserId: args.remoteUserId,
      role: args.role,
      peer,
      channel: null,
      meta: null,
      receivedParts: [],
      receivedBytes: 0,
      pendingSend: null,
      closed: false
    };

    peer.onicecandidate = (event) => {
      if (!event.candidate || transfer.closed) {
        return;
      }

      this.options.onSignal({
        toUserId: transfer.remoteUserId,
        transferId: transfer.transferId,
        hash: transfer.hash,
        kind: 'ice',
        data: event.candidate.toJSON()
      });
    };

    peer.ondatachannel = (event) => {
      this.attachDataChannel(transfer, event.channel);
    };

    peer.onconnectionstatechange = () => {
      if (transfer.closed) {
        return;
      }

      if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
        this.emitError(transfer, `Peer connection ${peer.connectionState}`);
        this.closeTransfer(transfer, true);
      }
    };

    this.transfers.set(args.transferId, transfer);
    return transfer;
  }

  private attachDataChannel(transfer: TransferState, channel: RTCDataChannel): void {
    transfer.channel = channel;
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      if (transfer.closed || transfer.role !== 'sender' || !transfer.pendingSend) {
        return;
      }

      void this.sendPayload(transfer, transfer.pendingSend).catch((error) => {
        this.emitError(transfer, error instanceof Error ? error.message : String(error));
        this.closeTransfer(transfer, true);
      });
    };

    channel.onmessage = (event) => {
      if (transfer.closed) {
        return;
      }

      if (typeof event.data === 'string') {
        this.handleControlMessage(transfer, event.data);
        return;
      }

      void toUint8Array(event.data as Blob | ArrayBuffer | Uint8Array).then((chunk) => {
        if (transfer.closed) {
          return;
        }

        transfer.receivedParts.push(chunk);
        transfer.receivedBytes += chunk.byteLength;
        if (transfer.meta) {
          this.emitProgress(transfer, 'receive', transfer.receivedBytes, transfer.meta.size);
        }
      });
    };

    channel.onclose = () => {
      if (transfer.closed) {
        return;
      }

      if (transfer.role === 'receiver' && transfer.meta && transfer.receivedBytes < transfer.meta.size) {
        this.emitError(transfer, 'Data channel closed before transfer completion');
      }

      this.closeTransfer(transfer, true);
    };
  }

  private handleControlMessage(transfer: TransferState, message: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(message);
    } catch {
      return;
    }

    if (!parsed || typeof parsed !== 'object') {
      return;
    }

    const payload = parsed as { type?: string; name?: string; mime?: string; size?: number; hash?: string };

    if (payload.type === 'meta') {
      if (
        typeof payload.name !== 'string' ||
        typeof payload.mime !== 'string' ||
        typeof payload.size !== 'number' ||
        payload.size <= 0
      ) {
        this.emitError(transfer, 'Invalid transfer metadata');
        this.closeTransfer(transfer, true);
        return;
      }

      transfer.meta = {
        name: payload.name,
        mime: payload.mime,
        size: payload.size
      };
      this.emitProgress(transfer, 'receive', 0, payload.size);
      return;
    }

    if (payload.type === 'end') {
      void this.finishReceiveTransfer(transfer);
    }
  }

  private async sendPayload(transfer: TransferState, payload: PendingSendMeta): Promise<void> {
    const channel = transfer.channel;
    if (!channel || channel.readyState !== 'open') {
      throw new Error('Data channel is not open');
    }

    channel.send(
      JSON.stringify({
        type: 'meta',
        name: payload.name,
        mime: payload.mime,
        size: payload.size,
        hash: transfer.hash
      })
    );

    let offset = 0;
    while (offset < payload.size) {
      const chunk = payload.blob.slice(offset, offset + DATA_CHUNK_BYTES);
      const bytes = new Uint8Array(await chunk.arrayBuffer());
      channel.send(bytes);
      offset += bytes.byteLength;
      this.emitProgress(transfer, 'send', Math.min(offset, payload.size), payload.size);
      await waitForDataChannelDrain(channel);
    }

    channel.send(
      JSON.stringify({
        type: 'end'
      })
    );
  }

  private async finishReceiveTransfer(transfer: TransferState): Promise<void> {
    if (transfer.closed || !transfer.meta) {
      return;
    }

    const normalizedParts = transfer.receivedParts.map((part) => {
      const copy = new Uint8Array(part.byteLength);
      copy.set(part);
      return copy;
    });

    const blob = new Blob(normalizedParts, {
      type: transfer.meta.mime
    });
    const hash = await sha256Hex(blob);
    if (hash.toLowerCase() !== transfer.hash.toLowerCase()) {
      this.emitError(transfer, 'SHA-256 mismatch for received file');
      this.closeTransfer(transfer, true);
      return;
    }

    this.options.onComplete?.({
      transferId: transfer.transferId,
      hash: transfer.hash,
      remoteUserId: transfer.remoteUserId,
      name: transfer.meta.name,
      mime: transfer.meta.mime,
      size: transfer.meta.size,
      blob
    });
    this.emitProgress(transfer, 'receive', transfer.meta.size, transfer.meta.size);
    this.closeTransfer(transfer, true);
  }

  private emitProgress(
    transfer: TransferState,
    direction: 'send' | 'receive',
    bytesTransferred: number,
    totalBytes: number
  ): void {
    this.options.onProgress?.({
      transferId: transfer.transferId,
      hash: transfer.hash,
      remoteUserId: transfer.remoteUserId,
      direction,
      bytesTransferred,
      totalBytes,
      percent: percentFromBytes(bytesTransferred, totalBytes)
    });
  }

  private emitError(transfer: TransferState, message: string): void {
    this.options.onError?.({
      transferId: transfer.transferId,
      hash: transfer.hash,
      remoteUserId: transfer.remoteUserId,
      message
    });
  }

  private closeTransfer(transfer: TransferState, removeFromMap: boolean): void {
    if (transfer.closed) {
      if (removeFromMap) {
        this.transfers.delete(transfer.transferId);
      }
      return;
    }

    transfer.closed = true;
    transfer.channel?.close();
    transfer.peer.close();

    if (removeFromMap) {
      this.transfers.delete(transfer.transferId);
    }
  }
}
