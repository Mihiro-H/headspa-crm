import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTempHoldReservation } from "./create-temp-hold";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    course: { findUniqueOrThrow: vi.fn() },
    option: { findMany: vi.fn() },
    staff: { findUniqueOrThrow: vi.fn() },
  },
}));

const baseCourse = {
  id: 10,
  price: 10000,
  treatmentTimeMin: 60,
  campaignTargets: [],
  category: { campaignTargets: [] },
};

describe("createTempHoldReservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.course.findUniqueOrThrow).mockResolvedValue(baseCourse as never);
    vi.mocked(prisma.option.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.reservation.create).mockResolvedValue({ id: 123 } as never);
  });

  it("creates a temp_hold reservation with no member yet, no nomination fee when no staff is chosen", async () => {
    const result = await createTempHoldReservation({
      storeId: 1,
      staffId: null,
      courseId: 10,
      optionIds: [],
      reservationDate: "2026-09-10",
      startMinutes: 660,
    });

    expect(result).toEqual({ status: "created", reservationId: 123 });
    expect(prisma.staff.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(prisma.reservation.create).toHaveBeenCalledTimes(1);
    const createArgs = vi.mocked(prisma.reservation.create).mock.calls[0][0];
    expect(createArgs.data.status).toBe("temp_hold");
    expect(createArgs.data.memberId).toBeNull();
    expect(createArgs.data.nominationFeeApplied).toBe(0);
    expect(createArgs.data.totalPrice).toBe(10000);
    expect(createArgs.data.source).toBe("web");
  });

  it("derives the nomination fee server-side from the chosen staff member, ignoring any client-supplied fee", async () => {
    vi.mocked(prisma.staff.findUniqueOrThrow).mockResolvedValue({
      id: 7,
      nominationFee: 1500,
    } as never);

    const result = await createTempHoldReservation({
      storeId: 1,
      staffId: 7,
      courseId: 10,
      optionIds: [],
      reservationDate: "2026-09-10",
      startMinutes: 660,
    });

    expect(result).toEqual({ status: "created", reservationId: 123 });
    expect(prisma.staff.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: 7 } });
    const createArgs = vi.mocked(prisma.reservation.create).mock.calls[0][0];
    expect(createArgs.data.nominationFeeApplied).toBe(1500);
    expect(createArgs.data.totalPrice).toBe(11500);
  });

  it("applies an active course campaign discount to the recorded total price", async () => {
    vi.mocked(prisma.course.findUniqueOrThrow).mockResolvedValue({
      ...baseCourse,
      campaignTargets: [
        {
          campaign: {
            id: 5,
            priority: 0,
            discountType: "percentage",
            discountValue: 10,
            startDate: new Date("2000-01-01T00:00:00Z"),
            endDate: new Date("2999-01-01T00:00:00Z"),
            isPublished: true,
            storeTargets: [],
          },
        },
      ],
    } as never);

    const result = await createTempHoldReservation({
      storeId: 1,
      staffId: null,
      courseId: 10,
      optionIds: [],
      reservationDate: "2026-09-10",
      startMinutes: 660,
    });

    expect(result).toEqual({ status: "created", reservationId: 123 });
    const createArgs = vi.mocked(prisma.reservation.create).mock.calls[0][0];
    expect(createArgs.data.totalPrice).toBe(9000);
  });

  it("refuses to create when the slot is no longer free", async () => {
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      { startTime: new Date("1970-01-01T11:00:00Z"), endTime: new Date("1970-01-01T12:00:00Z") },
    ] as never);

    const result = await createTempHoldReservation({
      storeId: 1,
      staffId: null,
      courseId: 10,
      optionIds: [],
      reservationDate: "2026-09-10",
      startMinutes: 660,
    });

    expect(result).toEqual({ status: "slot_unavailable" });
    expect(prisma.reservation.create).not.toHaveBeenCalled();
  });

  it("creates course and option line items alongside the reservation", async () => {
    vi.mocked(prisma.option.findMany).mockResolvedValue([
      { id: 20, price: 1500, durationMin: 15, discountExempt: true },
    ] as never);

    await createTempHoldReservation({
      storeId: 1,
      staffId: null,
      courseId: 10,
      optionIds: [20],
      reservationDate: "2026-09-10",
      startMinutes: 660,
    });

    const createArgs = vi.mocked(prisma.reservation.create).mock.calls[0][0];
    expect(createArgs.data.items!.create).toEqual([
      { itemType: "course", courseId: 10, appliedCampaignId: null, priceAtBooking: 10000 },
      { itemType: "option", optionId: 20, appliedCampaignId: null, priceAtBooking: 1500 },
    ]);
  });
});
