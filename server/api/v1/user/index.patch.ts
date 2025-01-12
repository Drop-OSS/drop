import { defineEventHandler, readBody, createError } from "h3";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (event) => {
  // Get user from session
  const user = await event.context.session.getUser(event);
  if (!user) {
    throw createError({
      statusCode: 403,
      statusMessage: "Not authenticated",
    });
  }

  const body = await readBody(event);

  // Validate input
  if (typeof body.displayName !== 'string' || typeof body.email !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid input",
    });
  }

  // Update user
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      displayName: body.displayName,
      email: body.email,
    },
  });

  return updatedUser;
}); 
