import { prisma } from "@/lib/db";
import { renderTemplate } from "./render-template";
import { resolveMemberChannel, type SegmentChannelMode } from "./resolve-channel";
import { sendEmail } from "./send-email";
import { sendLineMessage } from "./send-line";

export interface SendToMemberMember {
  id: number;
  name: string;
  email: string;
  lineUserId: string | null;
  emailNotificationEnabled: boolean;
  lineNotificationEnabled: boolean;
}

export interface SendToMemberTemplate {
  bodyText: string;
  subject: string | null;
}

export interface SendToMemberParams {
  member: SendToMemberMember;
  channelMode: SegmentChannelMode;
  template: SendToMemberTemplate;
  templateType: "birthday" | "reminder" | "segment";
  tags: Record<string, string>;
  now: Date;
}

export async function sendToMemberAndLog(
  params: SendToMemberParams,
): Promise<"success" | "failed" | "skipped"> {
  const channel = resolveMemberChannel(params.channelMode, params.member);

  if (channel === "none") {
    // 会員本人がメール・LINEどちらの配信も無効にしている（または希望チャネルが
    // 未連携）ため、送信もログ記録もしない。これは失敗ではなく意図的な配信対象外。
    return "skipped";
  }

  const body = renderTemplate(params.template.bodyText, params.tags);

  let status: "success" | "failed";
  let logSubject: string | null = null;

  if (channel === "line") {
    const result = await sendLineMessage({
      lineUserId: params.member.lineUserId as string,
      body,
    });
    status = result.status === "sent" ? "success" : "failed";
  } else {
    const subject = params.template.subject
      ? renderTemplate(params.template.subject, params.tags)
      : "";
    logSubject = subject || null;
    const result = await sendEmail({ to: params.member.email, subject, body });
    status = result.status === "sent" ? "success" : "failed";
  }

  await prisma.emailLineLog.create({
    data: {
      memberId: params.member.id,
      channel,
      templateType: params.templateType,
      subject: logSubject,
      sentAt: params.now,
      status,
    },
  });

  return status;
}
