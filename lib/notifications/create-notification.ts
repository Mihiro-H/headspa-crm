import { prisma } from "@/lib/db";

export type NotificationType = "new_reservation" | "cancellation";

export interface CreateNotificationParams {
  storeId: number;
  type: NotificationType;
  message: string;
  reservationId: number;
}

export async function createNotification(params: CreateNotificationParams): Promise<void> {
  await prisma.notification.create({
    data: {
      storeId: params.storeId,
      type: params.type,
      message: params.message,
      reservationId: params.reservationId,
    },
  });
}
