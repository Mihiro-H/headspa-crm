export type SegmentChannelMode = "email" | "line" | "auto";

export function isMemberEligibleForChannel(
  channelMode: SegmentChannelMode,
  lineUserId: string | null,
): boolean {
  if (channelMode === "line") return lineUserId !== null;
  return true;
}

export function resolveMemberChannel(
  channelMode: SegmentChannelMode,
  lineUserId: string | null,
): "email" | "line" {
  if (channelMode === "email") return "email";
  if (channelMode === "line") return "line";
  return lineUserId !== null ? "line" : "email";
}
