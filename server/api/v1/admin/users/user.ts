import prisma from "~/server/internal/db/database";
import { createHash } from "~/server/internal/security/simple";
import { v4 as uuidv4 } from "uuid";
import * as jdenticon from "jdenticon";

export default defineEventHandler(async (event) => {
  // Get admin user from session using the correct pattern
  const user = await event.context.session.getAdminUser(event);
  if (!user) {
    throw createError({
      statusCode: 403,
      statusMessage: "Unauthorized",
    });
  }

  if (event.method === "GET") {
    return await prisma.user.findMany({
      where: {
        id: {
          not: "system", // Exclude system user
        },
      },
      orderBy: {
        username: "asc",
      },
    });
  }

  if (event.method === "PATCH") {
    const body = await readBody(event);
    const { userId, admin } = body;

    if (userId === "system") {
      throw createError({
        statusCode: 400,
        statusMessage: "Cannot modify system user",
      });
    }

    if (userId === user.id) {
      throw createError({
        statusCode: 400,
        statusMessage: "Cannot modify your own admin status",
      });
    }

    // Check if this would remove the last admin
    if (!admin) {
      const adminCount = await prisma.user.count({
        where: { admin: true }
      });
      if (adminCount <= 1) {
        throw createError({
          statusCode: 400,
          statusMessage: "Cannot remove the last administrator",
        });
      }
    }

    return await prisma.user.update({
      where: { id: userId },
      data: { admin },
    });
  }

  if (event.method === "DELETE") {
    const body = await readBody(event);
    const { userId } = body;

    if (!userId) {
      throw createError({
        statusCode: 400,
        statusMessage: "User ID is required",
      });
    }

    if (userId === "system") {
      throw createError({
        statusCode: 400,
        statusMessage: "Cannot delete system user",
      });
    }

    if (userId === user.id) {
      throw createError({
        statusCode: 400,
        statusMessage: "Cannot delete your own account",
      });
    }

    try {
      // Check if this would delete the last user
      const userCount = await prisma.user.count();
      if (userCount <= 1) {
        throw createError({
          statusCode: 400,
          statusMessage: "Cannot delete the last user",
        });
      }

      // Check if this would delete the last admin
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { admin: true }
      });
      
      if (targetUser?.admin) {
        const adminCount = await prisma.user.count({
          where: { admin: true }
        });
        if (adminCount <= 1) {
          throw createError({
            statusCode: 400,
            statusMessage: "Cannot delete the last administrator",
          });
        }
      }

      // First delete all linked auth mechanisms
      await prisma.linkedAuthMec.deleteMany({
        where: { userId: userId },
      });

      // Then delete the user
      await prisma.user.delete({
        where: { id: userId },
      });

      return { success: true };
    } catch (error: any) {
      throw createError({
        statusCode: 500,
        statusMessage: error.statusMessage || `Failed to delete user: ${error.message}`,
      });
    }
  }

  if (event.method === "POST") {
    const body = await readBody(event);
    const { username, password, email, displayName } = body;

    // Validate required fields
    if (!username || !password || !email || !displayName) {
      throw createError({
        statusCode: 400,
        statusMessage: "All fields are required",
      });
    }

    // Check if username is already taken
    const existingUser = await prisma.user.findFirst({
      where: { username },
    });

    if (existingUser) {
      throw createError({
        statusCode: 400,
        statusMessage: "Username already exists",
      });
    }

    try {
      // Generate profile picture
      const profilePictureId = uuidv4();
      await event.context.objects.createFromSource(
        profilePictureId,
        async () => jdenticon.toPng(username, 256),
        {},
        [`anonymous:read`]
      );

      // Create the user
      const newUser = await prisma.user.create({
        data: {
          username,
          email,
          displayName,
          admin: false, // New users are not admins by default
          profilePicture: profilePictureId,
        },
      });


      // Create the simple auth mechanism
      await prisma.linkedAuthMec.create({
        data: {
          userId: newUser.id,
          mec: "Simple",
          credentials: [username, await createHash(password)],
        },
      });

      return newUser;
    } catch (error: any) {
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to create user: ${error.message}`,
      });
    }
  }

  throw createError({
    statusCode: 405,
    statusMessage: "Method not allowed",
  });
}); 
