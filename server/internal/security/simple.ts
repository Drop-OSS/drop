import bcrypt from "bcryptjs";
import * as argon2 from "argon2";

// const bcryptRounds = 10;
// export async function createHashBcrypt(password: string) {
//   return await bcrypt.hash(password, bcryptRounds);
// }

export async function checkHashBcrypt(password: string, hash: string) {
  return await bcrypt.compare(password, hash);
}

export async function createHashArgon2(password: string) {
  return await argon2.hash(password);
}

export async function checkHashArgon2(password: string, hash: string) {
  return await argon2.verify(hash, password);
}
