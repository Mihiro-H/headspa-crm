import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCustomerNote, saveCustomerNote } from "./customer-notes";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    customerNote: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}));

describe("getCustomerNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the member has no note yet", async () => {
    vi.mocked(prisma.customerNote.findFirst).mockResolvedValue(null as never);

    const result = await getCustomerNote(1);

    expect(result).toBeNull();
    expect(prisma.customerNote.findFirst).toHaveBeenCalledWith({
      where: { memberId: 1 },
      orderBy: { createdAt: "desc" },
    });
  });

  it("returns the most recent note", async () => {
    vi.mocked(prisma.customerNote.findFirst).mockResolvedValue({
      id: 5,
      noteText: "アレルギーあり",
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
    } as never);

    const result = await getCustomerNote(1);

    expect(result).toEqual({
      id: 5,
      noteText: "アレルギーあり",
      createdAt: "2026-09-01T00:00:00.000Z",
    });
  });
});

describe("saveCustomerNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new note when none exists yet", async () => {
    vi.mocked(prisma.customerNote.findFirst).mockResolvedValue(null as never);

    await saveCustomerNote(1, "初めてのメモ");

    expect(prisma.customerNote.create).toHaveBeenCalledWith({
      data: { memberId: 1, noteText: "初めてのメモ" },
    });
    expect(prisma.customerNote.update).not.toHaveBeenCalled();
  });

  it("updates the existing note in place when one already exists", async () => {
    vi.mocked(prisma.customerNote.findFirst).mockResolvedValue({
      id: 5,
      noteText: "古いメモ",
    } as never);

    await saveCustomerNote(1, "更新後のメモ");

    expect(prisma.customerNote.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { noteText: "更新後のメモ" },
    });
    expect(prisma.customerNote.create).not.toHaveBeenCalled();
  });
});
