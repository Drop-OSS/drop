import type { SerializeObject } from "nitropack";
import type { NotificationModel } from "~/prisma/client/models";

const ws = new WebSocketHandler("/api/v1/notifications/ws");

export const useNotifications = () =>
  useState<Array<SerializeObject<NotificationModel>>>(
    "notifications",
    () => [],
  );

ws.listen((e) => {
  const notification = JSON.parse(e) as SerializeObject<NotificationModel>;
  const notifications = useNotifications();
  notifications.value.push(notification);
});
