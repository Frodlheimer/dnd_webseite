const UINT32_RANGE = 0x1_0000_0000;

export const randomUint32 = (): number => {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random generator is not available in this environment.');
  }

  const bytes = new Uint32Array(1);
  globalThis.crypto.getRandomValues(bytes);
  return bytes[0] ?? 0;
};

export const randomIntInclusive = (min: number, max: number): number => {
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    throw new Error('randomIntInclusive expects integer bounds.');
  }
  if (max < min) {
    throw new Error('randomIntInclusive expects max >= min.');
  }

  const range = max - min + 1;
  if (range <= 0 || range > UINT32_RANGE) {
    throw new Error('randomIntInclusive range is out of supported bounds.');
  }

  const bucketLimit = Math.floor(UINT32_RANGE / range) * range;
  let value = randomUint32();
  while (value >= bucketLimit) {
    value = randomUint32();
  }

  return min + (value % range);
};
