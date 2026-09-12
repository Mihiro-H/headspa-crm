import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCalendarReservations } from "./calendar-reservations";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: { findMany: vi.fn() },
  },
}));

describe("getCalendarReservations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps reservations with staff/member/course names for calendar display", async () => {
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      {
        id: 1,
        staffId: 3,
        staff: { name: "田中 花子" },
        member: { name: "佐藤 太郎" },
        startTime: new Date("1970-01-01T11:00:00Z"),
        endTime: new Date("1970-01-01T12:00:00Z"),
        status: "confirmed",
        source: "web",
        items: [
          {
            itemType: "course",
            course: { name: "スタンダード", category: { name: "頭皮ケア重点" } },
          },
        ],
      },
      {
        id: 2,
        staffId: null,
        staff: null,
        member: null,
        startTime: new Date("1970-01-01T14:00:00Z"),
        endTime: new Date("1970-01-01T15:00:00Z"),
        status: "temp_hold",
        source: "web",
        items: [],
      },
    ] as never);

    const result = await getCalendarReservations(1, "2026-09-15");

    expect(result).toEqual([
      {
        id: 1,
        staffId: 3,
        staffName: "田中 花子",
        memberName: "佐藤 太郎",
        categoryName: "頭皮ケア重点",
        courseName: "スタンダード",
        startMinutes: 660,
        endMinutes: 720,
        status: "confirmed",
        source: "web",
      },
      {
        id: 2,
        staffId: null,
        staffName: null,
        memberName: null,
        categoryName: "",
        courseName: "",
        startMinutes: 840,
        endMinutes: 900,
        status: "temp_hold",
        source: "web",
      },
    ]);
    expect(prisma.reservation.findMany).toHaveBeenCalledWith({
      where: {
        storeId: 1,
        reservationDate: new Date("2026-09-15T00:00:00.000Z"),
        status: { in: ["temp_hold", "confirmed", "completed"] },
      },
      include: {
        staff: true,
        member: true,
        items: { include: { course: { include: { category: true } } } },
      },
      orderBy: { startTime: "asc" },
    });
  });
});
