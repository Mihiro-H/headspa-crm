import { describe, it, expect, vi, beforeEach } from "vitest";
import { listTemplates, listTemplatesPage, createTemplate, updateTemplate } from "./manage-templates";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/lib/db", () => ({
  prisma: {
    deliveryTemplate: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

describe("listTemplates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a non-admin session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "member" } } as never);

    await expect(listTemplates()).rejects.toThrow("unauthorized");
    expect(prisma.deliveryTemplate.findMany).not.toHaveBeenCalled();
  });

  it("returns all templates ordered by newest first", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.deliveryTemplate.findMany).mockResolvedValue([
      {
        id: 2,
        type: "segment",
        name: "夏季キャンペーン",
        subject: "夏の特別クーポン",
        bodyText: "{{氏名}}様へ",
      },
    ] as never);

    const result = await listTemplates();

    expect(result).toEqual([
      {
        id: 2,
        type: "segment",
        name: "夏季キャンペーン",
        subject: "夏の特別クーポン",
        bodyText: "{{氏名}}様へ",
      },
    ]);
    expect(prisma.deliveryTemplate.findMany).toHaveBeenCalledWith({ orderBy: { id: "desc" } });
  });
});

describe("createTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a non-admin session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    await expect(
      createTemplate({ type: "segment", name: "新テンプレート", subject: "件名", bodyText: "本文" }),
    ).rejects.toThrow("unauthorized");
    expect(prisma.deliveryTemplate.create).not.toHaveBeenCalled();
  });

  it("creates a new template and returns its id", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.deliveryTemplate.create).mockResolvedValue({ id: 10 } as never);

    const result = await createTemplate({
      type: "segment",
      name: "新テンプレート",
      subject: "件名",
      bodyText: "{{氏名}}様",
    });

    expect(result).toEqual({ templateId: 10 });
    expect(prisma.deliveryTemplate.create).toHaveBeenCalledWith({
      data: { type: "segment", name: "新テンプレート", subject: "件名", bodyText: "{{氏名}}様" },
    });
  });
});

describe("updateTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a non-admin session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "member" } } as never);

    await expect(
      updateTemplate({
        templateId: 10,
        name: "更新後の名前",
        subject: "更新後の件名",
        bodyText: "更新後の本文",
      }),
    ).rejects.toThrow("unauthorized");
    expect(prisma.deliveryTemplate.update).not.toHaveBeenCalled();
  });

  it("updates name, subject, and bodyText", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.deliveryTemplate.update).mockResolvedValue({} as never);

    await updateTemplate({
      templateId: 10,
      name: "更新後の名前",
      subject: "更新後の件名",
      bodyText: "更新後の本文",
    });

    expect(prisma.deliveryTemplate.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { name: "更新後の名前", subject: "更新後の件名", bodyText: "更新後の本文" },
    });
  });
});

describe("listTemplatesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.deliveryTemplate.count).mockResolvedValue(0);
  });

  it("rejects a non-admin session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "member" } } as never);

    await expect(listTemplatesPage()).rejects.toThrow("unauthorized");
    expect(prisma.deliveryTemplate.findMany).not.toHaveBeenCalled();
  });

  it("returns a page of templates with totalCount", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.deliveryTemplate.findMany).mockResolvedValue([
      {
        id: 2,
        type: "segment",
        name: "夏季キャンペーン",
        subject: "夏の特別クーポン",
        bodyText: "{{氏名}}様へ",
      },
    ] as never);
    vi.mocked(prisma.deliveryTemplate.count).mockResolvedValue(1);

    const result = await listTemplatesPage();

    expect(result).toEqual({
      items: [
        {
          id: 2,
          type: "segment",
          name: "夏季キャンペーン",
          subject: "夏の特別クーポン",
          bodyText: "{{氏名}}様へ",
        },
      ],
      totalCount: 1,
    });
    expect(prisma.deliveryTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { id: "desc" }, skip: 0, take: 20 }),
    );
  });

  it("applies skip/take based on the requested page", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.deliveryTemplate.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.deliveryTemplate.count).mockResolvedValue(25);

    const result = await listTemplatesPage(2);

    expect(prisma.deliveryTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20 }),
    );
    expect(result.totalCount).toBe(25);
  });
});
