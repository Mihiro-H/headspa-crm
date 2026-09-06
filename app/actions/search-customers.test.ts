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

  it("maps members to customer list items with status, store, and contact info", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      {
        id: 1,
        name: "佐藤 太郎",
        phone: "090-1111-2222",
        visitCount: 5,
        totalSpent: 40000,
        isActive: true,
        createdAt: new Date("2026-01-15T00:00:00Z"),
        status: { name: "レギュラー", colorCode: "#8AAB78" },
        primaryStore: { id: 2, name: "フォレスパ 渋谷店" },
        reservations: [{ reservationDate: new Date("2026-08-20T00:00:00Z") }],
      },
    ] as never);

    const result = await searchCustomers({});

    expect(result).toEqual([
      {
        id: 1,
        name: "佐藤 太郎",
        phone: "090-1111-2222",
        statusName: "レギュラー",
        statusColor: "#8AAB78",
        visitCount: 5,
        totalSpent: 40000,
        lastVisitDate: "2026-08-20",
        primaryStoreId: 2,
        primaryStoreName: "フォレスパ 渋谷店",
        createdAt: "2026-01-15",
        isActive: true,
      },
    ]);
  });

  it("returns null lastVisitDate and primaryStore fields when absent", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      {
        id: 2,
        name: "鈴木 花子",
        phone: "090-3333-4444",
        visitCount: 0,
        totalSpent: 0,
        isActive: true,
        createdAt: new Date("2026-02-01T00:00:00Z"),
        status: { name: "ビジター", colorCode: "#A9A08D" },
        primaryStore: null,
        reservations: [],
      },
    ] as never);

    const result = await searchCustomers({});

    expect(result[0].lastVisitDate).toBeNull();
    expect(result[0].primaryStoreId).toBeNull();
    expect(result[0].primaryStoreName).toBeNull();
  });

  it("filters to active customers by default, and includes inactive when requested", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([] as never);

    await searchCustomers({});
    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
    );

    vi.mocked(prisma.member.findMany).mockClear();
    await searchCustomers({ includeInactive: true });
    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ isActive: true }) }),
    );
  });

  it("passes name/phone/statusIds/store filters through to the query", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([] as never);

    await searchCustomers({ name: "田中", phone: "090", statusIds: [2, 3], storeId: 3 });

    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: "田中", mode: "insensitive" },
          phone: { contains: "090" },
          statusId: { in: [2, 3] },
          primaryStoreId: 3,
        }),
      }),
    );
  });

  it("orders by the requested field and direction for plain columns", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([] as never);

    await searchCustomers({ sortBy: "totalSpent", sortDirection: "asc" });

    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { totalSpent: "asc" } }),
    );
  });

  it("sorts by last visit date in memory, placing customers with no visits last", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      {
        id: 1,
        name: "来店なし",
        phone: "090-0000-0000",
        visitCount: 0,
        totalSpent: 0,
        isActive: true,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        status: { name: "ビジター", colorCode: "#A9A08D" },
        primaryStore: null,
        reservations: [],
      },
      {
        id: 2,
        name: "直近来店",
        phone: "090-0000-0001",
        visitCount: 3,
        totalSpent: 10000,
        isActive: true,
        createdAt: new Date("2026-01-02T00:00:00Z"),
        status: { name: "レギュラー", colorCode: "#8AAB78" },
        primaryStore: null,
        reservations: [{ reservationDate: new Date("2026-08-01T00:00:00Z") }],
      },
    ] as never);

    const result = await searchCustomers({ sortBy: "lastVisitDate", sortDirection: "desc" });

    expect(result.map((c) => c.id)).toEqual([2, 1]);
  });
});
