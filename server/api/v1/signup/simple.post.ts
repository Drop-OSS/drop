import { AuthMec } from "@prisma/client";
import prisma from "~/server/internal/db/database";
import { createHash } from "~/server/internal/security/simple";

export default defineEventHandler(async (h3) => {
    const body = await readBody(h3);

    const username = body.username;
    const password = body.password;
    if (username === undefined || password === undefined)
        throw createError({ statusCode: 403, statusMessage: "Username or password missing from request." });

    const existing = await prisma.user.count({ where: { username: username } });
    if (existing > 0) throw createError({ statusCode: 400, statusMessage: "Username already taken." })

    const user = await prisma.user.create({
        data: {
            username,
        }
    });

    const hash = await createHash(password);
    const authMek = await prisma.linkedAuthMec.create({
        data: {
            mec: AuthMec.Simple,
            credentials: [username, hash],
            userId: user.id
        }
    });

    return user;
})