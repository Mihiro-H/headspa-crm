import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { processShiftFormSubmission } from "@/lib/scheduling/process-shift-form-submission";

vi.mock("@/lib/scheduling/process-shift-form-submission", () => ({
  processShiftFormSubmission: vi.fn(),
}));

function makeRequest(body: unknown, authHeader?: string): Request {
  return new Request("http://localhost/api/shift-form-webhook", {
    method: "POST",
    headers: authHeader ? { authorization: authHeader } : {},
    body: JSON.stringify(body),
  });
}

describe("POST /api/shift-form-webhook", () => {
  const originalSecret = process.env.SHIFT_FORM_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SHIFT_FORM_WEBHOOK_SECRET = "test-secret";
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.SHIFT_FORM_WEBHOOK_SECRET;
    } else {
      process.env.SHIFT_FORM_WEBHOOK_SECRET = originalSecret;
    }
  });

  it("returns 401 when the bearer token does not match", async () => {
    const request = makeRequest({}, "Bearer wrong-secret");

    const response = await POST(request as never);

    expect(response.status).toBe(401);
    expect(processShiftFormSubmission).not.toHaveBeenCalled();
  });

  it("returns 401 when no authorization header is present", async () => {
    const request = makeRequest({});

    const response = await POST(request as never);

    expect(response.status).toBe(401);
  });

  it("processes the submission and returns its result when authorized", async () => {
    vi.mocked(processShiftFormSubmission).mockResolvedValue({
      status: "ok",
      dayOffCount: 2,
      reducedCount: 1,
      unparsedLines: [],
    });

    const request = makeRequest(
      {
        staffLabel: "渋谷店 - 松本陸",
        yearMonth: "2026-10",
        dayOffDates: ["2026-10-05"],
        reducedFreeText: "10/1 11:00-15:00",
      },
      "Bearer test-secret",
    );

    const response = await POST(request as never);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ status: "ok", dayOffCount: 2, reducedCount: 1, unparsedLines: [] });
    expect(processShiftFormSubmission).toHaveBeenCalledWith({
      staffLabel: "渋谷店 - 松本陸",
      yearMonth: "2026-10",
      dayOffDates: ["2026-10-05"],
      reducedFreeText: "10/1 11:00-15:00",
    });
  });

  it("returns 400 when the staff label does not match any active staff", async () => {
    vi.mocked(processShiftFormSubmission).mockResolvedValue({ status: "unmatched_staff" });

    const request = makeRequest(
      {
        staffLabel: "存在しない店舗 - 存在しないスタッフ",
        yearMonth: "2026-10",
        dayOffDates: [],
        reducedFreeText: "",
      },
      "Bearer test-secret",
    );

    const response = await POST(request as never);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({ status: "unmatched_staff" });
  });
});
