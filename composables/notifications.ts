import type { Notification } from "@prisma/client";

const ws = new WebSocketHandler("/api/v1/notifications/ws");

export const useNotifications = () =>
  useState<Array<Notification>>("notifications", () => []);

ws.listen((e) => {
  const notification = JSON.parse(e) as Notification;
  const notifications = useNotifications();
  notifications.value.push(notification);
});
