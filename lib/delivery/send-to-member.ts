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
): Promise<"success" | "failed"> {
  const channel = resolveMemberChannel(params.channelMode, params.member.lineUserId);
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
