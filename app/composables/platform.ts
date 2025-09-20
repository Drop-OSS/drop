import type { UserPlatform } from "~~/prisma/client/client";
import { HardwarePlatform } from "~~/prisma/client/enums";

export type PlatformRenderable = {
  name: string;
  param: string;
  platformIcon: { key: string; fallback?: string };
};

export function renderPlatforms(
  userPlatforms: { platformName: string; id: string; iconSvg: string }[],
): PlatformRenderable[] {
  return [
    ...Object.values(HardwarePlatform).map((e) => ({
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

const rawUseAdminPlatforms = () => useState<Array<UserPlatform> | null>('adminPlatforms', () => null);

export async function useAdminPlatforms() {
  const platforms = rawUseAdminPlatforms();
  if(platforms.value === null){
    platforms.value = await $dropFetch("/api/v1/admin/platforms");
  }

  return platforms.value!
}
