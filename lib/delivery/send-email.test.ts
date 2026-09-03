import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail } from "./send-email";

describe("sendEmail", () => {
  const originalApiKey = process.env.BREVO_API_KEY;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalApiKey === undefined) {
      delete process.env.BREVO_API_KEY;
    } else {
      process.env.BREVO_API_KEY = originalApiKey;
    }
  });

  it("returns not_configured and does not call fetch when BREVO_API_KEY is missing", async () => {
    delete process.env.BREVO_API_KEY;

    const result = await sendEmail({ to: "a@example.com", subject: "件名", body: "本文" });

    expect(result).toEqual({ status: "not_configured" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns sent when the Brevo API responds ok", async () => {
    process.env.BREVO_API_KEY = "test-api-key";
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);

    const result = await sendEmail({ to: "a@example.com", subject: "件名", body: "本文" });

    expect(result).toEqual({ status: "sent" });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.brevo.com/v3/smtp/email",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "api-key": "test-api-key" }),
      }),
    );
    const callArgs = vi.mocked(fetch).mock.calls[0][1];
    const sentBody = JSON.parse(callArgs?.body as string);
    expect(sentBody.textContent).toBe("本文");
    expect(sentBody.htmlContent).toBeUndefined();
  });

  it("returns failed when the Brevo API responds with an error status", async () => {
    process.env.BREVO_API_KEY = "test-api-key";
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 401 } as Response);

    const result = await sendEmail({ to: "a@example.com", subject: "件名", body: "本文" });

    expect(result).toEqual({ status: "failed", error: "Brevo API error: 401" });
  });

  it("returns failed when fetch throws", async () => {
    process.env.BREVO_API_KEY = "test-api-key";
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));

    const result = await sendEmail({ to: "a@example.com", subject: "件名", body: "本文" });

    expect(result).toEqual({ status: "failed", error: "network error" });
  });
});
