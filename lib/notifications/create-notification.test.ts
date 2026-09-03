import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNotification } from "./create-notification";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    notification: { create: vi.fn() },
  },
}));

describe("createNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a notification row with the given fields", async () => {
    vi.mocked(prisma.notification.create).mockResolvedValue({} as never);

    await createNotification({
      storeId: 2,
      type: "new_reservation",
      message: "新規WEB予約：2026-09-10 10:30〜",
      reservationId: 55,
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        storeId: 2,
        type: "new_reservation",
        message: "新規WEB予約：2026-09-10 10:30〜",
        reservationId: 55,
      },
    });
  });
});
