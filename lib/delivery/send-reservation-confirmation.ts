import { prisma } from "@/lib/db";
import { sendToMemberAndLog, type SendToMemberMember } from "./send-to-member";

export interface SendReservationConfirmationParams {
  member: SendToMemberMember;
  storeName: string;
  reservationDateLabel: string;
  startTimeLabel: string;
  now: Date;
}

// 管理者アカウント招待メール（manage-admins.ts）のbuildInviteUrlと同じパターン。
function buildMypageUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${baseUrl}/mypage`;
}

// 予約完了通知は前日リマインド・誕生日メールと異なりCronでの定期実行ではなく、
// 予約確定のタイミングで直接呼ばれる。有効な設定（管理画面のAutoDeliveryTabで
// 「予約完了通知」として保存されたもの）がなければ何もしない。
export async function sendReservationConfirmation(
  params: SendReservationConfirmationParams,
): Promise<"success" | "failed" | "skipped" | "not_configured"> {
  const setting = await prisma.autoDeliverySetting.findFirst({
    where: { type: "confirmation", isActive: true },
    include: { template: true },
  });
  if (!setting) return "not_configured";

  return sendToMemberAndLog({
    member: params.member,
    channelMode: setting.channelMode,
    template: setting.template,
    templateType: "confirmation",
    tags: {
      氏名: params.member.name,
      店舗名: params.storeName,
      予約日: params.reservationDateLabel,
      予約時刻: params.startTimeLabel,
      マイページURL: buildMypageUrl(),
    },
    now: params.now,
  });
}
