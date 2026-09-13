export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
}

export type SendEmailResult =
  | { status: "sent" }
  | { status: "not_configured" }
  | { status: "failed"; error: string };

const RESEND_SEND_URL = "https://api.resend.com/emails";
// resend.devはResendが提供する検証不要の共有送信ドメイン。DNS認証なしで送信できる
// 代わりに送信先が制限される場合がある（本番の宛先が届かない場合は、Resend側で
// 独自ドメインを認証し、このSENDER_EMAILを差し替える）。
const SENDER_EMAIL = "onboarding@resend.dev";
const SENDER_NAME = "フォレスパ";

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { status: "not_configured" };
  }

  try {
    const response = await fetch(RESEND_SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
        to: [params.to],
        subject: params.subject,
        // テンプレート本文はプレーンテキスト（textarea編集、HTML入力欄なし）のため
        // textで送信する。htmlにすると差し込みタグ（会員が自由入力できる
        // 氏名等）がHTMLとして解釈されエスケープされずに描画されるインジェクションリスクがある。
        text: params.body,
      }),
    });

    if (!response.ok) {
      return { status: "failed", error: `Resend API error: ${response.status}` };
    }
    return { status: "sent" };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : "unknown error" };
  }
}
