"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

const ADMIN_ROLES = new Set(["hq", "manager", "staff"]);

export type NotificationType = "new_reservation" | "cancellation";

export interface NotificationItem {
  id: number;
  type: NotificationType;
  message: string;
  reservationId: number;
  isRead: boolean;
  createdAt: string;
  storeId: number;
}

export async function listNotifications(storeId: number | null): Promise<NotificationItem[]> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  const notifications = await prisma.notification.findMany({
    where: storeId ? { storeId } : {},
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return notifications.map((n) => ({
    id: n.id,
    type: n.type,
    message: n.message,
    reservationId: n.reservationId,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
    storeId: n.storeId,
  }));
}

export async function getUnreadNotificationCount(storeId: number | null): Promise<number> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  return prisma.notification.count({
    where: storeId ? { isRead: false, storeId } : { isRead: false },
  });
}

export async function markNotificationAsRead(notificationId: number): Promise<void> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

export async function markAllNotificationsAsRead(storeId: number | null): Promise<void> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  await prisma.notification.updateMany({
    where: storeId ? { isRead: false, storeId } : { isRead: false },
    data: { isRead: true },
  });
}
