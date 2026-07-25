// base32 elements
//RFC4648: why include 2? Z and 2 looks similar than 8 and O
const b32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
console.assert(b32.length === 32, b32.length);
const b32r = new Map(Array.from(b32, (ch, i) => [ch, i])).set("=", 0);
//[constants derived from character table size]
//cbit = 5 (as 32 == 2 ** 5), ubit = 8 (as byte)
//ccount = 8 (= cbit / gcd(cbit, ubit)), ucount = 5 (= ubit / gcd(cbit, ubit))
//cmask = 0x1f (= 2 ** cbit - 1), umask = 0xff (= 2 ** ubit - 1)
//const b32pad = [0, 6, 4, 3, 1];
const b32pad = Array.from(
  new Array(5),
  (_, i) => Math.trunc(8 - (i * 8) / 5) % 8,
);

/**
 * Encodes up to five byte values as eight Base32 characters.
 * @param {number} u1 - The first byte value.
 * @param {number} [u2=0] - The second byte value.
 * @param {number} [u3=0] - The third byte value.
 * @param {number} [u4=0] - The fourth byte value.
 * @param {number} [u5=0] - The fifth byte value.
 * @return {string[]} The eight Base32 characters.
 */
function b32e5(u1, u2 = 0, u3 = 0, u4 = 0, u5 = 0) {
  const u40 = u1 * 2 ** 32 + u2 * 2 ** 24 + u3 * 2 ** 16 + u4 * 2 ** 8 + u5;
  return [
    b32[(u40 / 2 ** 35) & 0x1f],
    b32[(u40 / 2 ** 30) & 0x1f],
    b32[(u40 / 2 ** 25) & 0x1f],
    b32[(u40 / 2 ** 20) & 0x1f],
    b32[(u40 / 2 ** 15) & 0x1f],
    b32[(u40 / 2 ** 10) & 0x1f],
    b32[(u40 / 2 ** 5) & 0x1f],
    b32[u40 & 0x1f],
  ];
}
/**
 * Decode eight Base32 characters into five bytes.
 * @param {string[]} chars - The eight Base32 characters to decode.
 * @return {number[]} The five decoded byte values.
 */
function b32d8(chars) {
  const u40 =
    b32r.get(chars[0]) * 2 ** 35 +
    b32r.get(chars[1]) * 2 ** 30 +
    b32r.get(chars[2]) * 2 ** 25 +
    b32r.get(chars[3]) * 2 ** 20 +
    b32r.get(chars[4]) * 2 ** 15 +
    b32r.get(chars[5]) * 2 ** 10 +
    b32r.get(chars[6]) * 2 ** 5 +
    b32r.get(chars[7]);
  return [
    (u40 / 2 ** 32) & 0xff,
    (u40 / 2 ** 24) & 0xff,
    (u40 / 2 ** 16) & 0xff,
    (u40 / 2 ** 8) & 0xff,
    u40 & 0xff,
  ];
}

/**
 * Encodes a byte array as a padded RFC 4648 Base32 string.
 * @param {Uint8Array} u8a - The bytes to encode.
 * @return {string} The Base32-encoded string with `=` padding.
 */
export function b32e(u8a) {
  console.assert(u8a instanceof Uint8Array, u8a.constructor);
  const len = u8a.length,
    rem = len % 5;
  const u5s = Array.from(Array((len - rem) / 5), (_, i) =>
    u8a.subarray(i * 5, i * 5 + 5),
  );
  const pad = b32pad[rem];
  const br = rem === 0 ? [] : b32e5(...u8a.subarray(-rem)).slice(0, 8 - pad);
  return u5s
    .flatMap((u5) => b32e5(...u5))
    .concat(br, "=".repeat(pad))
    .join("");
}
/**
 * Decode a padded Base32 string into bytes.
 * @param {string} bs - The Base32-encoded string.
 * @return {Uint8Array} The decoded bytes.
 */
export function b32d(bs) {
  const len = bs.length;
  if (len === 0) return new Uint8Array([]);
  console.assert(len % 8 === 0, len);
  const pad = len - bs.indexOf("="),
    rem = b32pad.indexOf(pad);
  console.assert(rem >= 0, pad);
  console.assert(/^[A-Z2-7+/]*$/.test(bs.slice(0, len - pad)), bs);
  const u8s = bs.match(/.{8}/g).flatMap((b8) => b32d8(b8.split("")));
  return new Uint8Array(rem > 0 ? u8s.slice(0, rem - 5) : u8s);
}
