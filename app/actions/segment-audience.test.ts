import { describe, it, expect, vi, beforeEach } from "vitest";
import { previewSegmentAudience } from "./segment-audience";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/lib/db", () => ({
  prisma: {
    member: { findMany: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

const MEMBERS = [{ lineUserId: "line-1" }, { lineUserId: "line-2" }, { lineUserId: null }];

describe("previewSegmentAudience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
  });

  it("rejects a non-admin session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "member" } } as never);

    await expect(previewSegmentAudience({}, "auto")).rejects.toThrow("unauthorized");
    expect(prisma.member.findMany).not.toHaveBeenCalled();
  });

  it("splits into line/email counts for auto mode", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue(MEMBERS as never);

    const result = await previewSegmentAudience({}, "auto");

    expect(result).toEqual({ totalCount: 3, lineCount: 2, emailCount: 1 });
  });

  it("counts everyone as email for email mode", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue(MEMBERS as never);

    const result = await previewSegmentAudience({}, "email");

    expect(result).toEqual({ totalCount: 3, lineCount: 0, emailCount: 3 });
  });

  it("excludes non-LINE-linked members entirely for line mode", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue(MEMBERS as never);

    const result = await previewSegmentAudience({}, "line");

    expect(result).toEqual({ totalCount: 2, lineCount: 2, emailCount: 0 });
  });

  it("passes the condition through to the where clause", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([] as never);

    await previewSegmentAudience({ name: "田中", statusId: 2, storeId: 1 }, "auto");

    expect(prisma.member.findMany).toHaveBeenCalledWith({
      where: {
        name: { contains: "田中", mode: "insensitive" },
        statusId: 2,
        primaryStoreId: 1,
      },
      select: { lineUserId: true },
    });
  });
});
