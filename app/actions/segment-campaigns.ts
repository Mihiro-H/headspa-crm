"use server";

import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { buildMemberWhereClause, type CustomerFilterCondition } from "@/lib/customer/filter";
import { renderTemplate } from "@/lib/delivery/render-template";
import { resolveMemberChannel } from "@/lib/delivery/resolve-channel";
import { sendEmail } from "@/lib/delivery/send-email";
import { sendLineMessage } from "@/lib/delivery/send-line";

export type SegmentChannelMode = "email" | "line" | "auto";
export type SegmentCondition = CustomerFilterCondition;

export interface CreateSegmentCampaignParams {
  name: string;
  condition: SegmentCondition;
  channelMode: SegmentChannelMode;
  templateId: number;
  scheduledAt: string | null;
}

export type CreateSegmentCampaignResult =
  | { status: "unauthorized" }
  | { status: "scheduled"; campaignId: number; targetCount: number }
  | {
      status: "sent";
      campaignId: number;
      targetCount: number;
      sentCount: number;
      failedCount: number;
    };

const ADMIN_ROLES = new Set(["hq", "manager", "staff"]);

export async function createSegmentCampaign(
  params: CreateSegmentCampaignParams,
): Promise<CreateSegmentCampaignResult> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    return { status: "unauthorized" };
  }
  const adminId = Number(session.user.id);

  const members = await prisma.member.findMany({
    where: buildMemberWhereClause(params.condition),
  });
  const targets =
    params.channelMode === "line" ? members.filter((m) => m.lineUserId !== null) : members;

  const campaign = await prisma.segmentCampaign.create({
    data: {
      name: params.name,
      // CustomerFilterCondition has no index signature, so it isn't structurally
      // assignable to Prisma's InputJsonValue even though it's plain, JSON-serializable data.
      conditionJson: params.condition as Prisma.InputJsonValue,
      channelMode: params.channelMode,
      templateId: params.templateId,
      scheduledAt: params.scheduledAt ? new Date(params.scheduledAt) : null,
      targetCount: targets.length,
      createdByAdminId: adminId,
    },
  });

  if (params.scheduledAt) {
    return { status: "scheduled", campaignId: campaign.id, targetCount: targets.length };
  }

  const template = await prisma.deliveryTemplate.findUniqueOrThrow({
    where: { id: params.templateId },
  });

  let sentCount = 0;
  let failedCount = 0;

  for (const member of targets) {
    const channel = resolveMemberChannel(params.channelMode, member.lineUserId);
    const body = renderTemplate(template.bodyText, { 氏名: member.name });

    let success: boolean;
    let logSubject: string | null = null;

    if (channel === "line") {
      const sendResult = await sendLineMessage({
        lineUserId: member.lineUserId as string,
        body,
      });
      success = sendResult.status === "sent";
    } else {
      const subject = template.subject
        ? renderTemplate(template.subject, { 氏名: member.name })
        : "";
      logSubject = subject || null;
      const sendResult = await sendEmail({ to: member.email, subject, body });
      success = sendResult.status === "sent";
    }

    if (success) sentCount += 1;
    else failedCount += 1;

    await prisma.emailLineLog.create({
      data: {
        memberId: member.id,
        channel,
        templateType: "segment",
        segmentCampaignId: campaign.id,
        subject: logSubject,
        sentAt: new Date(),
        status: success ? "success" : "failed",
      },
    });
  }

  await prisma.segmentCampaign.update({
    where: { id: campaign.id },
    data: { sentAt: new Date() },
  });

  return {
    status: "sent",
    campaignId: campaign.id,
    targetCount: targets.length,
    sentCount,
    failedCount,
  };
}

export interface SegmentCampaignListItem {
  id: number;
  name: string;
  channelMode: SegmentChannelMode;
  templateName: string;
  targetCount: number;
  scheduledAt: string | null;
  sentAt: string | null;
}

export async function listSegmentCampaigns(): Promise<SegmentCampaignListItem[]> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  const campaigns = await prisma.segmentCampaign.findMany({
    include: { template: true },
    orderBy: { createdAt: "desc" },
  });

  return campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    channelMode: c.channelMode,
    templateName: c.template.name,
    targetCount: c.targetCount,
    scheduledAt: c.scheduledAt ? c.scheduledAt.toISOString() : null,
    sentAt: c.sentAt ? c.sentAt.toISOString() : null,
  }));
}
