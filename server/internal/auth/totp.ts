export function dropEncodeArrayBase64(secret: Uint8Array): string {
  return encode(secret);
}
export function dropDecodeArrayBase64(secret: string): Uint8Array {
  return decode(secret);
}

const { fromCharCode } = String;
const encode = (uint8array: Uint8Array) => {
  const output = [];
  for (let i = 0, { length } = uint8array; i < length; i++)
    output.push(fromCharCode(uint8array[i]));
  return btoa(output.join(""));
};

const asCharCode = (c: string) => c.charCodeAt(0);

const decode = (chars: string) => Uint8Array.from(atob(chars), asCharCode);

export interface TOTPv1Credentials {
  secret: string;
}
