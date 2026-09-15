export interface SendLineMessageParams {
  lineUserId: string;
  body: string;
}

export type SendLineMessageResult =
  | { status: "sent" }
  | { status: "not_configured" }
  | { status: "failed"; error: string };

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

export async function sendLineMessage(
  params: SendLineMessageParams,
): Promise<SendLineMessageResult> {
  const accessToken = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) {
    return { status: "not_configured" };
  }

  try {
    const response = await fetch(LINE_PUSH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: params.lineUserId,
        messages: [{ type: "text", text: params.body }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      const error = `LINE API error: ${response.status} ${body}`;
      // 呼び出し元（sendToMemberAndLog）はstatus文字列だけを見てこの詳細を
      // 捨ててしまうため、ここでログしないと失敗理由（未フォロー等）を追えなくなる。
      console.error("sendLineMessage failed:", error);
      return { status: "failed", error };
    }
    return { status: "sent" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("sendLineMessage failed:", message);
    return { status: "failed", error: message };
  }
}
