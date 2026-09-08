import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTermsOfService, updateTermsOfService } from "./terms-of-service";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/lib/db", () => ({
  prisma: {
    termsOfService: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

describe("getTermsOfService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the stored body text", async () => {
    vi.mocked(prisma.termsOfService.findUnique).mockResolvedValue({
      id: 1,
      bodyText: "第1条 本規約について",
      updatedAt: new Date(),
    } as never);

    const result = await getTermsOfService();

    expect(result).toBe("第1条 本規約について");
    expect(prisma.termsOfService.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it("returns an empty string when no row exists yet", async () => {
    vi.mocked(prisma.termsOfService.findUnique).mockResolvedValue(null);

    const result = await getTermsOfService();

    expect(result).toBe("");
  });
});

describe("updateTermsOfService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts the body text when the caller is an admin", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { role: "hq" } } as never);
    vi.mocked(prisma.termsOfService.upsert).mockResolvedValue({} as never);

    await updateTermsOfService("第1条 本規約について（改訂版）");

    expect(prisma.termsOfService.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      create: { id: 1, bodyText: "第1条 本規約について（改訂版）" },
      update: { bodyText: "第1条 本規約について（改訂版）" },
    });
  });

  it("throws when there is no authenticated admin session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    await expect(updateTermsOfService("本文")).rejects.toThrow("unauthorized");
    expect(prisma.termsOfService.upsert).not.toHaveBeenCalled();
  });
});
