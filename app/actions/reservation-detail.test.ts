import { describe, it, expect, vi, beforeEach } from "vitest";
import { getReservationDetail, cancelReservation, markNoShow } from "./reservation-detail";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

describe("getReservationDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the reservation does not exist", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(null as never);
    expect(await getReservationDetail(999)).toBeNull();
  });

  it("maps a reservation with member/store/staff/items", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 1,
      status: "confirmed",
      source: "phone",
      reservationDate: new Date("2026-09-20T00:00:00Z"),
      startTime: new Date("1970-01-01T11:00:00Z"),
      endTime: new Date("1970-01-01T12:00:00Z"),
      totalPrice: 8000,
      member: { id: 5, name: "佐藤 太郎", phone: "090-0000-0000" },
      store: { name: "フォレスパ 渋谷店" },
      staff: { name: "田中 花子" },
      items: [
        { itemType: "course", course: { name: "スタンダード" }, option: null },
        { itemType: "option", course: null, option: { name: "ハンド・マッサージ" } },
      ],
    } as never);

    const result = await getReservationDetail(1);

    expect(result).toEqual({
      id: 1,
      status: "confirmed",
      source: "phone",
      reservationDate: "2026-09-20",
      startTimeLabel: "11:00",
      endTimeLabel: "12:00",
      totalPrice: 8000,
      memberId: 5,
      memberName: "佐藤 太郎",
      memberPhone: "090-0000-0000",
      storeName: "フォレスパ 渋谷店",
      staffName: "田中 花子",
      courseName: "スタンダード",
      optionNames: ["ハンド・マッサージ"],
    });
  });
});

describe("cancelReservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets the reservation status to cancelled", async () => {
    vi.mocked(prisma.reservation.update).mockResolvedValue({} as never);

    await cancelReservation(1);

    expect(prisma.reservation.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "cancelled" },
    });
  });
});

describe("markNoShow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets the reservation status to no_show", async () => {
    vi.mocked(prisma.reservation.update).mockResolvedValue({} as never);

    await markNoShow(1);

    expect(prisma.reservation.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "no_show" },
    });
  });
});
