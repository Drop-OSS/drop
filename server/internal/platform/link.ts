import { HardwarePlatform } from "~/prisma/client/enums";
import prisma from "../db/database";
import type { PlatformLink } from "~/prisma/client/client";

export async function convertIDsToPlatforms(platformIDs: string[]) {
  const userPlatforms = await prisma.userPlatform.findMany({
    where: {
      id: {
        in: platformIDs,
      },
    },
  });

  const platforms = platformIDs.map(
    (e) => userPlatforms.find((v) => v.id === e) ?? (e as HardwarePlatform),
  );

  return platforms;
}

export async function convertIDToLink(
  id: string,
): Promise<PlatformLink | undefined> {
  const link = await prisma.platformLink.findUnique({
    where: { id },
  });
  if (link) return link;

  if (HardwarePlatform[id as HardwarePlatform]) {
    return await prisma.platformLink.create({
      data: {
        id,
      },
    });
  }

  const userPlatform = await prisma.userPlatform.findUnique({
    where: { id },
  });

  if (!userPlatform) return undefined;
  return await prisma.platformLink.create({
    data: {
      id,
    },
  });
}
