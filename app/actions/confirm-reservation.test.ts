import { describe, it, expect, vi, beforeEach } from "vitest";
import { confirmReservation } from "./confirm-reservation";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { createNotification } from "@/lib/notifications/create-notification";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    memberStore: { upsert: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/notifications/create-notification", () => ({
  createNotification: vi.fn(),
}));

describe("confirmReservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.reservation.update).mockResolvedValue({
      id: 99,
      storeId: 2,
      reservationDate: new Date("2026-09-20T00:00:00.000Z"),
      startTime: new Date("1970-01-01T11:00:00.000Z"),
    } as never);
    vi.mocked(prisma.memberStore.upsert).mockResolvedValue({} as never);
  });

  it("confirms using the authenticated member's id from the session, not a client-supplied one", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "5", role: "member" } } as never);
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 99,
      status: "temp_hold",
      tempHoldExpiresAt: new Date(Date.now() + 60_000),
    } as never);

    const result = await confirmReservation({ reservationId: 99 });

    expect(result).toEqual({ status: "confirmed" });
    expect(prisma.reservation.update).toHaveBeenCalledWith({
      where: { id: 99 },
      data: { memberId: 5, status: "confirmed", tempHoldExpiresAt: null },
    });
  });

  it("creates a store notification for the newly confirmed reservation", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "5", role: "member" } } as never);
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 99,
      status: "temp_hold",
      tempHoldExpiresAt: new Date(Date.now() + 60_000),
    } as never);

    await confirmReservation({ reservationId: 99 });

    expect(createNotification).toHaveBeenCalledWith({
      storeId: 2,
      type: "new_reservation",
      message: "新規WEB予約：2026-09-20 11:00〜",
      reservationId: 99,
    });
  });

  it("rejects unauthenticated callers", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await confirmReservation({ reservationId: 99 });

    expect(result).toEqual({ status: "unauthorized" });
    expect(prisma.reservation.findUnique).not.toHaveBeenCalled();
  });

  it("rejects non-member sessions (e.g. an admin session)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "manager" } } as never);

    const result = await confirmReservation({ reservationId: 99 });

    expect(result).toEqual({ status: "unauthorized" });
    expect(prisma.reservation.findUnique).not.toHaveBeenCalled();
  });

  it("rejects when the temp_hold has already expired", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "5", role: "member" } } as never);
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 99,
      status: "temp_hold",
      tempHoldExpiresAt: new Date(Date.now() - 60_000),
    } as never);

    const result = await confirmReservation({ reservationId: 99 });

    expect(result).toEqual({ status: "expired" });
    expect(prisma.reservation.update).not.toHaveBeenCalled();
  });

  it("rejects when the reservation is not in temp_hold status", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "5", role: "member" } } as never);
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 99,
      status: "cancelled",
      tempHoldExpiresAt: new Date(Date.now() + 60_000),
    } as never);

    const result = await confirmReservation({ reservationId: 99 });

    expect(result).toEqual({ status: "not_found" });
  });

  it("rejects when the reservation does not exist", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "5", role: "member" } } as never);
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(null as never);

    const result = await confirmReservation({ reservationId: 999 });

    expect(result).toEqual({ status: "not_found" });
  });
});
