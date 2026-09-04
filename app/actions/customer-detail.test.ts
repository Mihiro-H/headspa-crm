import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCustomerDetail } from "./customer-detail";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    member: { findUnique: vi.fn() },
  },
}));

describe("getCustomerDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the member does not exist", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue(null as never);

    const result = await getCustomerDetail(999);

    expect(result).toBeNull();
  });

  it("maps a member with reservation history", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: 1,
      name: "佐藤 太郎",
      nameKana: "サトウ タロウ",
      email: "taro@example.com",
      phone: "090-0000-0000",
      birthMonth: 4,
      gender: "male",
      lineUserId: "U123",
      visitCount: 3,
      totalSpent: 24000,
      status: { name: "レギュラー", colorCode: "#8AAB78" },
      reservations: [
        {
          id: 10,
          reservationDate: new Date("2026-08-20T00:00:00Z"),
          store: { name: "フォレスパ 渋谷店" },
          staff: { name: "田中 花子" },
          totalPrice: 8000,
          status: "completed",
          items: [{ itemType: "course", course: { name: "スタンダード" } }],
        },
      ],
    } as never);

    const result = await getCustomerDetail(1);

    expect(result).toEqual({
      id: 1,
      name: "佐藤 太郎",
      nameKana: "サトウ タロウ",
      email: "taro@example.com",
      phone: "090-0000-0000",
      birthMonth: 4,
      gender: "male",
      lineLinked: true,
      statusName: "レギュラー",
      statusColor: "#8AAB78",
      visitCount: 3,
      totalSpent: 24000,
      reservationHistory: [
        {
          id: 10,
          date: "2026-08-20",
          storeName: "フォレスパ 渋谷店",
          courseName: "スタンダード",
          staffName: "田中 花子",
          totalPrice: 8000,
          status: "completed",
        },
      ],
    });
  });
});
