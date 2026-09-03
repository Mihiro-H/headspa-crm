# フォレスパ Phase 9: メニュー・料金・キャンペーン管理（A-14） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 管理画面のA-14（メニュー・料金・キャンペーン管理）を実装する。コース料金の編集と、キャンペーンの一覧・新規作成ができるようにする。

**Architecture:** 既存の`app/admin/(dashboard)/`配下に新しいページを追加する。キャンペーンの対象（コース単位／カテゴリ単位）はチェックボックスで複数選択できるようにする。

**Tech Stack:** Next.js App Router / TypeScript / Tailwind v4（既存Phase 0〜8基盤を使用）

**参照元資料:** `02_screenspecification.md`（A-14節）、`04_tabledesign.md`（campaigns関連テーブル）

**このPhaseで作らないもの:** コースカテゴリ・オプションの新規作成/削除（既存データの価格編集のみとする）、変更履歴ログ、キャンペーンの編集・削除（新規作成のみ）。

> **実行環境に関する注記（継承）:** `.git`書き込み不可（コミットは後回し）、`.env`系ファイル読み書き不可、`npm run build`/`npm run dev`は不安定（`tsc --noEmit`/`eslint`/`vitest`を使う）。UIコンポーネントは軽量検証（tsc/eslintのみ）、データ取得・更新系Server ActionsはTDD。

---

## Task 1: コース料金一覧取得・更新Server Action（TDD）

**Files:**
- Create: `app/actions/manage-courses.ts`
- Test: `app/actions/manage-courses.test.ts`

- [x] **Step 1: 失敗するテストを書く**

`app/actions/manage-courses.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listAllCoursesForManagement, updateCoursePrice } from "./manage-courses";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    course: { findMany: vi.fn(), update: vi.fn() },
  },
}));

describe("listAllCoursesForManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all courses with category name, ordered by category then course sort order", async () => {
    vi.mocked(prisma.course.findMany).mockResolvedValue([
      {
        id: 1,
        name: "スタンダード",
        price: 8000,
        durationEstimateMin: 60,
        genderRestriction: "none",
        isPublished: true,
        category: { id: 3, name: "頭皮ケア重点" },
      },
    ] as never);

    const result = await listAllCoursesForManagement();

    expect(result).toEqual([
      {
        id: 1,
        name: "スタンダード",
        price: 8000,
        durationEstimateMin: 60,
        genderRestriction: "none",
        isPublished: true,
        categoryId: 3,
        categoryName: "頭皮ケア重点",
      },
    ]);
    expect(prisma.course.findMany).toHaveBeenCalledWith({
      include: { category: true },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    });
  });
});

describe("updateCoursePrice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates the course price", async () => {
    vi.mocked(prisma.course.update).mockResolvedValue({} as never);

    await updateCoursePrice({ courseId: 1, price: 9000 });

    expect(prisma.course.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { price: 9000 },
    });
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run app/actions/manage-courses.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`app/actions/manage-courses.ts`:

```typescript
"use server";

import { prisma } from "@/lib/db";
import type { GenderRestriction } from "@/lib/reservation/gender-restriction";

export interface ManagedCourse {
  id: number;
  name: string;
  price: number;
  durationEstimateMin: number;
  genderRestriction: GenderRestriction;
  isPublished: boolean;
  categoryId: number;
  categoryName: string;
}

export async function listAllCoursesForManagement(): Promise<ManagedCourse[]> {
  const courses = await prisma.course.findMany({
    include: { category: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });

  return courses.map((c) => ({
    id: c.id,
    name: c.name,
    price: c.price,
    durationEstimateMin: c.durationEstimateMin,
    genderRestriction: c.genderRestriction,
    isPublished: c.isPublished,
    categoryId: c.category.id,
    categoryName: c.category.name,
  }));
}

export interface UpdateCoursePriceParams {
  courseId: number;
  price: number;
}

export async function updateCoursePrice(params: UpdateCoursePriceParams): Promise<void> {
  await prisma.course.update({
    where: { id: params.courseId },
    data: { price: params.price },
  });
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run app/actions/manage-courses.test.ts
```

Expected: PASS（2 tests）

- [x] **Step 5: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [x] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 2: キャンペーン一覧取得・新規作成Server Action（TDD）

**Files:**
- Create: `app/actions/manage-campaigns.ts`
- Test: `app/actions/manage-campaigns.test.ts`

**注記:** 確定事項：優先順位(`priority`)が高い方を採用。テーブル設計書に忠実に、`discountType`・`discountValue`・`priority`・期間・対象店舗・対象（コース複数／カテゴリ複数）をそのまま保存する。

- [x] **Step 1: 失敗するテストを書く**

`app/actions/manage-campaigns.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listCampaigns, createCampaign } from "./manage-campaigns";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    campaign: { findMany: vi.fn(), create: vi.fn() },
  },
}));

describe("listCampaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns campaigns with target names and store scope", async () => {
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
        targetStore: null,
        courseTargets: [{ course: { name: "スタンダード" } }],
        categoryTargets: [],
      },
    ] as never);

    const result = await listCampaigns();

    expect(result).toEqual([
      {
        id: 1,
        name: "秋の頭皮ケアキャンペーン",
        discountType: "percentage",
        discountValue: 10,
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        priority: 0,
        isPublished: true,
        targetStoreName: "全店舗",
        targetNames: ["スタンダード"],
      },
    ]);
  });
});

describe("createCampaign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a campaign with course and category targets", async () => {
    vi.mocked(prisma.campaign.create).mockResolvedValue({ id: 10 } as never);

    const result = await createCampaign({
      name: "秋の頭皮ケアキャンペーン",
      discountType: "percentage",
      discountValue: 10,
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      priority: 0,
      targetStoreId: null,
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
        targetStoreId: null,
        isPublished: true,
        courseTargets: { create: [{ courseId: 1 }, { courseId: 2 }] },
        categoryTargets: { create: [{ categoryId: 3 }] },
      },
    });
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run app/actions/manage-campaigns.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`app/actions/manage-campaigns.ts`:

```typescript
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
  targetStoreName: string;
  targetNames: string[];
}

export async function listCampaigns(): Promise<CampaignListItem[]> {
  const campaigns = await prisma.campaign.findMany({
    include: {
      targetStore: true,
      courseTargets: { include: { course: true } },
      categoryTargets: { include: { category: true } },
    },
    orderBy: { id: "desc" },
  });

  return campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    discountType: c.discountType,
    discountValue: c.discountValue,
    startDate: c.startDate.toISOString().slice(0, 10),
    endDate: c.endDate.toISOString().slice(0, 10),
    priority: c.priority,
    isPublished: c.isPublished,
    targetStoreName: c.targetStore?.name ?? "全店舗",
    targetNames: [
      ...c.courseTargets.map((t) => t.course.name),
      ...c.categoryTargets.map((t) => t.category.name),
    ],
  }));
}

export interface CreateCampaignParams {
  name: string;
  discountType: DiscountType;
  discountValue: number;
  startDate: string;
  endDate: string;
  priority: number;
  targetStoreId: number | null;
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
      targetStoreId: params.targetStoreId,
      isPublished: true,
      courseTargets: { create: params.courseIds.map((courseId) => ({ courseId })) },
      categoryTargets: { create: params.categoryIds.map((categoryId) => ({ categoryId })) },
    },
  });

  return { campaignId: campaign.id };
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run app/actions/manage-campaigns.test.ts
```

Expected: PASS（2 tests）

- [x] **Step 5: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [x] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 3: メニュー料金編集UI（軽量検証）

**Files:**
- Create: `app/admin/(dashboard)/menu/page.tsx`

- [x] **Step 1: 実装する**

`app/admin/(dashboard)/menu/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  listAllCoursesForManagement,
  updateCoursePrice,
  type ManagedCourse,
} from "@/app/actions/manage-courses";

export default function AdminMenuPage() {
  const [courses, setCourses] = useState<ManagedCourse[]>([]);
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    listAllCoursesForManagement().then(setCourses);
  }, []);

  async function handleSave(courseId: number, price: number) {
    setSaving(courseId);
    await updateCoursePrice({ courseId, price });
    setSaving(null);
  }

  const grouped = courses.reduce<Record<string, ManagedCourse[]>>((acc, c) => {
    acc[c.categoryName] = acc[c.categoryName] ?? [];
    acc[c.categoryName].push(c);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl text-primary-700">メニュー・料金管理</h1>

      {Object.entries(grouped).map(([categoryName, items]) => (
        <div key={categoryName} className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-neutral-600">{categoryName}</h2>
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500">
                  <th className="p-3">コース名</th>
                  <th className="p-3">所要時間</th>
                  <th className="p-3">料金（税込）</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="border-b border-neutral-100 last:border-0">
                    <td className="p-3">{c.name}</td>
                    <td className="p-3">{c.durationEstimateMin}分</td>
                    <td className="p-3">
                      <input
                        type="number"
                        min={0}
                        defaultValue={c.price}
                        onBlur={(e) => handleSave(c.id, Number(e.target.value))}
                        className="h-9 w-28 rounded-md border border-neutral-300 px-2"
                      />
                    </td>
                    <td className="p-3 text-xs text-neutral-500">
                      {saving === c.id ? "保存中..." : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [x] **Step 2: 型チェックとLintを実行する**

```bash
npx tsc --noEmit
npx eslint .
```

- [x] **Step 3: 変更ファイルを報告する（コミットしない）**

> **実装時の修正:** 上記コードの`formatYen`関数はこの画面では未使用（価格は`<input type="number">`にそのまま表示するため）。ESLintの`no-unused-vars`に抵触するため、サブエージェントが`eslint-disable`で回避したが、実際には使われない関数なので単純に削除した（挙動への影響なし）。

---

## Task 4: キャンペーン管理UI（軽量検証）

**Files:**
- Create: `app/admin/(dashboard)/campaigns/page.tsx`

**注記:** 対象コース・カテゴリの選択は既存の`listCourseCategories`（コース一覧はカテゴリごとに`listCoursesForCategory`を呼ぶのではなく、店舗非依存の全コース一覧が必要なため`listAllCoursesForManagement`（Task1実装済み）を再利用する）。

- [x] **Step 1: 実装する**

`app/admin/(dashboard)/campaigns/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { listCampaigns, createCampaign, type CampaignListItem } from "@/app/actions/manage-campaigns";
import { listAllCoursesForManagement, type ManagedCourse } from "@/app/actions/manage-courses";
import { listCourseCategories, type CourseCategoryListItem } from "@/app/actions/course-categories";
import { listStores, type StoreListItem } from "@/app/actions/stores";

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [courses, setCourses] = useState<ManagedCourse[]>([]);
  const [categories, setCategories] = useState<CourseCategoryListItem[]>([]);
  const [stores, setStores] = useState<StoreListItem[]>([]);

  const [name, setName] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed_amount">("percentage");
  const [discountValue, setDiscountValue] = useState(10);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [priority, setPriority] = useState(0);
  const [targetStoreId, setTargetStoreId] = useState<number | null>(null);
  const [courseIds, setCourseIds] = useState<number[]>([]);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function reload() {
    listCampaigns().then(setCampaigns);
  }

  useEffect(() => {
    reload();
    listAllCoursesForManagement().then(setCourses);
    listCourseCategories().then(setCategories);
    listStores().then(setStores);
  }, []);

  async function handleSubmit() {
    setSubmitting(true);
    await createCampaign({
      name,
      discountType,
      discountValue,
      startDate,
      endDate,
      priority,
      targetStoreId,
      courseIds,
      categoryIds,
    });
    setSubmitting(false);
    setName("");
    setCourseIds([]);
    setCategoryIds([]);
    reload();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl text-primary-700">キャンペーン管理</h1>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="p-3">キャンペーン名</th>
              <th className="p-3">割引</th>
              <th className="p-3">期間</th>
              <th className="p-3">対象店舗</th>
              <th className="p-3">対象</th>
              <th className="p-3">優先度</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-b border-neutral-100 last:border-0">
                <td className="p-3">{c.name}</td>
                <td className="p-3">
                  {c.discountType === "percentage" ? `${c.discountValue}%` : formatYen(c.discountValue)}
                </td>
                <td className="p-3">
                  {c.startDate} 〜 {c.endDate}
                </td>
                <td className="p-3">{c.targetStoreName}</td>
                <td className="p-3">{c.targetNames.join("、") || "—"}</td>
                <td className="p-3">{c.priority}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {campaigns.length === 0 && (
          <p className="p-6 text-center text-sm text-neutral-500">キャンペーンがありません。</p>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-sm">
        <h2 className="font-heading text-lg text-primary-700">新規キャンペーン作成</h2>

        <input
          type="text"
          placeholder="キャンペーン名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        />

        <div className="flex gap-3">
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as "percentage" | "fixed_amount")}
            className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
          >
            <option value="percentage">定率（%）</option>
            <option value="fixed_amount">定額（円）</option>
          </select>
          <input
            type="number"
            min={0}
            value={discountValue}
            onChange={(e) => setDiscountValue(Number(e.target.value))}
            className="h-10 w-32 rounded-md border border-neutral-300 px-3 text-sm"
          />
        </div>

        <div className="flex gap-3">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm text-neutral-600">優先度</label>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="h-10 w-24 rounded-md border border-neutral-300 px-3 text-sm"
          />
        </div>

        <select
          value={targetStoreId ?? ""}
          onChange={(e) => setTargetStoreId(e.target.value ? Number(e.target.value) : null)}
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
                  checked={categoryIds.includes(cat.id)}
                  onChange={() =>
                    setCategoryIds((ids) =>
                      ids.includes(cat.id) ? ids.filter((id) => id !== cat.id) : [...ids, cat.id],
                    )
                  }
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
                  checked={courseIds.includes(course.id)}
                  onChange={() =>
                    setCourseIds((ids) =>
                      ids.includes(course.id)
                        ? ids.filter((id) => id !== course.id)
                        : [...ids, course.id],
                    )
                  }
                />
                {course.name}
              </label>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={submitting || !name || !startDate || !endDate}
          onClick={handleSubmit}
          className="h-12 rounded-lg bg-accent-500 font-medium text-white disabled:opacity-50"
        >
          キャンペーンを作成する
        </button>
      </div>
    </div>
  );
}
```

- [x] **Step 2: サイドバーにリンクを追加する**

`app/admin/(dashboard)/layout.tsx`の`<nav>`内、「電話予約登録」リンクの後に以下を追加する:

```tsx
          <Link
            href="/admin/menu"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            メニュー・料金管理
          </Link>
          <Link
            href="/admin/campaigns"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            キャンペーン管理
          </Link>
```

- [x] **Step 3: 型チェックとLintを実行する**

```bash
npx tsc --noEmit
npx eslint .
```

- [x] **Step 4: 全テストスイートを実行する**

```bash
npx vitest run
```

Expected: 既存の128テスト＋新規4テスト（Task1×2, Task2×2）＝132テストがパスする

- [x] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## 完了確認チェックリスト

- [x] `npx vitest run` の全テストがパスする
- [x] `npx tsc --noEmit` がエラーなく通る
- [x] `npx eslint .` がエラーなく通る
- [x] `/admin/menu`でコース料金編集、`/admin/campaigns`でキャンペーン一覧・新規作成をユーザーがブラウザで確認する（`npm run dev`はこのサンドボックスでは起動確認できないため、ユーザーのターミナルで確認する）
