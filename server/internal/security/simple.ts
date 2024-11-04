import bcrypt from 'bcryptjs';

const rounds = 10;

export async function createHash(password: string) {
    return bcrypt.hashSync(password, rounds);
}

export async function checkHash(password: string, hash: string) {
    return bcrypt.compareSync(password, hash);
}