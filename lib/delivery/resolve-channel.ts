export type SegmentChannelMode = "email" | "line" | "auto";

export interface MemberChannelPreferences {
  lineUserId: string | null;
  emailNotificationEnabled: boolean;
  lineNotificationEnabled: boolean;
}

export type ResolvedChannel = "email" | "line" | "none";

/**
 * 配信モード（キャンペーン側のchannelMode）と会員本人の通知設定（メール/LINE配信の
 * オン・オフ、LINE未連携かどうか）の両方を踏まえて、実際にどのチャネルで送るべきかを
 * 決める。会員がどちらのチャネルも受け取れない状態なら"none"（配信対象外）を返す。
 */
export function resolveMemberChannel(
  channelMode: SegmentChannelMode,
  prefs: MemberChannelPreferences,
): ResolvedChannel {
  const canLine = prefs.lineUserId !== null && prefs.lineNotificationEnabled;
  const canEmail = prefs.emailNotificationEnabled;

  if (channelMode === "line") return canLine ? "line" : "none";
  if (channelMode === "email") return canEmail ? "email" : "none";
  if (canLine) return "line";
  if (canEmail) return "email";
  return "none";
}

export function isMemberEligibleForChannel(
  channelMode: SegmentChannelMode,
  prefs: MemberChannelPreferences,
): boolean {
  return resolveMemberChannel(channelMode, prefs) !== "none";
}
