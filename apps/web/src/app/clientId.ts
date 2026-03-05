const CLIENT_ID_STORAGE_KEY = 'dnd-vtt-client-id';

const createClientId = (): string => {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const getOrCreateClientId = (): string => {
  const existing = localStorage.getItem(CLIENT_ID_STORAGE_KEY);

  if (existing) {
    return existing;
  }

  const created = createClientId();
  localStorage.setItem(CLIENT_ID_STORAGE_KEY, created);
  return created;
};
