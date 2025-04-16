/*
The notification system handles the recieving, creation and sending of notifications in Drop

Design goals:
1. Nonce-based notifications; notifications should only be created once
2. Real-time; use websocket listeners to keep clients up-to-date
*/

import type { Notification } from "@prisma/client";
import prisma from "../db/database";

export type NotificationCreateArgs = Pick<
  Notification,
  "title" | "description" | "actions" | "nonce"
>;

class NotificationSystem {
  private listeners = new Map<
    string,
    Map<string, (notification: Notification) => void>
  >();

  listen(
    userId: string,
    id: string,
    callback: (notification: Notification) => void,
  ) {
    this.listeners.set(userId, new Map());
    this.listeners.get(userId)?.set(id, callback);

    this.catchupListener(userId, id);
  }

  unlisten(userId: string, id: string) {
    this.listeners.get(userId)?.delete(id);
  }

  private async catchupListener(userId: string, id: string) {
    const callback = this.listeners.get(userId)?.get(id);
    if (!callback)
      throw new Error("Failed to catch-up listener: callback does not exist");
    const notifications = await prisma.notification.findMany({
      where: { userId: userId },
      orderBy: {
        created: "asc", // Oldest first, because they arrive in reverse order
      },
    });
    for (const notification of notifications) {
      await callback(notification);
    }
  }

  private async pushNotification(userId: string, notification: Notification) {
    for (const listener of this.listeners.get(userId) ?? []) {
      await listener[1](notification);
    }
  }

  async push(userId: string, notificationCreateArgs: NotificationCreateArgs) {
    const notification = await prisma.notification.create({
      data: {
        userId: userId,
        ...notificationCreateArgs,
      },
    });

    await this.pushNotification(userId, notification);
  }

  async pushAll(notificationCreateArgs: NotificationCreateArgs) {
    const users = await prisma.user.findMany({
      where: { id: { not: "system" } },
      select: {
        id: true,
      },
    });

    for (const user of users) {
      await this.push(user.id, notificationCreateArgs);
    }
  }

  async systemPush(notificationCreateArgs: NotificationCreateArgs) {
    return await this.push("system", notificationCreateArgs);
  }
}

export const notificationSystem = new NotificationSystem();
export default notificationSystem;
