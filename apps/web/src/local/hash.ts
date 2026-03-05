const toHex = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let result = '';
  for (const value of bytes) {
    result += value.toString(16).padStart(2, '0');
  }

  return result;
};

export const sha256Hex = async (input: Blob | ArrayBuffer): Promise<string> => {
  const arrayBuffer = input instanceof Blob ? await input.arrayBuffer() : input;
  const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return toHex(digest);
};
