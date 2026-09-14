"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export type AutoDeliveryType = "birthday" | "reminder" | "confirmation";
export type ChannelMode = "email" | "line" | "auto";

const ADMIN_ROLES = new Set(["hq", "manager", "staff"]);

export interface AutoDeliverySettingItem {
  id: number;
  type: AutoDeliveryType;
  channelMode: ChannelMode;
  sendTiming: string;
  templateId: number;
  templateName: string;
  isActive: boolean;
}

export async function listAutoDeliverySettings(): Promise<AutoDeliverySettingItem[]> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  const settings = await prisma.autoDeliverySetting.findMany({
    include: { template: true },
    orderBy: { id: "asc" },
  });
  return settings.map((s) => ({
    id: s.id,
    type: s.type,
    channelMode: s.channelMode,
    sendTiming: s.sendTiming,
    templateId: s.templateId,
    templateName: s.template.name,
    isActive: s.isActive,
  }));
}

export interface UpsertAutoDeliverySettingParams {
  type: AutoDeliveryType;
  channelMode: ChannelMode;
  sendTiming: string;
  templateId: number;
  isActive: boolean;
}

export async function upsertAutoDeliverySetting(
  params: UpsertAutoDeliverySettingParams,
): Promise<void> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  const existing = await prisma.autoDeliverySetting.findFirst({ where: { type: params.type } });

  if (existing) {
    await prisma.autoDeliverySetting.update({
      where: { id: existing.id },
      data: {
        channelMode: params.channelMode,
        sendTiming: params.sendTiming,
        templateId: params.templateId,
        isActive: params.isActive,
      },
    });
  } else {
    await prisma.autoDeliverySetting.create({
      data: {
        type: params.type,
        channelMode: params.channelMode,
        sendTiming: params.sendTiming,
        templateId: params.templateId,
        isActive: params.isActive,
      },
    });
  }
}
