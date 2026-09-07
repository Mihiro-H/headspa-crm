import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchCustomers } from "./search-customers";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    member: { findMany: vi.fn(), count: vi.fn() },
  },
}));

describe("searchCustomers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.member.count).mockResolvedValue(0);
  });

  it("maps members to customer list items with status, used stores, and contact info", async () => {
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
        usedStores: [
          { store: { id: 2, name: "フォレスパ 渋谷店" } },
          { store: { id: 3, name: "フォレスパ 新宿店" } },
        ],
        reservations: [{ reservationDate: new Date("2026-08-20T00:00:00Z") }],
      },
    ] as never);
    vi.mocked(prisma.member.count).mockResolvedValue(1);

    const result = await searchCustomers({});

    expect(result).toEqual({
      items: [
        {
          id: 1,
          name: "佐藤 太郎",
          phone: "090-1111-2222",
          statusName: "レギュラー",
          statusColor: "#8AAB78",
          visitCount: 5,
          totalSpent: 40000,
          lastVisitDate: "2026-08-20",
          storeIds: [2, 3],
          storeNames: ["フォレスパ 渋谷店", "フォレスパ 新宿店"],
          createdAt: "2026-01-15",
          isActive: true,
        },
      ],
      totalCount: 1,
    });
  });

  it("returns empty arrays for storeIds/storeNames and null lastVisitDate when absent", async () => {
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
        usedStores: [],
        reservations: [],
      },
    ] as never);

    const result = await searchCustomers({});

    expect(result.items[0].lastVisitDate).toBeNull();
    expect(result.items[0].storeIds).toEqual([]);
    expect(result.items[0].storeNames).toEqual([]);
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

  it("passes name/phone/statusIds/storeIds filters through to the query", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([] as never);

    await searchCustomers({ name: "田中", phone: "090", statusIds: [2, 3], storeIds: [1, 4] });

    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: "田中", mode: "insensitive" },
          phone: { contains: "090" },
          statusId: { in: [2, 3] },
          usedStores: { some: { storeId: { in: [1, 4] } } },
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

  it("paginates via skip/take for plain-column sorts, and returns totalCount from a separate count query", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.member.count).mockResolvedValue(45);

    const result = await searchCustomers({ page: 2 });

    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20 }),
    );
    expect(result.totalCount).toBe(45);
  });

  it("sorts by last visit date in memory, places customers with no visits last, and reports totalCount", async () => {
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
        usedStores: [],
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
        usedStores: [],
        reservations: [{ reservationDate: new Date("2026-08-01T00:00:00Z") }],
      },
    ] as never);

    const result = await searchCustomers({ sortBy: "lastVisitDate", sortDirection: "desc" });

    expect(result.items.map((c) => c.id)).toEqual([2, 1]);
    expect(result.totalCount).toBe(2);
    expect(prisma.member.count).not.toHaveBeenCalled();
  });
});
