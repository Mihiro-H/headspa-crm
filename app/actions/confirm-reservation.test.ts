import { describe, it, expect, vi, beforeEach } from "vitest";
import { confirmReservation } from "./confirm-reservation";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

describe("confirmReservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.reservation.update).mockResolvedValue({ id: 99 } as never);
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
