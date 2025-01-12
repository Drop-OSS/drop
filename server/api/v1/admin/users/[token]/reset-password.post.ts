import { defineEventHandler, readBody, createError } from "h3";
import prisma from "~/server/internal/db/database";
import { createHash } from "~/server/internal/security/simple";
import { AuthMec } from "@prisma/client";

export default defineEventHandler(async (event) => {
  const token = event.context.params?.token;
  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing token",
    });
  }

  const body = await readBody(event);

  try {
    // Decode and validate token
    const [userId, timestamp] = atob(token).split(':');
    const tokenAge = Date.now() - parseInt(timestamp);

    // Check if token is expired (24 hours)
    if (tokenAge > 24 * 60 * 60 * 1000) {
      throw createError({
        statusCode: 400,
        statusMessage: "Reset link has expired",
      });
    }

    // Validate password
    if (!body.password || typeof body.password !== 'string' || body.password.length < 14) {
      throw createError({
        statusCode: 400,
        statusMessage: "Password must be at least 14 characters long",
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: "User not found",
      });
    }

    // Hash the new password
    const hash = await createHash(body.password);

    // Update the password in the auth mechanism
    await prisma.linkedAuthMec.updateMany({
      where: {
        userId: user.id,
        mec: AuthMec.Simple,
      },
      data: {
        credentials: [user.username, hash],
      },
    });

    return {
      success: true,
      message: "Password reset successfully",
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid reset link",
    });
  }
}); 
