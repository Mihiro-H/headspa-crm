import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendLineMessage } from "./send-line";

describe("sendLineMessage", () => {
  const originalToken = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalToken === undefined) {
      delete process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
    } else {
      process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN = originalToken;
    }
  });

  it("returns not_configured and does not call fetch when the channel access token is missing", async () => {
    delete process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;

    const result = await sendLineMessage({ lineUserId: "line-user-1", body: "本文" });

    expect(result).toEqual({ status: "not_configured" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns sent when the LINE API responds ok", async () => {
    process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN = "test-token";
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);

    const result = await sendLineMessage({ lineUserId: "line-user-1", body: "本文" });

    expect(result).toEqual({ status: "sent" });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.line.me/v2/bot/message/push",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      }),
    );
  });

  it("returns failed when the LINE API responds with an error status", async () => {
    process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN = "test-token";
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 400 } as Response);

    const result = await sendLineMessage({ lineUserId: "line-user-1", body: "本文" });

    expect(result).toEqual({ status: "failed", error: "LINE API error: 400" });
  });

  it("returns failed when fetch throws", async () => {
    process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN = "test-token";
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));

    const result = await sendLineMessage({ lineUserId: "line-user-1", body: "本文" });

    expect(result).toEqual({ status: "failed", error: "network error" });
  });
});
