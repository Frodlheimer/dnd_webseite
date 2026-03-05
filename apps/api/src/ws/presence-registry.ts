const roomOnlineUsers = new Map<string, Map<string, number>>();

const getOrCreateRoomBucket = (roomId: string): Map<string, number> => {
  const existing = roomOnlineUsers.get(roomId);
  if (existing) {
    return existing;
  }

  const created = new Map<string, number>();
  roomOnlineUsers.set(roomId, created);
  return created;
};

export const markRoomUserOnline = (roomId: string, userId: string): void => {
  const bucket = getOrCreateRoomBucket(roomId);
  const current = bucket.get(userId) ?? 0;
  bucket.set(userId, current + 1);
};

export const markRoomUserOffline = (roomId: string, userId: string): void => {
  const bucket = roomOnlineUsers.get(roomId);
  if (!bucket) {
    return;
  }

  const current = bucket.get(userId) ?? 0;
  if (current <= 1) {
    bucket.delete(userId);
  } else {
    bucket.set(userId, current - 1);
  }

  if (bucket.size === 0) {
    roomOnlineUsers.delete(roomId);
  }
};

export const isRoomUserOnline = (roomId: string, userId: string): boolean => {
  const bucket = roomOnlineUsers.get(roomId);
  if (!bucket) {
    return false;
  }

  return (bucket.get(userId) ?? 0) > 0;
};

export const listRoomOnlineUserIds = (roomId: string): string[] => {
  const bucket = roomOnlineUsers.get(roomId);
  if (!bucket) {
    return [];
  }

  return [...bucket.keys()];
};
