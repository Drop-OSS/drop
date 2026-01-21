import type { SerializeObject } from "nitropack";
import type { SystemData } from "~/server/internal/system-data";

const ws = new WebSocketHandler("/api/v1/admin/system-data/ws");

export const useSystemData = () =>
  useState<SerializeObject<SystemData>>(
    "system-data",
    (): SystemData => ({
      totalRam: 0,
      freeRam: 0,
      cpuLoad: 0,
      cpuCores: 0,
    }),
  );

ws.listen((systemDataString) => {
  const data = JSON.parse(systemDataString) as SerializeObject<SystemData>;
  const systemData = useSystemData();
  systemData.value = data;
});
