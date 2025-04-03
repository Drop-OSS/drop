import bcrypt from "bcryptjs";
import * as argon2 from "argon2";
import { type } from "arktype";

export async function checkHashBcrypt(password: string, hash: string) {
  return await bcrypt.compare(password, hash);
}

export async function createHashArgon2(password: string) {
  return await argon2.hash(password);
}

export async function checkHashArgon2(password: string, hash: string) {
  return await argon2.verify(hash, password);
}
