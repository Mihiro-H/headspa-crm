export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
}

export type SendEmailResult =
  | { status: "sent" }
  | { status: "not_configured" }
  | { status: "failed"; error: string };

const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";
const SENDER_EMAIL = "no-reply@foresupa.example.com";
const SENDER_NAME = "フォレスパ";

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return { status: "not_configured" };
  }

  try {
    const response = await fetch(BREVO_SEND_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: SENDER_EMAIL, name: SENDER_NAME },
        to: [{ email: params.to }],
        subject: params.subject,
        // テンプレート本文はプレーンテキスト（textarea編集、HTML入力欄なし）のため
        // textContentで送信する。htmlContentにすると差し込みタグ（会員が自由入力できる
        // 氏名等）がHTMLとして解釈されエスケープされずに描画されるインジェクションリスクがある。
        textContent: params.body,
      }),
    });

    if (!response.ok) {
      return { status: "failed", error: `Brevo API error: ${response.status}` };
    }
    return { status: "sent" };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : "unknown error" };
  }
}
