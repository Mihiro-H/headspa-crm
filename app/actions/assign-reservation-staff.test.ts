import { describe, it, expect, vi, beforeEach } from "vitest";
import { assignReservationStaff } from "./assign-reservation-staff";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    staff: { findUnique: vi.fn() },
  },
}));

describe("assignReservationStaff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not_found when the reservation does not exist", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(null as never);

    const result = await assignReservationStaff(999, 1);

    expect(result).toEqual({ status: "not_found" });
  });

  it("returns already_assigned when the reservation already has a staff", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 1,
      staffId: 5,
      storeId: 1,
    } as never);

    const result = await assignReservationStaff(1, 2);

    expect(result).toEqual({ status: "already_assigned" });
  });

  it("returns not_found when the staff does not exist", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 1,
      staffId: null,
      storeId: 1,
      startTime: new Date("1970-01-01T11:00:00.000Z"),
      endTime: new Date("1970-01-01T12:00:00.000Z"),
      reservationDate: new Date("2026-09-15T00:00:00.000Z"),
      totalPrice: 8000,
    } as never);
    vi.mocked(prisma.staff.findUnique).mockResolvedValue(null as never);

    const result = await assignReservationStaff(1, 999);

    expect(result).toEqual({ status: "not_found" });
  });

  it("returns different_store when the staff belongs to a different store", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 1,
      staffId: null,
      storeId: 1,
      startTime: new Date("1970-01-01T11:00:00.000Z"),
      endTime: new Date("1970-01-01T12:00:00.000Z"),
      reservationDate: new Date("2026-09-15T00:00:00.000Z"),
      totalPrice: 8000,
    } as never);
    vi.mocked(prisma.staff.findUnique).mockResolvedValue({
      id: 2,
      storeId: 2,
      nominationFee: 500,
    } as never);

    const result = await assignReservationStaff(1, 2);

    expect(result).toEqual({ status: "different_store" });
  });

  it("returns conflict when the staff already has an overlapping booking", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 1,
      staffId: null,
      storeId: 1,
      startTime: new Date("1970-01-01T11:00:00.000Z"),
      endTime: new Date("1970-01-01T12:00:00.000Z"),
      reservationDate: new Date("2026-09-15T00:00:00.000Z"),
      totalPrice: 8000,
    } as never);
    vi.mocked(prisma.staff.findUnique).mockResolvedValue({
      id: 2,
      storeId: 1,
      nominationFee: 500,
    } as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      {
        id: 42,
        startTime: new Date("1970-01-01T11:30:00.000Z"),
        endTime: new Date("1970-01-01T12:30:00.000Z"),
      },
    ] as never);

    const result = await assignReservationStaff(1, 2);

    expect(result).toEqual({ status: "conflict" });
    expect(prisma.reservation.update).not.toHaveBeenCalled();
  });

  it("assigns the staff and adds their nomination fee to the total price", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 1,
      staffId: null,
      storeId: 1,
      startTime: new Date("1970-01-01T11:00:00.000Z"),
      endTime: new Date("1970-01-01T12:00:00.000Z"),
      reservationDate: new Date("2026-09-15T00:00:00.000Z"),
      totalPrice: 8000,
    } as never);
    vi.mocked(prisma.staff.findUnique).mockResolvedValue({
      id: 2,
      storeId: 1,
      nominationFee: 500,
    } as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([] as never);

    const result = await assignReservationStaff(1, 2);

    expect(result).toEqual({ status: "assigned" });
    expect(prisma.reservation.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { staffId: 2, nominationFeeApplied: 500, totalPrice: 8500 },
    });
  });
});
