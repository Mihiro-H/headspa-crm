import { describe, it, expect, vi, beforeEach } from "vitest";
import { listAutoDeliverySettings, upsertAutoDeliverySetting } from "./auto-delivery-settings";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/lib/db", () => ({
  prisma: {
    autoDeliverySetting: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

describe("listAutoDeliverySettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a non-admin session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "member" } } as never);

    await expect(listAutoDeliverySettings()).rejects.toThrow("unauthorized");
    expect(prisma.autoDeliverySetting.findMany).not.toHaveBeenCalled();
  });

  it("returns all settings with the template name", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.autoDeliverySetting.findMany).mockResolvedValue([
      {
        id: 1,
        type: "birthday",
        channelMode: "auto",
        sendTiming: "month_start",
        templateId: 5,
        isActive: true,
        template: { name: "誕生月クーポン" },
      },
    ] as never);

    const result = await listAutoDeliverySettings();

    expect(result).toEqual([
      {
        id: 1,
        type: "birthday",
        channelMode: "auto",
        sendTiming: "month_start",
        templateId: 5,
        templateName: "誕生月クーポン",
        isActive: true,
      },
    ]);
    expect(prisma.autoDeliverySetting.findMany).toHaveBeenCalledWith({
      include: { template: true },
      orderBy: { id: "asc" },
    });
  });
});

describe("upsertAutoDeliverySetting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a non-admin session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "member" } } as never);

    await expect(
      upsertAutoDeliverySetting({
        type: "birthday",
        channelMode: "auto",
        sendTiming: "month_start",
        templateId: 5,
        isActive: true,
      }),
    ).rejects.toThrow("unauthorized");
    expect(prisma.autoDeliverySetting.findFirst).not.toHaveBeenCalled();
  });

  it("creates a new setting when none exists for the type", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.autoDeliverySetting.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.autoDeliverySetting.create).mockResolvedValue({} as never);

    await upsertAutoDeliverySetting({
      type: "birthday",
      channelMode: "auto",
      sendTiming: "month_start",
      templateId: 5,
      isActive: true,
    });

    expect(prisma.autoDeliverySetting.create).toHaveBeenCalledWith({
      data: {
        type: "birthday",
        channelMode: "auto",
        sendTiming: "month_start",
        templateId: 5,
        isActive: true,
      },
    });
  });

  it("updates the existing setting when one already exists for the type", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.autoDeliverySetting.findFirst).mockResolvedValue({ id: 3 } as never);
    vi.mocked(prisma.autoDeliverySetting.update).mockResolvedValue({} as never);

    await upsertAutoDeliverySetting({
      type: "reminder",
      channelMode: "email",
      sendTiming: "18:00_day_before",
      templateId: 6,
      isActive: false,
    });

    expect(prisma.autoDeliverySetting.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: {
        channelMode: "email",
        sendTiming: "18:00_day_before",
        templateId: 6,
        isActive: false,
      },
    });
    expect(prisma.autoDeliverySetting.create).not.toHaveBeenCalled();
  });
});
