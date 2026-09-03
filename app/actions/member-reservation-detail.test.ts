import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMemberNextReservation, cancelMemberReservation } from "./member-reservation-detail";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { createNotification } from "@/lib/notifications/create-notification";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/notifications/create-notification", () => ({
  createNotification: vi.fn(),
}));

describe("getMemberNextReservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for an unauthenticated caller", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await getMemberNextReservation();

    expect(result).toBeNull();
    expect(prisma.reservation.findFirst).not.toHaveBeenCalled();
  });

  it("returns null when there is no upcoming confirmed reservation", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.reservation.findFirst).mockResolvedValue(null as never);

    const result = await getMemberNextReservation();

    expect(result).toBeNull();
  });

  it("marks canModify true when now is before the cancellation deadline", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.reservation.findFirst).mockResolvedValue({
      id: 55,
      reservationDate: new Date("2026-09-10T00:00:00.000Z"),
      startTime: new Date("1970-01-01T10:30:00.000Z"),
      endTime: new Date("1970-01-01T11:30:00.000Z"),
      totalPrice: 8000,
      cancellationDeadline: new Date("2026-09-09T23:59:59.000Z"),
      store: { name: "フォレスパ 渋谷店", phone: "03-1111-1111" },
      staff: { name: "佐藤 由紀" },
      items: [
        { itemType: "course", course: { name: "頭皮ケアスタンダード" }, option: null },
        { itemType: "option", course: null, option: { name: "ハンド・マッサージ" } },
      ],
    } as never);

    const result = await getMemberNextReservation(new Date("2026-09-08T00:00:00.000Z"));

    expect(result).toEqual({
      id: 55,
      reservationDate: "2026-09-10",
      startTimeLabel: "10:30",
      endTimeLabel: "11:30",
      storeName: "フォレスパ 渋谷店",
      storePhone: "03-1111-1111",
      courseName: "頭皮ケアスタンダード",
      optionNames: ["ハンド・マッサージ"],
      staffName: "佐藤 由紀",
      totalPrice: 8000,
      canModify: true,
    });
  });

  it("marks canModify false when now is at or after the cancellation deadline", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.reservation.findFirst).mockResolvedValue({
      id: 55,
      reservationDate: new Date("2026-09-10T00:00:00.000Z"),
      startTime: new Date("1970-01-01T10:30:00.000Z"),
      endTime: new Date("1970-01-01T11:30:00.000Z"),
      totalPrice: 8000,
      cancellationDeadline: new Date("2026-09-09T23:59:59.000Z"),
      store: { name: "フォレスパ 渋谷店", phone: "03-1111-1111" },
      staff: null,
      items: [{ itemType: "course", course: { name: "頭皮ケアスタンダード" }, option: null }],
    } as never);

    const result = await getMemberNextReservation(new Date("2026-09-10T00:00:00.000Z"));

    expect(result?.canModify).toBe(false);
    expect(result?.staffName).toBeNull();
  });
});

describe("cancelMemberReservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated callers", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await cancelMemberReservation({ reservationId: 55 });

    expect(result).toEqual({ status: "unauthorized" });
    expect(prisma.reservation.findUnique).not.toHaveBeenCalled();
  });

  it("rejects when the reservation belongs to a different member", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 55,
      memberId: 99,
      status: "confirmed",
      cancellationDeadline: new Date("2099-01-01T00:00:00.000Z"),
    } as never);

    const result = await cancelMemberReservation({ reservationId: 55 });

    expect(result).toEqual({ status: "unauthorized" });
    expect(prisma.reservation.update).not.toHaveBeenCalled();
  });

  it("rejects when the reservation is not in confirmed status", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 55,
      memberId: 7,
      status: "cancelled",
      cancellationDeadline: new Date("2099-01-01T00:00:00.000Z"),
    } as never);

    const result = await cancelMemberReservation({ reservationId: 55 });

    expect(result).toEqual({ status: "not_found" });
  });

  it("rejects when the cancellation deadline has passed", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 55,
      memberId: 7,
      status: "confirmed",
      cancellationDeadline: new Date("2026-09-09T23:59:59.000Z"),
    } as never);

    const result = await cancelMemberReservation(
      { reservationId: 55 },
      new Date("2026-09-10T00:00:00.000Z"),
    );

    expect(result).toEqual({ status: "deadline_passed" });
    expect(prisma.reservation.update).not.toHaveBeenCalled();
  });

  it("cancels the reservation when owned, confirmed, and before the deadline", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 55,
      memberId: 7,
      status: "confirmed",
      cancellationDeadline: new Date("2099-01-01T00:00:00.000Z"),
    } as never);
    vi.mocked(prisma.reservation.update).mockResolvedValue({
      id: 55,
      storeId: 2,
      reservationDate: new Date("2026-09-10T00:00:00.000Z"),
      startTime: new Date("1970-01-01T10:30:00.000Z"),
    } as never);

    const result = await cancelMemberReservation({ reservationId: 55 });

    expect(result).toEqual({ status: "cancelled" });
    expect(prisma.reservation.update).toHaveBeenCalledWith({
      where: { id: 55 },
      data: { status: "cancelled" },
    });
  });

  it("creates a store notification when the member cancels their reservation", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 55,
      memberId: 7,
      status: "confirmed",
      cancellationDeadline: new Date("2099-01-01T00:00:00.000Z"),
    } as never);
    vi.mocked(prisma.reservation.update).mockResolvedValue({
      id: 55,
      storeId: 2,
      reservationDate: new Date("2026-09-10T00:00:00.000Z"),
      startTime: new Date("1970-01-01T10:30:00.000Z"),
    } as never);

    await cancelMemberReservation({ reservationId: 55 });

    expect(createNotification).toHaveBeenCalledWith({
      storeId: 2,
      type: "cancellation",
      message: "予約キャンセル：2026-09-10 10:30〜",
      reservationId: 55,
    });
  });
});
