import type { NotificationModel } from "~/prisma/client/models";

const ws = new WebSocketHandler("/api/v1/notifications/ws");

export const useNotifications = () =>
  useState<Array<NotificationModel>>("notifications", () => []);

ws.listen((e) => {
  const notification = JSON.parse(e) as NotificationModel;
  const notifications = useNotifications();
  notifications.value.push(notification);
});
