/*
The notification system handles the recieving, creation and sending of notifications in Drop

Design goals:
1. Nonce-based notifications; notifications should only be created once
2. Real-time; use websocket listeners to keep clients up-to-date
*/

import type { Notification } from "~/prisma/client";
import prisma from "../db/database";
import type { GlobalACL } from "../acls";

// type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

// TODO: document notification action format
export type NotificationCreateArgs = Pick<
  Notification,
  "title" | "description" | "actions" | "nonce"
> & { acls: Array<GlobalACL> };

class NotificationSystem {
  // userId to acl to listenerId
  private listeners = new Map<
    string,
    Map<
      string,
      { callback: (notification: Notification) => void; acls: GlobalACL[] }
    >
  >();

  listen(
    userId: string,
    acls: Array<GlobalACL>,
    id: string,
    callback: (notification: Notification) => void,
  ) {
    if (!this.listeners.has(userId)) this.listeners.set(userId, new Map());
    // eslint-disable-next-line @typescript-eslint/no-extra-non-null-assertion
    this.listeners.get(userId)!!.set(id, { callback, acls });

    this.catchupListener(userId, id);
  }

  unlisten(userId: string, id: string) {
    this.listeners.get(userId)?.delete(id);
  }

  private async catchupListener(userId: string, id: string) {
    const listener = this.listeners.get(userId)?.get(id);
    if (!listener)
      throw new Error("Failed to catch-up listener: callback does not exist");
    const notifications = await prisma.notification.findMany({
      where: { userId: userId, acls: { hasSome: listener.acls } },
      orderBy: {
        created: "asc", // Oldest first, because they arrive in reverse order
      },
    });
    for (const notification of notifications) {
      await listener.callback(notification);
    }
  }

  private async pushNotification(userId: string, notification: Notification) {
    for (const [_, listener] of this.listeners.get(userId) ?? []) {
      const hasSome =
        notification.acls.findIndex(
          (e) => listener.acls.findIndex((v) => v === e) != -1,
        ) != -1;
      if (hasSome) await listener.callback(notification);
    }
  }

  async push(userId: string, notificationCreateArgs: NotificationCreateArgs) {
    if (!notificationCreateArgs.nonce)
      throw new Error("No nonce in notificationCreateArgs");
    const notification = await prisma.notification.upsert({
      where: {
        userId_nonce: {
          nonce: notificationCreateArgs.nonce,
          userId,
        },
      },
      update: {
        // we don't need to update the userid right?
        // userId: userId,
        ...notificationCreateArgs,
      },
      create: {
        userId,
        ...notificationCreateArgs,
      },
    });

    await this.pushNotification(userId, notification);
  }

  /**
   * Internal call to batch push notifications to many users
   * @param notificationCreateArgs
   * @param users
   */
  private async _pushMany(
    notificationCreateArgs: NotificationCreateArgs,
    users: { id: string }[],
  ) {
    const res: Promise<void>[] = [];
    for (const user of users) {
      res.push(this.push(user.id, notificationCreateArgs));
    }
    // wait for all notifications to pass
    await Promise.all(res);
  }

  /**
   * Send a notification to all users
   * @param notificationCreateArgs
   */
  async pushAll(notificationCreateArgs: NotificationCreateArgs) {
    const users = await prisma.user.findMany({
      where: { id: { not: "system" } },
      select: {
        id: true,
      },
    });

    await this._pushMany(notificationCreateArgs, users);
  }

  /**
   * Send a notification to all system level users
   * @param notificationCreateArgs
   * @returns
   */
  async systemPush(notificationCreateArgs: NotificationCreateArgs) {
    const users = await prisma.user.findMany({
      where: {
        id: { not: "system" },
        // no reason to send to any users other then admins rn
        admin: true,
      },
      select: {
        id: true,
      },
    });

    await this._pushMany(notificationCreateArgs, users);
  }
}

export const notificationSystem = new NotificationSystem();
export default notificationSystem;
