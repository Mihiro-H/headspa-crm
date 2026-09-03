import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchCustomers } from "./search-customers";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    member: { findMany: vi.fn() },
  },
}));

describe("searchCustomers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps members to customer list items with status and store info", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      {
        id: 1,
        name: "佐藤 太郎",
        visitCount: 5,
        totalSpent: 40000,
        createdAt: new Date("2026-01-15T00:00:00Z"),
        status: { name: "レギュラー", colorCode: "#8AAB78" },
        primaryStore: { name: "フォレスパ 渋谷店" },
        reservations: [{ reservationDate: new Date("2026-08-20T00:00:00Z") }],
      },
    ] as never);

    const result = await searchCustomers({});

    expect(result).toEqual([
      {
        id: 1,
        name: "佐藤 太郎",
        statusName: "レギュラー",
        statusColor: "#8AAB78",
        visitCount: 5,
        totalSpent: 40000,
        lastVisitDate: "2026-08-20",
        primaryStoreName: "フォレスパ 渋谷店",
        createdAt: "2026-01-15",
      },
    ]);
  });

  it("returns null lastVisitDate and primaryStoreName when absent", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      {
        id: 2,
        name: "鈴木 花子",
        visitCount: 0,
        totalSpent: 0,
        createdAt: new Date("2026-02-01T00:00:00Z"),
        status: { name: "ビジター", colorCode: "#A9A08D" },
        primaryStore: null,
        reservations: [],
      },
    ] as never);

    const result = await searchCustomers({});

    expect(result[0].lastVisitDate).toBeNull();
    expect(result[0].primaryStoreName).toBeNull();
  });

  it("passes name/phone/status/store filters through to the query", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([] as never);

    await searchCustomers({ name: "田中", phone: "090", statusId: 2, storeId: 3 });

    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: "田中", mode: "insensitive" },
          phone: { contains: "090" },
          statusId: 2,
          primaryStoreId: 3,
        }),
      }),
    );
  });
});
