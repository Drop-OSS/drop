export function dropEncodeArray(secret: Uint8Array): string {
    const decoder = new TextDecoder('utf8');
    return btoa(decoder.decode(secret));
}
export function dropDecodeArray(secret: string): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(atob(secret));
}

export interface TOTPv1Credentials {
    secret: string,
}