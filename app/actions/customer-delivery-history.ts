"use server";

import { prisma } from "@/lib/db";

export interface CustomerDeliveryLogItem {
  id: number;
  channel: string;
  templateType: string;
  subject: string | null;
  sentAt: string;
  status: string;
  segmentCampaignId: number | null;
  segmentCampaignName: string | null;
}

/**
 * 管理画面向けの配信履歴。会員向けの「お知らせ」（app/actions/member-notifications.ts）
 * と異なり、配信失敗も含めて全件返す。セグメント配信由来のものは
 * 「メール/LINE配信管理」（SegmentCampaign）のキャンペーン名を突き合わせて返す。
 */
export async function getCustomerDeliveryHistory(
  memberId: number,
): Promise<CustomerDeliveryLogItem[]> {
  const logs = await prisma.emailLineLog.findMany({
    where: { memberId },
    include: { segmentCampaign: true },
    orderBy: { sentAt: "desc" },
  });

  return logs.map((log) => ({
    id: log.id,
    channel: log.channel,
    templateType: log.templateType,
    subject: log.subject,
    sentAt: log.sentAt.toISOString(),
    status: log.status,
    segmentCampaignId: log.segmentCampaignId,
    segmentCampaignName: log.segmentCampaign?.name ?? null,
  }));
}
