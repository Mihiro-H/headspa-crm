# Phase D: キャンペーン管理の改善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** キャンペーンの対象店舗を複数選択可能にし、対象コースの選択UIをカテゴリ別グループ表示に変更する。

**Architecture:** `Campaign.targetStoreId`（単一・nullable FK）を、既存の`CampaignCourseTarget`/`CampaignCategoryTarget`と同じ形の中間テーブル`CampaignStoreTarget`に置き換える。予約時の割引適用ロジック（`course-campaigns.ts`）も新しいデータ形状に合わせて書き換える。

**Tech Stack:** Next.js (App Router) / TypeScript / Prisma (PostgreSQL) / Tailwind CSS v4 / Vitest

**関連ドキュメント:** `docs/superpowers/specs/2026-09-07-phase-d-campaign-improvements-design.md`

**前提:** Phase A・Phase C（順序上先に完了）。本Planの`campaigns/page.tsx`への変更は、Phase Aで追加されたページネーション機能の上に積み重なる。

---

### Task 1: Prisma schema — `CampaignStoreTarget`中間テーブルを追加し`targetStoreId`を廃止

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: `model Campaign`から`targetStoreId`・`targetStore`を削除し、`storeTargets`を追加する**

`prisma/schema.prisma`の`model Campaign`ブロック内、以下の行：
```prisma
  targetStoreId Int?         @map("target_store_id")
```
を削除する。

同モデル内、以下の行：
```prisma
  targetStore      Store?                   @relation(fields: [targetStoreId], references: [id])
```
を以下に置き換える：
```prisma
  storeTargets     CampaignStoreTarget[]
```

- [ ] **Step 2: `model Store`から`campaigns`を削除し、`campaignStoreTargets`を追加する**

`model Store`ブロック内、以下の行：
```prisma
  campaigns      Campaign[]
```
を以下に置き換える：
```prisma
  campaignStoreTargets CampaignStoreTarget[]
```

- [ ] **Step 3: `CampaignStoreTarget`モデルを新設する**

`model CampaignCourseTarget`ブロックの直前に以下を追加する：

```prisma
model CampaignStoreTarget {
  id         Int @id @default(autoincrement())
  campaignId Int @map("campaign_id")
  storeId    Int @map("store_id")

  campaign Campaign @relation(fields: [campaignId], references: [id])
  store    Store    @relation(fields: [storeId], references: [id])

  @@map("campaign_store_targets")
}

```

- [ ] **Step 4: Prisma Clientを再生成する**

Run: `npx prisma generate`
Expected: `Generated Prisma Client`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): replace Campaign.targetStoreId with many-to-many CampaignStoreTarget

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

**⚠️ ユーザーへの依頼事項:** `npx prisma migrate dev --name replace_campaign_target_store --create-only`でマイグレーションファイルを生成し、`ALTER TABLE "campaigns" DROP COLUMN "target_store_id";`より前に以下のSQLを挿入してから適用する：
```sql
INSERT INTO "campaign_store_targets" ("campaign_id", "store_id")
SELECT "campaign_id", "target_store_id" FROM "campaigns" WHERE "target_store_id" IS NOT NULL;
```

---

### Task 2: `course-campaigns.ts` — 複数店舗ターゲットに対応

**Files:**
- Modify: `app/actions/course-campaigns.ts`
- Test: `app/actions/course-campaigns.test.ts`

- [ ] **Step 1: 失敗するテストを書く（既存テストファイルを全面書き換え）**

`app/actions/course-campaigns.test.ts`を以下の内容に置き換える：

```ts
import { describe, it, expect } from "vitest";
import { resolveCourseCampaigns, type CourseWithCampaignTargets } from "./course-campaigns";

const now = new Date("2026-09-15T00:00:00Z");

function course(overrides: Partial<CourseWithCampaignTargets> = {}): CourseWithCampaignTargets {
  return {
    campaignTargets: [],
    category: { campaignTargets: [] },
    ...overrides,
  };
}

describe("resolveCourseCampaigns", () => {
  it("returns an empty array when there are no campaigns", () => {
    expect(resolveCourseCampaigns(course(), 1, now)).toEqual([]);
  });

  it("includes an active store-wide course-level campaign (no store targets)", () => {
    const result = resolveCourseCampaigns(
      course({
        campaignTargets: [
          {
            campaign: {
              id: 5,
              priority: 0,
              discountType: "percentage",
              discountValue: 10,
              startDate: new Date("2026-09-01T00:00:00Z"),
              endDate: new Date("2026-09-30T00:00:00Z"),
              isPublished: true,
              storeTargets: [],
            },
          },
        ],
      }),
      1,
      now,
    );

    expect(result).toEqual([
      { campaignId: 5, priority: 0, discountType: "percentage", discountValue: 10 },
    ]);
  });

  it("includes a campaign whose store targets include the requested store", () => {
    const result = resolveCourseCampaigns(
      course({
        campaignTargets: [
          {
            campaign: {
              id: 5,
              priority: 0,
              discountType: "percentage",
              discountValue: 10,
              startDate: new Date("2026-09-01T00:00:00Z"),
              endDate: new Date("2026-09-30T00:00:00Z"),
              isPublished: true,
              storeTargets: [{ storeId: 1 }, { storeId: 3 }],
            },
          },
        ],
      }),
      1,
      now,
    );

    expect(result).toEqual([
      { campaignId: 5, priority: 0, discountType: "percentage", discountValue: 10 },
    ]);
  });

  it("excludes a campaign whose store targets do not include the requested store", () => {
    const result = resolveCourseCampaigns(
      course({
        campaignTargets: [
          {
            campaign: {
              id: 5,
              priority: 0,
              discountType: "percentage",
              discountValue: 10,
              startDate: new Date("2026-09-01T00:00:00Z"),
              endDate: new Date("2026-09-30T00:00:00Z"),
              isPublished: true,
              storeTargets: [{ storeId: 2 }],
            },
          },
        ],
      }),
      1,
      now,
    );

    expect(result).toEqual([]);
  });

  it("includes an active category-level campaign", () => {
    const result = resolveCourseCampaigns(
      course({
        category: {
          campaignTargets: [
            {
              campaign: {
                id: 6,
                priority: 0,
                discountType: "fixed_amount",
                discountValue: 1500,
                startDate: new Date("2026-09-01T00:00:00Z"),
                endDate: new Date("2026-09-30T00:00:00Z"),
                isPublished: true,
                storeTargets: [],
              },
            },
          ],
        },
      }),
      1,
      now,
    );

    expect(result).toEqual([
      { campaignId: 6, priority: 0, discountType: "fixed_amount", discountValue: 1500 },
    ]);
  });

  it("excludes a campaign outside its active date range", () => {
    const result = resolveCourseCampaigns(
      course({
        campaignTargets: [
          {
            campaign: {
              id: 5,
              priority: 0,
              discountType: "percentage",
              discountValue: 10,
              startDate: new Date("2026-10-01T00:00:00Z"),
              endDate: new Date("2026-10-31T00:00:00Z"),
              isPublished: true,
              storeTargets: [],
            },
          },
        ],
      }),
      1,
      now,
    );

    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run app/actions/course-campaigns.test.ts`
Expected: FAIL（`RawCampaign`がまだ`targetStoreId`を要求している）

- [ ] **Step 3: 実装する**

`app/actions/course-campaigns.ts`を以下の内容に置き換える：

```ts
import { filterActiveCampaigns, type ActiveCampaignRow } from "@/lib/reservation/active-campaigns";
import type { DiscountType } from "@/lib/reservation/campaign-discount";
import type { CandidateCampaign } from "@/lib/reservation/campaign-resolution";

export interface RawCampaign {
  id: number;
  priority: number;
  discountType: DiscountType;
  discountValue: number;
  startDate: Date;
  endDate: Date;
  isPublished: boolean;
  storeTargets: { storeId: number }[];
}

export interface CourseWithCampaignTargets {
  campaignTargets: { campaign: RawCampaign }[];
  category: { campaignTargets: { campaign: RawCampaign }[] };
}

function toActiveCampaignRow(c: RawCampaign): ActiveCampaignRow & { storeTargetIds: number[] } {
  return {
    campaignId: c.id,
    priority: c.priority,
    discountType: c.discountType,
    discountValue: c.discountValue,
    startDate: c.startDate,
    endDate: c.endDate,
    isPublished: c.isPublished,
    storeTargetIds: c.storeTargets.map((t) => t.storeId),
  };
}

/**
 * Resolves the set of currently-active campaigns applicable to a course for a
 * given store, combining course-level and category-level campaign targets.
 * Shared by `courses.ts` (menu display pricing) and `create-temp-hold.ts`
 * (actual reservation pricing) so the two stay in sync.
 */
export function resolveCourseCampaigns(
  course: CourseWithCampaignTargets,
  storeId: number,
  now: Date,
): CandidateCampaign[] {
  const courseCampaigns = course.campaignTargets.map((t) => t.campaign);
  const categoryCampaigns = course.category.campaignTargets.map((t) => t.campaign);
  const eligible = [...courseCampaigns, ...categoryCampaigns]
    .map(toActiveCampaignRow)
    .filter((c) => c.storeTargetIds.length === 0 || c.storeTargetIds.includes(storeId));

  return filterActiveCampaigns(eligible, now);
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run app/actions/course-campaigns.test.ts`
Expected: PASS（6件）

- [ ] **Step 5: Commit**

```bash
git add app/actions/course-campaigns.ts app/actions/course-campaigns.test.ts
git commit -m "feat: resolve campaign store eligibility via CampaignStoreTarget

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 3: `courses.ts`・`create-temp-hold.ts` — Prismaクエリの`include`を更新する

**Files:**
- Modify: `app/actions/courses.ts`
- Modify: `app/actions/create-temp-hold.ts`

- [ ] **Step 1: `courses.ts`を更新する**

`app/actions/courses.ts`の以下のブロック：
```ts
    include: {
      campaignTargets: { include: { campaign: true } },
      category: { include: { campaignTargets: { include: { campaign: true } } } },
    },
```
を以下に置き換える：
```ts
    include: {
      campaignTargets: { include: { campaign: { include: { storeTargets: true } } } },
      category: {
        include: {
          campaignTargets: { include: { campaign: { include: { storeTargets: true } } } },
        },
      },
    },
```

- [ ] **Step 2: `create-temp-hold.ts`を更新する**

`app/actions/create-temp-hold.ts`の以下のブロック：
```ts
      include: {
        campaignTargets: { include: { campaign: true } },
        category: { include: { campaignTargets: { include: { campaign: true } } } },
      },
```
を以下に置き換える：
```ts
      include: {
        campaignTargets: { include: { campaign: { include: { storeTargets: true } } } },
        category: {
          include: {
            campaignTargets: { include: { campaign: { include: { storeTargets: true } } } },
          },
        },
      },
```

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: 既存の関連テストが壊れていないことを確認する**

Run: `npx vitest run app/actions/courses.test.ts app/actions/create-temp-hold.test.ts`
Expected: 全件PASS（これらのテストはPrismaをモックした固定データを直接`resolveCourseCampaigns`に渡さず、`listCoursesForCategory`/`createTempHold`自体をテストしている場合、モックデータの`campaign`オブジェクトに`targetStoreId`ではなく`storeTargets: []`を含める必要がある。実行して失敗した場合はテストのモックデータを修正する）

- [ ] **Step 5: Commit**

```bash
git add app/actions/courses.ts app/actions/create-temp-hold.ts app/actions/courses.test.ts app/actions/create-temp-hold.test.ts
git commit -m "feat: fetch campaign store targets in course pricing queries

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 4: `manage-campaigns.ts` — `storeIds`/`storeNames`（複数）に対応

**Files:**
- Modify: `app/actions/manage-campaigns.ts`
- Test: `app/actions/manage-campaigns.test.ts`

**前提:** Phase A（Task 5）でこのファイルは既に`page`引数とページング済み結果`{items, totalCount}`に対応済み。本タスクはその上に、単一の`targetStoreId`/`targetStoreName`を複数の`storeIds`/`storeNames`に置き換える。

- [ ] **Step 1: 失敗するテストを書く（既存テストファイルを全面書き換え）**

`app/actions/manage-campaigns.test.ts`を以下の内容に置き換える：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  republishCampaign,
} from "./manage-campaigns";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    campaign: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

describe("listCampaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.campaign.count).mockResolvedValue(0);
  });

  it("returns published campaigns with target ids and names, including multiple store targets", async () => {
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([
      {
        id: 1,
        name: "秋の頭皮ケアキャンペーン",
        discountType: "percentage",
        discountValue: 10,
        startDate: new Date("2026-09-01T00:00:00Z"),
        endDate: new Date("2026-09-30T00:00:00Z"),
        priority: 0,
        isPublished: true,
        storeTargets: [
          { storeId: 1, store: { name: "フォレスパ 東京丸の内本店" } },
          { storeId: 2, store: { name: "フォレスパ 渋谷店" } },
        ],
        courseTargets: [{ courseId: 5, course: { name: "スタンダード" } }],
        categoryTargets: [{ categoryId: 9, category: { name: "頭皮ケア重点" } }],
      },
    ] as never);
    vi.mocked(prisma.campaign.count).mockResolvedValue(1);

    const result = await listCampaigns();

    expect(result).toEqual({
      items: [
        {
          id: 1,
          name: "秋の頭皮ケアキャンペーン",
          discountType: "percentage",
          discountValue: 10,
          startDate: "2026-09-01",
          endDate: "2026-09-30",
          priority: 0,
          isPublished: true,
          storeIds: [1, 2],
          storeNames: ["フォレスパ 東京丸の内本店", "フォレスパ 渋谷店"],
          targetNames: ["スタンダード", "頭皮ケア重点"],
          courseIds: [5],
          categoryIds: [9],
        },
      ],
      totalCount: 1,
    });
  });

  it("returns storeNames of [\"全店舗\"] when no store targets are set", async () => {
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([
      {
        id: 2,
        name: "全店舗キャンペーン",
        discountType: "fixed_amount",
        discountValue: 500,
        startDate: new Date("2026-09-01T00:00:00Z"),
        endDate: new Date("2026-09-30T00:00:00Z"),
        priority: 0,
        isPublished: true,
        storeTargets: [],
        courseTargets: [],
        categoryTargets: [],
      },
    ] as never);

    const result = await listCampaigns();

    expect(result.items[0].storeIds).toEqual([]);
    expect(result.items[0].storeNames).toEqual(["全店舗"]);
  });

  it("includes unpublished campaigns when requested", async () => {
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([] as never);

    await listCampaigns({ includeUnpublished: true });

    expect(prisma.campaign.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it("applies skip/take based on the requested page", async () => {
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.campaign.count).mockResolvedValue(33);

    const result = await listCampaigns({ page: 2 });

    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20 }),
    );
    expect(result.totalCount).toBe(33);
  });
});

describe("createCampaign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a campaign with course, category, and store targets", async () => {
    vi.mocked(prisma.campaign.create).mockResolvedValue({ id: 10 } as never);

    const result = await createCampaign({
      name: "秋の頭皮ケアキャンペーン",
      discountType: "percentage",
      discountValue: 10,
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      priority: 0,
      storeIds: [1, 2],
      courseIds: [1, 2],
      categoryIds: [3],
    });

    expect(result).toEqual({ campaignId: 10 });
    expect(prisma.campaign.create).toHaveBeenCalledWith({
      data: {
        name: "秋の頭皮ケアキャンペーン",
        discountType: "percentage",
        discountValue: 10,
        startDate: new Date("2026-09-01T00:00:00.000Z"),
        endDate: new Date("2026-09-30T00:00:00.000Z"),
        priority: 0,
        isPublished: true,
        storeTargets: { create: [{ storeId: 1 }, { storeId: 2 }] },
        courseTargets: { create: [{ courseId: 1 }, { courseId: 2 }] },
        categoryTargets: { create: [{ categoryId: 3 }] },
      },
    });
  });
});

describe("updateCampaign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replaces campaign fields and targets, including store targets", async () => {
    vi.mocked(prisma.campaign.update).mockResolvedValue({} as never);

    await updateCampaign({
      campaignId: 1,
      name: "更新後キャンペーン",
      discountType: "fixed_amount",
      discountValue: 1000,
      startDate: "2026-10-01",
      endDate: "2026-10-31",
      priority: 1,
      storeIds: [2],
      courseIds: [4],
      categoryIds: [],
    });

    expect(prisma.campaign.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        name: "更新後キャンペーン",
        discountType: "fixed_amount",
        discountValue: 1000,
        startDate: new Date("2026-10-01T00:00:00.000Z"),
        endDate: new Date("2026-10-31T00:00:00.000Z"),
        priority: 1,
        storeTargets: { deleteMany: {}, create: [{ storeId: 2 }] },
        courseTargets: { deleteMany: {}, create: [{ courseId: 4 }] },
        categoryTargets: { deleteMany: {}, create: [] },
      },
    });
  });
});

describe("deleteCampaign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("unpublishes the campaign instead of deleting the row", async () => {
    vi.mocked(prisma.campaign.update).mockResolvedValue({} as never);

    await deleteCampaign(1);

    expect(prisma.campaign.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isPublished: false },
    });
  });
});

describe("republishCampaign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-publishes a previously deleted campaign", async () => {
    vi.mocked(prisma.campaign.update).mockResolvedValue({} as never);

    await republishCampaign(1);

    expect(prisma.campaign.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isPublished: true },
    });
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run app/actions/manage-campaigns.test.ts`
Expected: FAIL（`storeIds`/`storeNames`がまだ返っていない）

- [ ] **Step 3: 実装する**

`app/actions/manage-campaigns.ts`を以下の内容に置き換える：

```ts
"use server";

import { prisma } from "@/lib/db";
import type { DiscountType } from "@/lib/reservation/campaign-discount";

export interface CampaignListItem {
  id: number;
  name: string;
  discountType: DiscountType;
  discountValue: number;
  startDate: string;
  endDate: string;
  priority: number;
  isPublished: boolean;
  storeIds: number[];
  storeNames: string[];
  targetNames: string[];
  courseIds: number[];
  categoryIds: number[];
}

export const CAMPAIGN_PAGE_SIZE = 20;

export interface ListCampaignsParams {
  includeUnpublished?: boolean;
  page?: number;
}

export interface ListCampaignsResult {
  items: CampaignListItem[];
  totalCount: number;
}

export async function listCampaigns(params?: ListCampaignsParams): Promise<ListCampaignsResult> {
  const page = params?.page ?? 1;
  const where = params?.includeUnpublished ? {} : { isPublished: true };

  const [campaigns, totalCount] = await Promise.all([
    prisma.campaign.findMany({
      where,
      include: {
        storeTargets: { include: { store: true } },
        courseTargets: { include: { course: true } },
        categoryTargets: { include: { category: true } },
      },
      orderBy: { id: "desc" },
      skip: (page - 1) * CAMPAIGN_PAGE_SIZE,
      take: CAMPAIGN_PAGE_SIZE,
    }),
    prisma.campaign.count({ where }),
  ]);

  const items = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    discountType: c.discountType,
    discountValue: c.discountValue,
    startDate: c.startDate.toISOString().slice(0, 10),
    endDate: c.endDate.toISOString().slice(0, 10),
    priority: c.priority,
    isPublished: c.isPublished,
    storeIds: c.storeTargets.map((t) => t.storeId),
    storeNames:
      c.storeTargets.length > 0 ? c.storeTargets.map((t) => t.store.name) : ["全店舗"],
    targetNames: [
      ...c.courseTargets.map((t) => t.course.name),
      ...c.categoryTargets.map((t) => t.category.name),
    ],
    courseIds: c.courseTargets.map((t) => t.courseId),
    categoryIds: c.categoryTargets.map((t) => t.categoryId),
  }));

  return { items, totalCount };
}

export interface CreateCampaignParams {
  name: string;
  discountType: DiscountType;
  discountValue: number;
  startDate: string;
  endDate: string;
  priority: number;
  storeIds: number[];
  courseIds: number[];
  categoryIds: number[];
}

export async function createCampaign(
  params: CreateCampaignParams,
): Promise<{ campaignId: number }> {
  const campaign = await prisma.campaign.create({
    data: {
      name: params.name,
      discountType: params.discountType,
      discountValue: params.discountValue,
      startDate: new Date(`${params.startDate}T00:00:00.000Z`),
      endDate: new Date(`${params.endDate}T00:00:00.000Z`),
      priority: params.priority,
      isPublished: true,
      storeTargets: { create: params.storeIds.map((storeId) => ({ storeId })) },
      courseTargets: { create: params.courseIds.map((courseId) => ({ courseId })) },
      categoryTargets: { create: params.categoryIds.map((categoryId) => ({ categoryId })) },
    },
  });

  return { campaignId: campaign.id };
}

export interface UpdateCampaignParams {
  campaignId: number;
  name: string;
  discountType: DiscountType;
  discountValue: number;
  startDate: string;
  endDate: string;
  priority: number;
  storeIds: number[];
  courseIds: number[];
  categoryIds: number[];
}

export async function updateCampaign(params: UpdateCampaignParams): Promise<void> {
  await prisma.campaign.update({
    where: { id: params.campaignId },
    data: {
      name: params.name,
      discountType: params.discountType,
      discountValue: params.discountValue,
      startDate: new Date(`${params.startDate}T00:00:00.000Z`),
      endDate: new Date(`${params.endDate}T00:00:00.000Z`),
      priority: params.priority,
      storeTargets: {
        deleteMany: {},
        create: params.storeIds.map((storeId) => ({ storeId })),
      },
      courseTargets: {
        deleteMany: {},
        create: params.courseIds.map((courseId) => ({ courseId })),
      },
      categoryTargets: {
        deleteMany: {},
        create: params.categoryIds.map((categoryId) => ({ categoryId })),
      },
    },
  });
}

// 物理削除はせず、公開フラグを落として一覧から外す（論理削除）。
export async function deleteCampaign(campaignId: number): Promise<void> {
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { isPublished: false },
  });
}

// deleteCampaignで無効化したキャンペーンを再度有効化する（deactivateCustomer/reactivateCustomerと対になる操作）。
export async function republishCampaign(campaignId: number): Promise<void> {
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { isPublished: true },
  });
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run app/actions/manage-campaigns.test.ts`
Expected: PASS（8件）

- [ ] **Step 5: Commit**

```bash
git add app/actions/manage-campaigns.ts app/actions/manage-campaigns.test.ts
git commit -m "feat: replace single targetStoreId with multi-store storeIds/storeNames in campaigns

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 5: `campaigns/page.tsx` — 対象店舗の複数選択・対象コースのカテゴリ別グループ表示

**Files:**
- Modify: `app/admin/(dashboard)/campaigns/page.tsx`

**前提:** Phase A（Task 9）でこのページは既にページネーション対応済み。本タスクはその最終版の上に、対象店舗の単一`<select>`を複数選択のチェックボックス群に、対象コースのフラットなチェックボックス列をカテゴリ別グループ表示に変更する。

- [ ] **Step 1: `EMPTY_FORM`を更新する**

以下の行：
```tsx
const EMPTY_FORM = {
  name: "",
  discountType: "percentage" as "percentage" | "fixed_amount",
  discountValue: 10,
  startDate: "",
  endDate: "",
  priority: 0,
  targetStoreId: null as number | null,
  courseIds: [] as number[],
  categoryIds: [] as number[],
};
```
を以下に置き換える：
```tsx
const EMPTY_FORM = {
  name: "",
  discountType: "percentage" as "percentage" | "fixed_amount",
  discountValue: 10,
  startDate: "",
  endDate: "",
  priority: 0,
  storeIds: [] as number[],
  courseIds: [] as number[],
  categoryIds: [] as number[],
};
```

- [ ] **Step 2: `openEdit`を更新する**

以下の行：
```tsx
      targetStoreId: c.targetStoreId,
```
を以下に置き換える：
```tsx
      storeIds: c.storeIds,
```

- [ ] **Step 3: `toggleStore`関数を追加する**

`function toggleCourse(id: number) { ... }`の直前に以下を追加する：

```tsx
  function toggleStore(id: number) {
    setForm((f) => ({
      ...f,
      storeIds: f.storeIds.includes(id) ? f.storeIds.filter((s) => s !== id) : [...f.storeIds, id],
    }));
  }

```

- [ ] **Step 4: 一覧テーブルの「対象店舗」列を更新する**

以下の行：
```tsx
                <td className="p-3">{c.targetStoreName}</td>
```
を以下に置き換える：
```tsx
                <td className="p-3">{c.storeNames.join("、")}</td>
```

- [ ] **Step 5: モーダル内の対象店舗を複数選択に、対象コースをカテゴリ別グループ表示に変更する**

以下のブロック：
```tsx
          <select
            value={form.targetStoreId ?? ""}
            onChange={(e) =>
              setForm({ ...form, targetStoreId: e.target.value ? Number(e.target.value) : null })
            }
            className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
          >
            <option value="">全店舗</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <div>
            <p className="mb-1 text-sm text-neutral-600">対象カテゴリ</p>
            <div className="flex flex-wrap gap-3">
              {categories.map((cat) => (
                <label key={cat.id} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={form.categoryIds.includes(cat.id)}
                    onChange={() => toggleCategory(cat.id)}
                  />
                  {cat.name}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm text-neutral-600">対象コース</p>
            <div className="flex flex-wrap gap-3">
              {courses.map((course) => (
                <label key={course.id} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={form.courseIds.includes(course.id)}
                    onChange={() => toggleCourse(course.id)}
                  />
                  {course.name}
                </label>
              ))}
            </div>
          </div>
```
を以下に置き換える：
```tsx
          <div>
            <p className="mb-1 text-sm text-neutral-600">対象店舗（未選択の場合は全店舗が対象）</p>
            <div className="flex flex-wrap gap-3">
              {stores.map((s) => (
                <label key={s.id} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={form.storeIds.includes(s.id)}
                    onChange={() => toggleStore(s.id)}
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm text-neutral-600">対象カテゴリ</p>
            <div className="flex flex-wrap gap-3">
              {categories.map((cat) => (
                <label key={cat.id} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={form.categoryIds.includes(cat.id)}
                    onChange={() => toggleCategory(cat.id)}
                  />
                  {cat.name}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm text-neutral-600">対象コース</p>
            <div className="flex flex-col gap-2">
              {categories.map((cat) => (
                <div key={cat.id}>
                  <p className="mb-1 text-xs font-medium text-neutral-500">{cat.name}</p>
                  <div className="flex flex-wrap gap-3">
                    {courses
                      .filter((course) => course.categoryId === cat.id)
                      .map((course) => (
                        <label key={course.id} className="flex items-center gap-1 text-sm">
                          <input
                            type="checkbox"
                            checked={form.courseIds.includes(course.id)}
                            onChange={() => toggleCourse(course.id)}
                          />
                          {course.name}
                        </label>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
```

- [ ] **Step 6: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 7: 既存の関連テストが壊れていないことを確認する**

Run: `npx vitest run app/actions/manage-campaigns.test.ts`
Expected: 全件PASS

- [ ] **Step 8: Commit**

```bash
git add "app/admin/(dashboard)/campaigns/page.tsx"
git commit -m "feat: multi-select campaign target stores and group target courses by category

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 6: 最終検証

- [ ] **Step 1: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 2: Lint**

Run: `npx eslint .`
Expected: エラーなし

- [ ] **Step 3: 全テスト実行**

Run: `npx vitest run`
Expected: 既存テストを含め全件PASS

- [ ] **Step 4: ユーザーへの確認事項**

Task 1で案内した通り、マイグレーションファイルへのデータ移行SQL追加とマイグレーション適用が必要。

## 完了条件

- Task 1〜5のコミットが完了している
- `npx tsc --noEmit` / `npx eslint .` / `npx vitest run` がすべてエラーなしで通る
- ユーザーがマイグレーションを適用し、実機で対象店舗の複数選択・対象コースのカテゴリ別表示を確認する
