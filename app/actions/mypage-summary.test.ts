import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMypageSummary } from "./mypage-summary";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/lib/db", () => ({
  prisma: {
    member: { findUnique: vi.fn() },
    customerStatus: { findMany: vi.fn() },
    reservation: { findFirst: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

const STATUSES = [
  { id: 1, name: "ブロンズ", minVisitCount: 0, sortOrder: 1 },
  { id: 2, name: "シルバー", minVisitCount: 5, sortOrder: 2 },
  { id: 3, name: "ゴールド", minVisitCount: 10, sortOrder: 3 },
];

describe("getMypageSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.customerStatus.findMany).mockResolvedValue(STATUSES as never);
    vi.mocked(prisma.reservation.findFirst).mockResolvedValue(null as never);
  });

  it("returns null for an unauthenticated caller", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await getMypageSummary();

    expect(result).toBeNull();
    expect(prisma.member.findUnique).not.toHaveBeenCalled();
  });

  it("returns null for a non-member session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "manager" } } as never);

    const result = await getMypageSummary();

    expect(result).toBeNull();
  });

  it("computes the next status and remaining visit count", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: 7,
      name: "田中 花子",
      visitCount: 3,
      statusId: 1,
      status: { id: 1, name: "ブロンズ", colorCode: "#CD7F32", minVisitCount: 0 },
    } as never);

    const result = await getMypageSummary();

    expect(result).toEqual({
      name: "田中 花子",
      statusName: "ブロンズ",
      statusColor: "#CD7F32",
      visitCount: 3,
      nextStatusName: "シルバー",
      visitsToNextStatus: 2,
      currentStatusMinVisitCount: 0,
      nextStatusMinVisitCount: 5,
      nextReservation: null,
    });
  });

  it("returns null next status when already at the top tier", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: 7,
      name: "田中 花子",
      visitCount: 20,
      statusId: 3,
      status: { id: 3, name: "ゴールド", colorCode: "#FFD700", minVisitCount: 10 },
    } as never);

    const result = await getMypageSummary();

    expect(result?.nextStatusName).toBeNull();
    expect(result?.visitsToNextStatus).toBeNull();
    expect(result?.nextStatusMinVisitCount).toBeNull();
  });

  it("includes the nearest upcoming confirmed reservation when present", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: 7,
      name: "田中 花子",
      visitCount: 3,
      statusId: 1,
      status: { id: 1, name: "ブロンズ", colorCode: "#CD7F32", minVisitCount: 0 },
    } as never);
    vi.mocked(prisma.reservation.findFirst).mockResolvedValue({
      id: 55,
      reservationDate: new Date("2026-09-10T00:00:00.000Z"),
      startTime: new Date("1970-01-01T10:30:00.000Z"),
      store: { name: "フォレスパ 渋谷店" },
      staff: { name: "佐藤 由紀" },
      items: [{ itemType: "course", course: { name: "頭皮ケアスタンダード" } }],
    } as never);

    const result = await getMypageSummary();

    expect(result?.nextReservation).toEqual({
      id: 55,
      reservationDate: "2026-09-10",
      startTimeLabel: "10:30",
      storeName: "フォレスパ 渋谷店",
      courseName: "頭皮ケアスタンダード",
      staffName: "佐藤 由紀",
    });
    expect(prisma.reservation.findFirst).toHaveBeenCalledWith({
      where: { memberId: 7, status: "confirmed", reservationDate: { gte: expect.any(Date) } },
      orderBy: { reservationDate: "asc" },
      include: { store: true, staff: true, items: { include: { course: true } } },
    });
  });
});
