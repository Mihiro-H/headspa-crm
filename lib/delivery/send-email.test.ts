import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail } from "./send-email";

describe("sendEmail", () => {
  const originalApiKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalApiKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = originalApiKey;
    }
  });

  it("returns not_configured and does not call fetch when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;

    const result = await sendEmail({ to: "a@example.com", subject: "件名", body: "本文" });

    expect(result).toEqual({ status: "not_configured" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns sent when the Resend API responds ok", async () => {
    process.env.RESEND_API_KEY = "test-api-key";
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);

    const result = await sendEmail({ to: "a@example.com", subject: "件名", body: "本文" });

    expect(result).toEqual({ status: "sent" });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-api-key" }),
      }),
    );
    const callArgs = vi.mocked(fetch).mock.calls[0][1];
    const sentBody = JSON.parse(callArgs?.body as string);
    expect(sentBody.from).toBe("フォレスパ｜ヘッドスパ専門店 <onboarding@resend.dev>");
    expect(sentBody.to).toEqual(["a@example.com"]);
    expect(sentBody.text).toBe("本文");
    // テンプレート本文は差し込みタグに会員の自由入力（氏名等）が入るため、
    // htmlとして送るとエスケープされずインジェクションのリスクがある（textのみ使う）
    expect(sentBody.html).toBeUndefined();
  });

  it("returns failed with the response body when the Resend API responds with an error status", async () => {
    process.env.RESEND_API_KEY = "test-api-key";
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('{"statusCode":403,"message":"domain is not verified"}'),
    } as Response);

    const result = await sendEmail({ to: "a@example.com", subject: "件名", body: "本文" });

    expect(result).toEqual({
      status: "failed",
      error: 'Resend API error: 403 {"statusCode":403,"message":"domain is not verified"}',
    });
    // APIキー自体はログに出さず、失敗の原因（ステータス・レスポンス本文）だけをターミナルに
    // 残す。呼び出し元（manage-admins.ts等）はemailStatus文字列しか受け取らず詳細を捨てて
    // しまうため、ここでログしないと開発者が失敗理由を追えなくなる。
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "sendEmail failed:",
      'Resend API error: 403 {"statusCode":403,"message":"domain is not verified"}',
    );
    consoleErrorSpy.mockRestore();
  });

  it("returns failed and logs when fetch throws", async () => {
    process.env.RESEND_API_KEY = "test-api-key";
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));

    const result = await sendEmail({ to: "a@example.com", subject: "件名", body: "本文" });

    expect(result).toEqual({ status: "failed", error: "network error" });
    expect(consoleErrorSpy).toHaveBeenCalledWith("sendEmail failed:", "network error");
    consoleErrorSpy.mockRestore();
  });
});
