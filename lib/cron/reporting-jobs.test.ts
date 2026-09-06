import { describe, it, expect, vi, beforeEach } from "vitest";
import { runStatusUpdateJob, runMonthlyReportJob, statusQualifies } from "./reporting-jobs";
import { prisma } from "@/lib/db";
import { getSalesReport } from "@/app/actions/sales-report";

vi.mock("@/lib/db", () => ({
  prisma: {
    customerStatus: { findMany: vi.fn() },
    member: { findMany: vi.fn(), update: vi.fn() },
    cronJobLog: { create: vi.fn() },
  },
}));

vi.mock("@/app/actions/sales-report", () => ({
  getSalesReport: vi.fn(),
}));

const now = new Date("2026-10-01T03:00:00.000Z");

describe("statusQualifies", () => {
  it("qualifies when either condition is met in OR mode", () => {
    const status = { minVisitCount: 5, minTotalSpent: 50000, conditionMode: "or" as const };
    expect(statusQualifies(status, { visitCount: 6, totalSpent: 0 })).toBe(true);
    expect(statusQualifies(status, { visitCount: 0, totalSpent: 60000 })).toBe(true);
    expect(statusQualifies(status, { visitCount: 0, totalSpent: 0 })).toBe(false);
  });

  it("requires both conditions in AND mode", () => {
    const status = { minVisitCount: 5, minTotalSpent: 50000, conditionMode: "and" as const };
    expect(statusQualifies(status, { visitCount: 6, totalSpent: 0 })).toBe(false);
    expect(statusQualifies(status, { visitCount: 6, totalSpent: 60000 })).toBe(true);
  });
});

describe("runStatusUpdateJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.cronJobLog.create).mockResolvedValue({} as never);
  });

  it("promotes a member whose visit count now qualifies for a higher status", async () => {
    vi.mocked(prisma.customerStatus.findMany).mockResolvedValue([
      { id: 1, minVisitCount: 0, minTotalSpent: 0, conditionMode: "or" },
      { id: 2, minVisitCount: 5, minTotalSpent: 0, conditionMode: "or" },
      { id: 3, minVisitCount: 10, minTotalSpent: 0, conditionMode: "or" },
    ] as never);
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      { id: 100, visitCount: 6, totalSpent: 0, statusId: 1 },
      { id: 101, visitCount: 3, totalSpent: 0, statusId: 1 },
    ] as never);
    vi.mocked(prisma.member.update).mockResolvedValue({} as never);

    await runStatusUpdateJob(now);

    expect(prisma.member.update).toHaveBeenCalledTimes(1);
    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: 100 },
      data: { statusId: 2 },
    });
    expect(prisma.cronJobLog.create).toHaveBeenCalledWith({
      data: { jobName: "status_update", executedAt: now, status: "success", targetCount: 1 },
    });
  });

  it("does not update a member who is already at the correct status", async () => {
    vi.mocked(prisma.customerStatus.findMany).mockResolvedValue([
      { id: 1, minVisitCount: 0, minTotalSpent: 0, conditionMode: "or" },
      { id: 2, minVisitCount: 5, minTotalSpent: 0, conditionMode: "or" },
    ] as never);
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      { id: 100, visitCount: 6, totalSpent: 0, statusId: 2 },
    ] as never);

    await runStatusUpdateJob(now);

    expect(prisma.member.update).not.toHaveBeenCalled();
    expect(prisma.cronJobLog.create).toHaveBeenCalledWith({
      data: { jobName: "status_update", executedAt: now, status: "success", targetCount: 0 },
    });
  });

  it("promotes a member who qualifies by total spend alone under OR mode", async () => {
    vi.mocked(prisma.customerStatus.findMany).mockResolvedValue([
      { id: 1, minVisitCount: 0, minTotalSpent: 0, conditionMode: "or" },
      { id: 2, minVisitCount: 10, minTotalSpent: 50000, conditionMode: "or" },
    ] as never);
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      { id: 100, visitCount: 1, totalSpent: 60000, statusId: 1 },
    ] as never);
    vi.mocked(prisma.member.update).mockResolvedValue({} as never);

    await runStatusUpdateJob(now);

    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: 100 },
      data: { statusId: 2 },
    });
  });

  it("does not promote a member who meets only one condition under AND mode", async () => {
    vi.mocked(prisma.customerStatus.findMany).mockResolvedValue([
      { id: 1, minVisitCount: 0, minTotalSpent: 0, conditionMode: "or" },
      { id: 2, minVisitCount: 10, minTotalSpent: 50000, conditionMode: "and" },
    ] as never);
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      { id: 100, visitCount: 12, totalSpent: 1000, statusId: 1 },
    ] as never);

    await runStatusUpdateJob(now);

    expect(prisma.member.update).not.toHaveBeenCalled();
  });
});

describe("runMonthlyReportJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.cronJobLog.create).mockResolvedValue({} as never);
  });

  it("aggregates the previous month's sales report and logs the customer count", async () => {
    vi.mocked(getSalesReport).mockResolvedValue({
      summary: {
        salesTotal: 500000,
        customerCount: 42,
        averageSpend: 11904,
        newCustomerCount: 10,
        repeatCustomerCount: 32,
        nominationSalesRatio: 60,
      },
      dailySales: [],
      courseSales: [],
      staffSales: [],
      details: [],
    } as never);

    await runMonthlyReportJob(now);

    expect(getSalesReport).toHaveBeenCalledWith({
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      storeId: null,
    });
    expect(prisma.cronJobLog.create).toHaveBeenCalledWith({
      data: { jobName: "monthly_report", executedAt: now, status: "success", targetCount: 42 },
    });
  });
});
