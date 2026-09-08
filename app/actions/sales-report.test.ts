import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSalesReport } from "./sales-report";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: { findMany: vi.fn() },
  },
}));

describe("getSalesReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes summary, daily/course/staff breakdowns, and detail rows for the period", async () => {
    const reservations = [
      {
        id: 1,
        reservationDate: new Date("2026-09-05T00:00:00.000Z"),
        totalPrice: 10000,
        staffId: 5,
        memberId: 10,
        store: { name: "フォレスパ 渋谷店" },
        member: { name: "山田太郎" },
        staff: { name: "佐藤 由紀" },
        items: [
          { itemType: "course", course: { name: "頭皮ケアスタンダード" }, priceAtBooking: 10000 },
        ],
      },
      {
        id: 2,
        reservationDate: new Date("2026-09-05T00:00:00.000Z"),
        totalPrice: 8000,
        staffId: null,
        memberId: 20,
        store: { name: "フォレスパ 渋谷店" },
        member: { name: "鈴木花子" },
        staff: null,
        items: [
          { itemType: "course", course: { name: "頭皮ケアプレミアム" }, priceAtBooking: 8000 },
        ],
      },
      {
        id: 3,
        reservationDate: new Date("2026-09-10T00:00:00.000Z"),
        totalPrice: 12000,
        staffId: 5,
        memberId: 10,
        store: { name: "フォレスパ 渋谷店" },
        member: { name: "山田太郎" },
        staff: { name: "佐藤 由紀" },
        items: [
          { itemType: "course", course: { name: "頭皮ケアスタンダード" }, priceAtBooking: 12000 },
        ],
      },
    ];
    const earliestPerMember = [
      { memberId: 10, reservationDate: new Date("2026-08-01T00:00:00.000Z") },
      { memberId: 20, reservationDate: new Date("2026-09-05T00:00:00.000Z") },
    ];

    vi.mocked(prisma.reservation.findMany)
      .mockResolvedValueOnce(reservations as never)
      .mockResolvedValueOnce(earliestPerMember as never);

    const result = await getSalesReport({
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      storeId: null,
    });

    expect(result.summary).toEqual({
      salesTotal: 30000,
      customerCount: 3,
      averageSpend: 10000,
      newCustomerCount: 1,
      repeatCustomerCount: 1,
      nominationSalesRatio: 73,
    });

    expect(result.dailySales).toEqual([
      { date: "2026-09-05", total: 18000 },
      { date: "2026-09-10", total: 12000 },
    ]);

    expect(result.courseSales).toEqual([
      { courseName: "頭皮ケアスタンダード", total: 22000 },
      { courseName: "頭皮ケアプレミアム", total: 8000 },
    ]);

    expect(result.staffSales).toEqual([
      { staffName: "佐藤 由紀", total: 22000 },
      { staffName: "指名なし", total: 8000 },
    ]);

    expect(result.details).toEqual([
      {
        id: 1,
        date: "2026-09-05",
        storeName: "フォレスパ 渋谷店",
        memberName: "山田太郎",
        courseName: "頭皮ケアスタンダード",
        staffName: "佐藤 由紀",
        totalPrice: 10000,
      },
      {
        id: 2,
        date: "2026-09-05",
        storeName: "フォレスパ 渋谷店",
        memberName: "鈴木花子",
        courseName: "頭皮ケアプレミアム",
        staffName: null,
        totalPrice: 8000,
      },
      {
        id: 3,
        date: "2026-09-10",
        storeName: "フォレスパ 渋谷店",
        memberName: "山田太郎",
        courseName: "頭皮ケアスタンダード",
        staffName: "佐藤 由紀",
        totalPrice: 12000,
      },
    ]);
  });

  it("includes the store filter in the query when storeId is given", async () => {
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([] as never);

    await getSalesReport({ startDate: "2026-09-01", endDate: "2026-09-30", storeId: 3 });

    expect(prisma.reservation.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        reservationDate: {
          gte: new Date("2026-09-01T00:00:00.000Z"),
          lte: new Date("2026-09-30T00:00:00.000Z"),
        },
        status: { in: ["confirmed", "completed"] },
        storeId: 3,
      },
      include: {
        store: true,
        member: true,
        staff: true,
        items: { include: { course: true } },
      },
      orderBy: { reservationDate: "asc" },
    });
  });

  it("omits the store filter when storeId is null (all stores)", async () => {
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([] as never);

    await getSalesReport({ startDate: "2026-09-01", endDate: "2026-09-30", storeId: null });

    expect(prisma.reservation.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        reservationDate: {
          gte: new Date("2026-09-01T00:00:00.000Z"),
          lte: new Date("2026-09-30T00:00:00.000Z"),
        },
        status: { in: ["confirmed", "completed"] },
      },
      include: {
        store: true,
        member: true,
        staff: true,
        items: { include: { course: true } },
      },
      orderBy: { reservationDate: "asc" },
    });
  });

  it("filters to allowedStoreIds when storeId is null but allowedStoreIds is given", async () => {
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([] as never);

    await getSalesReport({
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      storeId: null,
      allowedStoreIds: [2, 5],
    });

    expect(prisma.reservation.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        reservationDate: {
          gte: new Date("2026-09-01T00:00:00.000Z"),
          lte: new Date("2026-09-30T00:00:00.000Z"),
        },
        status: { in: ["confirmed", "completed"] },
        storeId: { in: [2, 5] },
      },
      include: {
        store: true,
        member: true,
        staff: true,
        items: { include: { course: true } },
      },
      orderBy: { reservationDate: "asc" },
    });
  });

  it("returns zeroed summary and empty breakdowns when there are no reservations in the period", async () => {
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([] as never);

    const result = await getSalesReport({
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      storeId: null,
    });

    expect(result.summary).toEqual({
      salesTotal: 0,
      customerCount: 0,
      averageSpend: 0,
      newCustomerCount: 0,
      repeatCustomerCount: 0,
      nominationSalesRatio: 0,
    });
    expect(result.dailySales).toEqual([]);
    expect(result.courseSales).toEqual([]);
    expect(result.staffSales).toEqual([]);
    expect(result.details).toEqual([]);
  });
});
