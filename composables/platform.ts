import { Platform } from "~/prisma/client/enums";

export type PlatformRenderable = {
  name: string;
  param: string;
  platformIcon: { key: string; fallback?: string };
};

export function renderPlatforms(
  userPlatforms: { platformName: string; id: string; iconSvg: string }[],
): PlatformRenderable[] {
  return [
    ...Object.values(Platform).map((e) => ({
      name: e,
      param: e,
      platformIcon: { key: e },
    })),
    ...userPlatforms.map((e) => ({
      name: e.platformName,
      param: e.id,
      platformIcon: { key: e.id, fallback: e.iconSvg },
    })),
  ];
}
