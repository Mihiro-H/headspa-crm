import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPhoneReservation } from "./create-phone-reservation";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: { findMany: vi.fn(), create: vi.fn() },
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

describe("createPhoneReservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.course.findUniqueOrThrow).mockResolvedValue(baseCourse as never);
    vi.mocked(prisma.option.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.reservation.create).mockResolvedValue({ id: 200 } as never);
  });

  it("creates a confirmed phone reservation for a known member", async () => {
    const result = await createPhoneReservation({
      memberId: 5,
      storeId: 1,
      staffId: null,
      courseId: 10,
      optionIds: [],
      reservationDate: "2026-09-20",
      startMinutes: 660,
    });

    expect(result).toEqual({ status: "created", reservationId: 200 });
    const createArgs = vi.mocked(prisma.reservation.create).mock.calls[0][0];
    expect(createArgs.data.memberId).toBe(5);
    expect(createArgs.data.status).toBe("confirmed");
    expect(createArgs.data.source).toBe("phone");
    expect(createArgs.data.totalPrice).toBe(10000);
    expect(createArgs.data.tempHoldExpiresAt).toBeNull();
  });

  it("refuses to create when the slot is no longer free", async () => {
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      { startTime: new Date("1970-01-01T11:00:00Z"), endTime: new Date("1970-01-01T12:00:00Z") },
    ] as never);

    const result = await createPhoneReservation({
      memberId: 5,
      storeId: 1,
      staffId: null,
      courseId: 10,
      optionIds: [],
      reservationDate: "2026-09-20",
      startMinutes: 660,
    });

    expect(result).toEqual({ status: "slot_unavailable" });
    expect(prisma.reservation.create).not.toHaveBeenCalled();
  });
});
