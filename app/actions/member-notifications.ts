"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export interface MemberNotificationItem {
  id: number;
  templateType: "birthday" | "reminder" | "segment";
  channel: "email" | "line";
  subject: string | null;
  sentAt: string;
}

export async function getMemberNotifications(): Promise<MemberNotificationItem[] | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "member") {
    return null;
  }
  const memberId = Number(session.user.id);

  const logs = await prisma.emailLineLog.findMany({
    where: { memberId, status: "success" },
    orderBy: { sentAt: "desc" },
  });

  return logs.map((log) => ({
    id: log.id,
    templateType: log.templateType,
    channel: log.channel,
    subject: log.subject,
    sentAt: log.sentAt.toISOString(),
  }));
}
