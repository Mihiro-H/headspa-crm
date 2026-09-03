# フォレスパ Phase 3: WEB予約フォームUI 第1弾（Step1〜4） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** WEB予約フォーム（M-02）のStep1〜4（店舗選択→カテゴリ選択→コース選択→オプション選択）を、実際にブラウザで操作できるUIとして実装する。スタッフ指名・日時選択・会員登録・確認・完了（Step5〜9）はPhase 4以降で扱う。

**Architecture:** データ取得は`app/actions/`のServer Actions（Prisma経由、TDD）。UIは`components/reservation/`配下のクライアントコンポーネント（React state管理、軽量検証＝tsc/eslintのみ）。単一の`ReservationWizard`コンテナがステップ状態を保持し、ページ遷移なしで4ステップを切り替える。

**Tech Stack:** Next.js App Router / TypeScript / Tailwind v4 + shadcn/ui / Prisma（既存Phase 0〜2基盤を使用）

**参照元資料:** `02_screenspecification.md`（M-02節）、`01_designtokens.md`

**このPhaseで作らないもの（Phase 4以降）:** スタッフ指名（Step5）、日時選択（Step6）、会員登録/ログイン（Step7）、確認画面（Step8）、完了画面（Step9）、実際のログインセッションとの結線（`memberGender`は暫定的に`null`固定）。

> **実行環境に関する注記（継承）:** `.git`書き込み不可（コミットは後回し）、`.env`系ファイル読み書き不可、`npm run build`は不安定（`tsc --noEmit`/`eslint`/`vitest`を使う）、Prisma CLIの`.env`読み込みはこのサンドボックス固有のバグがあるため実DB操作はユーザーのターミナルで行う。

---

## Task 1: 有効キャンペーン抽出ロジック（TDD）

**Files:**
- Create: `lib/reservation/active-campaigns.ts`
- Test: `lib/reservation/active-campaigns.test.ts`

- [x] **Step 1: 失敗するテストを書く**

`lib/reservation/active-campaigns.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { filterActiveCampaigns, type ActiveCampaignRow } from "./active-campaigns";

const today = new Date("2026-09-15T00:00:00Z");

function campaign(overrides: Partial<ActiveCampaignRow> = {}): ActiveCampaignRow {
  return {
    campaignId: 1,
    priority: 0,
    discountType: "percentage",
    discountValue: 10,
    startDate: new Date("2026-09-01T00:00:00Z"),
    endDate: new Date("2026-09-30T00:00:00Z"),
    isPublished: true,
    ...overrides,
  };
}

describe("filterActiveCampaigns", () => {
  it("includes a published campaign whose date range contains today", () => {
    const result = filterActiveCampaigns([campaign()], today);
    expect(result).toEqual([
      { campaignId: 1, priority: 0, discountType: "percentage", discountValue: 10 },
    ]);
  });

  it("excludes a campaign that hasn't started yet", () => {
    const result = filterActiveCampaigns(
      [campaign({ startDate: new Date("2026-10-01T00:00:00Z"), endDate: new Date("2026-10-31T00:00:00Z") })],
      today,
    );
    expect(result).toEqual([]);
  });

  it("excludes a campaign that has already ended", () => {
    const result = filterActiveCampaigns(
      [campaign({ startDate: new Date("2026-08-01T00:00:00Z"), endDate: new Date("2026-08-31T00:00:00Z") })],
      today,
    );
    expect(result).toEqual([]);
  });

  it("excludes an unpublished campaign", () => {
    const result = filterActiveCampaigns([campaign({ isPublished: false })], today);
    expect(result).toEqual([]);
  });

  it("includes campaigns on the exact boundary dates", () => {
    const result = filterActiveCampaigns(
      [campaign({ startDate: today, endDate: today })],
      today,
    );
    expect(result).toHaveLength(1);
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run lib/reservation/active-campaigns.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`lib/reservation/active-campaigns.ts`:

```typescript
import type { DiscountType } from "./campaign-discount";
import type { CandidateCampaign } from "./campaign-resolution";

export interface ActiveCampaignRow {
  campaignId: number;
  priority: number;
  discountType: DiscountType;
  discountValue: number;
  startDate: Date;
  endDate: Date;
  isPublished: boolean;
}

export function filterActiveCampaigns(
  campaigns: ActiveCampaignRow[],
  today: Date,
): CandidateCampaign[] {
  return campaigns
    .filter((c) => c.isPublished && c.startDate <= today && today <= c.endDate)
    .map((c) => ({
      campaignId: c.campaignId,
      priority: c.priority,
      discountType: c.discountType,
      discountValue: c.discountValue,
    }));
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run lib/reservation/active-campaigns.test.ts
```

Expected: PASS（5 tests）

- [x] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 2: 店舗一覧取得Server Action（TDD）

**Files:**
- Create: `app/actions/stores.ts`
- Test: `app/actions/stores.test.ts`

- [x] **Step 1: 失敗するテストを書く**

`app/actions/stores.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listStores } from "./stores";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    store: { findMany: vi.fn() },
  },
}));

describe("listStores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps stores to the list item shape, ordered by id", async () => {
    vi.mocked(prisma.store.findMany).mockResolvedValue([
      { id: 1, name: "フォレスパ 東京丸の内本店", address: "東京都千代田区...", phone: "03-0000-0001", nearestStation: "東京駅 徒歩5分" },
    ] as never);

    const result = await listStores();

    expect(result).toEqual([
      { id: 1, name: "フォレスパ 東京丸の内本店", address: "東京都千代田区...", phone: "03-0000-0001", nearestStation: "東京駅 徒歩5分" },
    ]);
    expect(prisma.store.findMany).toHaveBeenCalledWith({ orderBy: { id: "asc" } });
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run app/actions/stores.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`app/actions/stores.ts`:

```typescript
"use server";

import { prisma } from "@/lib/db";

export interface StoreListItem {
  id: number;
  name: string;
  address: string | null;
  phone: string;
  nearestStation: string | null;
}

export async function listStores(): Promise<StoreListItem[]> {
  const stores = await prisma.store.findMany({ orderBy: { id: "asc" } });
  return stores.map((s) => ({
    id: s.id,
    name: s.name,
    address: s.address,
    phone: s.phone,
    nearestStation: s.nearestStation,
  }));
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run app/actions/stores.test.ts
```

Expected: PASS（1 test）

- [x] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 3: コースカテゴリ一覧取得Server Action（TDD）

**Files:**
- Create: `app/actions/course-categories.ts`
- Test: `app/actions/course-categories.test.ts`

- [x] **Step 1: 失敗するテストを書く**

`app/actions/course-categories.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listCourseCategories } from "./course-categories";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    courseCategory: { findMany: vi.fn() },
  },
}));

describe("listCourseCategories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only published categories, ordered by sortOrder", async () => {
    vi.mocked(prisma.courseCategory.findMany).mockResolvedValue([
      { id: 1, name: "頭皮ケア重点", description: "こんな方へ..." },
    ] as never);

    const result = await listCourseCategories();

    expect(result).toEqual([{ id: 1, name: "頭皮ケア重点", description: "こんな方へ..." }]);
    expect(prisma.courseCategory.findMany).toHaveBeenCalledWith({
      where: { isPublished: true },
      orderBy: { sortOrder: "asc" },
    });
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run app/actions/course-categories.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`app/actions/course-categories.ts`:

```typescript
"use server";

import { prisma } from "@/lib/db";

export interface CourseCategoryListItem {
  id: number;
  name: string;
  description: string | null;
}

export async function listCourseCategories(): Promise<CourseCategoryListItem[]> {
  const categories = await prisma.courseCategory.findMany({
    where: { isPublished: true },
    orderBy: { sortOrder: "asc" },
  });
  return categories.map((c) => ({ id: c.id, name: c.name, description: c.description }));
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run app/actions/course-categories.test.ts
```

Expected: PASS（1 test）

- [x] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 4: コース一覧取得Server Action（キャンペーン価格反映、TDD）

**Files:**
- Create: `app/actions/courses.ts`
- Test: `app/actions/courses.test.ts`

**注記:** キャンペーンは店舗指定（`targetStoreId`）がある場合その店舗にのみ適用され、`null`なら全店舗共通。コース単位キャンペーン（`campaignTargets`）とカテゴリ単位キャンペーン（`category.campaignTargets`）の両方を候補として集め、`priceLineItem`（Phase 2で実装済み）に渡して最終価格を計算する。

- [x] **Step 1: 失敗するテストを書く**

`app/actions/courses.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listCoursesForCategory } from "./courses";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    course: { findMany: vi.fn() },
  },
}));

const now = new Date("2026-09-15T00:00:00Z");

describe("listCoursesForCategory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the original price when no campaign applies", async () => {
    vi.mocked(prisma.course.findMany).mockResolvedValue([
      {
        id: 1,
        name: "スタンダード",
        durationEstimateMin: 60,
        price: 8000,
        genderRestriction: "none",
        campaignTargets: [],
        category: { campaignTargets: [] },
      },
    ] as never);

    const result = await listCoursesForCategory(1, 1, now);

    expect(result).toEqual([
      {
        id: 1,
        name: "スタンダード",
        durationEstimateMin: 60,
        originalPrice: 8000,
        finalPrice: 8000,
        genderRestriction: "none",
      },
    ]);
  });

  it("applies an active store-wide course-level campaign", async () => {
    vi.mocked(prisma.course.findMany).mockResolvedValue([
      {
        id: 1,
        name: "スタンダード",
        durationEstimateMin: 60,
        price: 8000,
        genderRestriction: "none",
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
              targetStoreId: null,
            },
          },
        ],
        category: { campaignTargets: [] },
      },
    ] as never);

    const result = await listCoursesForCategory(1, 1, now);

    expect(result[0].originalPrice).toBe(8000);
    expect(result[0].finalPrice).toBe(7200);
  });

  it("ignores a campaign scoped to a different store", async () => {
    vi.mocked(prisma.course.findMany).mockResolvedValue([
      {
        id: 1,
        name: "スタンダード",
        durationEstimateMin: 60,
        price: 8000,
        genderRestriction: "none",
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
              targetStoreId: 2,
            },
          },
        ],
        category: { campaignTargets: [] },
      },
    ] as never);

    const result = await listCoursesForCategory(1, 1, now);

    expect(result[0].finalPrice).toBe(8000);
  });

  it("applies a category-level campaign", async () => {
    vi.mocked(prisma.course.findMany).mockResolvedValue([
      {
        id: 1,
        name: "スタンダード",
        durationEstimateMin: 60,
        price: 10000,
        genderRestriction: "none",
        campaignTargets: [],
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
                targetStoreId: null,
              },
            },
          ],
        },
      },
    ] as never);

    const result = await listCoursesForCategory(1, 1, now);

    expect(result[0].finalPrice).toBe(8500);
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run app/actions/courses.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`app/actions/courses.ts`:

```typescript
"use server";

import { prisma } from "@/lib/db";
import { filterActiveCampaigns, type ActiveCampaignRow } from "@/lib/reservation/active-campaigns";
import { priceLineItem } from "@/lib/reservation/total-price";
import type { GenderRestriction } from "@/lib/reservation/gender-restriction";

export interface CourseListItem {
  id: number;
  name: string;
  durationEstimateMin: number;
  originalPrice: number;
  finalPrice: number;
  genderRestriction: GenderRestriction;
}

interface RawCampaign extends ActiveCampaignRow {
  targetStoreId: number | null;
}

function eligibleForStore(campaigns: RawCampaign[], storeId: number): ActiveCampaignRow[] {
  return campaigns.filter((c) => c.targetStoreId === null || c.targetStoreId === storeId);
}

export async function listCoursesForCategory(
  categoryId: number,
  storeId: number,
  now: Date = new Date(),
): Promise<CourseListItem[]> {
  const courses = await prisma.course.findMany({
    where: { categoryId, isPublished: true },
    orderBy: { sortOrder: "asc" },
    include: {
      campaignTargets: { include: { campaign: true } },
      category: { include: { campaignTargets: { include: { campaign: true } } } },
    },
  });

  return courses.map((course) => {
    const courseCampaigns = course.campaignTargets.map((t) => t.campaign);
    const categoryCampaigns = course.category.campaignTargets.map((t) => t.campaign);
    const allCampaigns: RawCampaign[] = [...courseCampaigns, ...categoryCampaigns].map((c) => ({
      campaignId: c.id,
      priority: c.priority,
      discountType: c.discountType,
      discountValue: c.discountValue,
      startDate: c.startDate,
      endDate: c.endDate,
      isPublished: c.isPublished,
      targetStoreId: c.targetStoreId,
    }));

    const active = filterActiveCampaigns(eligibleForStore(allCampaigns, storeId), now);
    const priced = priceLineItem({ price: course.price, discountExempt: false, applicableCampaigns: active });

    return {
      id: course.id,
      name: course.name,
      durationEstimateMin: course.durationEstimateMin,
      originalPrice: priced.originalPrice,
      finalPrice: priced.finalPrice,
      genderRestriction: course.genderRestriction,
    };
  });
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run app/actions/courses.test.ts
```

Expected: PASS（4 tests）

- [x] **Step 5: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [x] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 5: オプション一覧取得Server Action（TDD）

**Files:**
- Create: `app/actions/options.ts`
- Test: `app/actions/options.test.ts`

**注記:** テーブル設計書上、キャンペーンはコース／カテゴリ単位のみに適用され、オプションは対象外（`campaign_course_targets`/`campaign_category_targets`のみ存在し、オプション向けの中間テーブルは無い）。そのためオプションは常に基本料金で表示する。

- [x] **Step 1: 失敗するテストを書く**

`app/actions/options.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listOptions } from "./options";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    option: { findMany: vi.fn() },
  },
}));

describe("listOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps options to the list item shape", async () => {
    vi.mocked(prisma.option.findMany).mockResolvedValue([
      {
        id: 1,
        name: "デコルテ・マッサージ",
        price: 1500,
        genderRestriction: "male",
        requiresAdvanceBooking: true,
        discountExempt: true,
      },
    ] as never);

    const result = await listOptions();

    expect(result).toEqual([
      {
        id: 1,
        name: "デコルテ・マッサージ",
        price: 1500,
        genderRestriction: "male",
        requiresAdvanceBooking: true,
        discountExempt: true,
      },
    ]);
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run app/actions/options.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`app/actions/options.ts`:

```typescript
"use server";

import { prisma } from "@/lib/db";
import type { GenderRestriction } from "@/lib/reservation/gender-restriction";

export interface OptionListItem {
  id: number;
  name: string;
  price: number;
  genderRestriction: GenderRestriction;
  requiresAdvanceBooking: boolean;
  discountExempt: boolean;
}

export async function listOptions(): Promise<OptionListItem[]> {
  const options = await prisma.option.findMany({ orderBy: { id: "asc" } });
  return options.map((o) => ({
    id: o.id,
    name: o.name,
    price: o.price,
    genderRestriction: o.genderRestriction,
    requiresAdvanceBooking: o.requiresAdvanceBooking,
    discountExempt: o.discountExempt,
  }));
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run app/actions/options.test.ts
```

Expected: PASS（1 test）

- [x] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 6: ウィザード進捗バーコンポーネント（軽量検証）

**Files:**
- Create: `components/reservation/wizard-progress.tsx`

**検証方針:** UIコンポーネントは`npx tsc --noEmit`・`npx eslint .`のみで検証する（自動UIテストは書かない）。

- [x] **Step 1: 実装する**

`components/reservation/wizard-progress.tsx`:

```tsx
interface WizardProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function WizardProgress({ currentStep, totalSteps }: WizardProgressProps) {
  const percent = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between text-xs text-neutral-500">
        <span>
          ステップ {currentStep} / {totalSteps}
        </span>
        <span>{percent}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full rounded-full bg-primary-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
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

---

## Task 7: Step1 店舗選択コンポーネント（軽量検証）

**Files:**
- Create: `components/reservation/store-select-step.tsx`

- [x] **Step 1: 実装する**

`components/reservation/store-select-step.tsx`:

```tsx
import type { StoreListItem } from "@/app/actions/stores";

interface StoreSelectStepProps {
  stores: StoreListItem[];
  onSelect: (storeId: number) => void;
}

export function StoreSelectStep({ stores, onSelect }: StoreSelectStepProps) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-heading text-xl text-primary-700">店舗を選択してください</h2>
      {stores.map((store) => (
        <button
          key={store.id}
          type="button"
          onClick={() => onSelect(store.id)}
          className="rounded-lg border border-neutral-200 bg-neutral-0 p-4 text-left shadow-sm transition-colors hover:border-primary-300"
        >
          <p className="font-medium text-neutral-800">{store.name}</p>
          {store.nearestStation && (
            <p className="mt-1 text-sm text-neutral-500">{store.nearestStation}</p>
          )}
          {store.address && <p className="mt-1 text-sm text-neutral-500">{store.address}</p>}
        </button>
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

---

## Task 8: Step2 カテゴリ選択コンポーネント（軽量検証）

**Files:**
- Create: `components/reservation/category-select-step.tsx`

- [x] **Step 1: 実装する**

`components/reservation/category-select-step.tsx`:

```tsx
import type { CourseCategoryListItem } from "@/app/actions/course-categories";

interface CategorySelectStepProps {
  categories: CourseCategoryListItem[];
  onSelect: (categoryId: number) => void;
}

export function CategorySelectStep({ categories, onSelect }: CategorySelectStepProps) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-heading text-xl text-primary-700">コースカテゴリを選択してください</h2>
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onSelect(category.id)}
          className="rounded-lg border border-neutral-200 bg-neutral-0 p-4 text-left shadow-sm transition-colors hover:border-primary-300"
        >
          <p className="font-medium text-neutral-800">{category.name}</p>
          {category.description && (
            <p className="mt-1 text-sm text-neutral-500">{category.description}</p>
          )}
        </button>
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

---

## Task 9: Step3 コース選択コンポーネント（軽量検証）

**Files:**
- Create: `components/reservation/course-select-step.tsx`

**注記:** 性別制限の判定は`lib/reservation/gender-restriction.ts`の`checkGenderRestriction`（Phase 2実装済み）を再利用する。独自に判定ロジックを書かないこと。ゲスト（`memberGender === null`）はまだ性別未登録なのでブロックせず選択を許可する（確定はStep7以降で最終チェックされる）。

- [x] **Step 1: 実装する**

`components/reservation/course-select-step.tsx`:

```tsx
import { checkGenderRestriction, type MemberGender } from "@/lib/reservation/gender-restriction";
import type { CourseListItem } from "@/app/actions/courses";

interface CourseSelectStepProps {
  courses: CourseListItem[];
  memberGender: MemberGender | null;
  onSelect: (courseId: number) => void;
}

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export function CourseSelectStep({ courses, memberGender, onSelect }: CourseSelectStepProps) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-heading text-xl text-primary-700">コースを選択してください</h2>
      {courses.map((course) => {
        const check =
          memberGender === null
            ? { allowed: true, warning: false }
            : checkGenderRestriction(course.genderRestriction, memberGender);
        const onSale = course.finalPrice < course.originalPrice;

        return (
          <button
            key={course.id}
            type="button"
            disabled={!check.allowed}
            onClick={() => onSelect(course.id)}
            className="rounded-lg border border-neutral-200 bg-neutral-0 p-4 text-left shadow-sm transition-colors hover:border-primary-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <p className="font-medium text-neutral-800">{course.name}</p>
            <p className="mt-1 text-sm text-neutral-500">目安 {course.durationEstimateMin}分</p>
            <p className="mt-2">
              {onSale && (
                <span className="mr-2 text-sm text-neutral-400 line-through">
                  {formatYen(course.originalPrice)}
                </span>
              )}
              <span
                className={onSale ? "font-medium text-accent-600" : "font-medium text-neutral-800"}
              >
                {formatYen(course.finalPrice)}
              </span>
            </p>
            {!check.allowed && (
              <p className="mt-1 text-sm text-error">このコースはご利用いただけません</p>
            )}
            {check.warning && (
              <p className="mt-1 text-sm text-warning">
                施術内容によってはご希望に添えない場合があります
              </p>
            )}
          </button>
        );
      })}
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

---

## Task 10: Step4 オプション選択コンポーネント（軽量検証）

**Files:**
- Create: `components/reservation/option-select-step.tsx`

**注記:** Task 9と同様、性別制限判定は`checkGenderRestriction`を再利用する。

- [x] **Step 1: 実装する**

`components/reservation/option-select-step.tsx`:

```tsx
import { checkGenderRestriction, type MemberGender } from "@/lib/reservation/gender-restriction";
import type { OptionListItem } from "@/app/actions/options";

interface OptionSelectStepProps {
  options: OptionListItem[];
  memberGender: MemberGender | null;
  selectedOptionIds: number[];
  onToggle: (optionId: number) => void;
  onNext: () => void;
}

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export function OptionSelectStep({
  options,
  memberGender,
  selectedOptionIds,
  onToggle,
  onNext,
}: OptionSelectStepProps) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-heading text-xl text-primary-700">
        オプションを選択してください（任意）
      </h2>
      {options.map((option) => {
        const check =
          memberGender === null
            ? { allowed: true, warning: false }
            : checkGenderRestriction(option.genderRestriction, memberGender);
        const selected = selectedOptionIds.includes(option.id);

        return (
          <label
            key={option.id}
            className={`flex items-start gap-3 rounded-lg border p-4 shadow-sm ${
              check.allowed
                ? "cursor-pointer border-neutral-200 bg-neutral-0"
                : "cursor-not-allowed border-neutral-200 bg-neutral-100 opacity-50"
            }`}
          >
            <input
              type="checkbox"
              className="mt-1"
              disabled={!check.allowed}
              checked={selected}
              onChange={() => onToggle(option.id)}
            />
            <div>
              <p className="font-medium text-neutral-800">
                {option.name}
                <span className="ml-2 text-sm text-neutral-500">{formatYen(option.price)}</span>
              </p>
              {option.requiresAdvanceBooking && (
                <p className="mt-1 text-xs text-neutral-500">事前予約が必要です</p>
              )}
              {option.discountExempt && (
                <p className="mt-1 text-xs text-neutral-500">オプション料金は割引対象外</p>
              )}
              {check.warning && (
                <p className="mt-1 text-xs text-warning">
                  施術内容によってはご希望に添えない場合があります
                </p>
              )}
            </div>
          </label>
        );
      })}
      <button
        type="button"
        onClick={onNext}
        className="mt-4 h-12 w-full rounded-lg bg-accent-500 font-medium text-white hover:bg-accent-600"
      >
        次へ
      </button>
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

---

## Task 11: ウィザードコンテナ＆ページルート（軽量検証）

**Files:**
- Create: `app/reserve/reservation-wizard.tsx`
- Create: `app/reserve/page.tsx`

**注記:** `memberGender`は暫定的に`null`固定（ゲスト扱い）とする。実際のログインセッションとの結線はPhase 4（会員登録/ログイン画面実装時）に行う。Step5以降（スタッフ指名・日時選択・会員登録・確認・完了）は本タスクでは未実装のプレースホルダー表示とする。

- [x] **Step 1: ウィザードコンテナを実装する**

`app/reserve/reservation-wizard.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { WizardProgress } from "@/components/reservation/wizard-progress";
import { StoreSelectStep } from "@/components/reservation/store-select-step";
import { CategorySelectStep } from "@/components/reservation/category-select-step";
import { CourseSelectStep } from "@/components/reservation/course-select-step";
import { OptionSelectStep } from "@/components/reservation/option-select-step";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { listCourseCategories, type CourseCategoryListItem } from "@/app/actions/course-categories";
import { listCoursesForCategory, type CourseListItem } from "@/app/actions/courses";
import { listOptions, type OptionListItem } from "@/app/actions/options";
import type { MemberGender } from "@/lib/reservation/gender-restriction";

const TOTAL_STEPS = 9;

interface WizardState {
  step: number;
  storeId: number | null;
  categoryId: number | null;
  courseId: number | null;
  optionIds: number[];
}

export function ReservationWizard({ memberGender }: { memberGender: MemberGender | null }) {
  const [state, setState] = useState<WizardState>({
    step: 1,
    storeId: null,
    categoryId: null,
    courseId: null,
    optionIds: [],
  });
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [categories, setCategories] = useState<CourseCategoryListItem[]>([]);
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [options, setOptions] = useState<OptionListItem[]>([]);

  useEffect(() => {
    listStores().then(setStores);
  }, []);

  useEffect(() => {
    listCourseCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (state.step === 3 && state.categoryId !== null && state.storeId !== null) {
      listCoursesForCategory(state.categoryId, state.storeId).then(setCourses);
    }
  }, [state.step, state.categoryId, state.storeId]);

  useEffect(() => {
    if (state.step === 4) {
      listOptions().then(setOptions);
    }
  }, [state.step]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 p-4">
      <WizardProgress currentStep={state.step} totalSteps={TOTAL_STEPS} />

      {state.step === 1 && (
        <StoreSelectStep
          stores={stores}
          onSelect={(storeId) => setState((s) => ({ ...s, storeId, step: 2 }))}
        />
      )}

      {state.step === 2 && (
        <CategorySelectStep
          categories={categories}
          onSelect={(categoryId) => setState((s) => ({ ...s, categoryId, step: 3 }))}
        />
      )}

      {state.step === 3 && (
        <CourseSelectStep
          courses={courses}
          memberGender={memberGender}
          onSelect={(courseId) => setState((s) => ({ ...s, courseId, step: 4 }))}
        />
      )}

      {state.step === 4 && (
        <OptionSelectStep
          options={options}
          memberGender={memberGender}
          selectedOptionIds={state.optionIds}
          onToggle={(optionId) =>
            setState((s) => ({
              ...s,
              optionIds: s.optionIds.includes(optionId)
                ? s.optionIds.filter((id) => id !== optionId)
                : [...s.optionIds, optionId],
            }))
          }
          onNext={() => setState((s) => ({ ...s, step: 5 }))}
        />
      )}

      {state.step >= 5 && (
        <p className="text-center text-sm text-neutral-500">
          スタッフ指名・日時選択・会員登録・確認・完了はPhase 4で実装予定です。
        </p>
      )}
    </div>
  );
}
```

- [x] **Step 2: ページルートを実装する**

`app/reserve/page.tsx`:

```tsx
import { ReservationWizard } from "./reservation-wizard";

export default function ReservePage() {
  return <ReservationWizard memberGender={null} />;
}
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

Expected: Phase 0〜2の既存テスト＋本Phaseの新規テスト（Task1〜5合計12テスト）が全てパスする

- [x] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## 完了確認チェックリスト

- [x] `npx vitest run` の全テストがパスする
- [x] `npx tsc --noEmit` がエラーなく通る
- [x] `npx eslint .` がエラーなく通る
- [x] `/reserve`ページで店舗選択→カテゴリ選択→コース選択（キャンペーン価格の取消線表示含む）→オプション選択の4ステップが動作することをユーザーがブラウザで確認する（`npm run dev`はこのサンドボックスでは起動確認できないため、ユーザーのターミナルで確認する）
