# フォレスパ Phase 4: スタッフ指名・日時選択UI（Step5〜6） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** WEB予約フォーム（M-02）のStep5（スタッフ指名）・Step6（日時選択）を実装し、日時選択と同時にPhase 2で実装済みの`createTempHoldReservation`を呼び出して仮予約を作成する。

**Architecture:** Step5はスタッフ一覧取得Server Action（新規、TDD）＋シンプルな選択UI。Step6は既存の`getAvailableSlots`（Phase 2実装済み）を呼び出し、選択した日付の空き時間枠をボタングリッドで表示する。時間枠をタップしたら`createTempHoldReservation`（Phase 2実装済み）を呼び出し、返ってきた`reservationId`をウィザード状態に保持してStep7へ進む。

**Tech Stack:** Next.js App Router / TypeScript / Tailwind v4（既存Phase 0〜3基盤を使用）

**参照元資料:** `02_screenspecification.md`（M-02節 Step5・Step6）

**このPhaseで作らないもの（Phase 5以降）:** 会員登録/ログイン（Step7）、確認画面（Step8）、完了画面（Step9）。

> **実行環境に関する注記（継承）:** `.git`書き込み不可（コミットは後回し）、`.env`系ファイル読み書き不可、`npm run build`/`npm run dev`は不安定（`tsc --noEmit`/`eslint`/`vitest`を使う）。UIコンポーネントは軽量検証（tsc/eslintのみ）、データ取得Server ActionsはTDD、という前Phaseの方針を踏襲する。

---

## Task 1: スタッフ一覧取得Server Action（TDD）

**Files:**
- Create: `app/actions/staff.ts`
- Test: `app/actions/staff.test.ts`

- [x] **Step 1: 失敗するテストを書く**

`app/actions/staff.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listStaffForStore } from "./staff";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    staff: { findMany: vi.fn() },
  },
}));

describe("listStaffForStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only active staff for the given store", async () => {
    vi.mocked(prisma.staff.findMany).mockResolvedValue([
      { id: 1, name: "田中 花子", photoUrl: null, bio: "得意メニュー：頭皮ケア", nominationFee: 1000 },
    ] as never);

    const result = await listStaffForStore(2);

    expect(result).toEqual([
      { id: 1, name: "田中 花子", photoUrl: null, bio: "得意メニュー：頭皮ケア", nominationFee: 1000 },
    ]);
    expect(prisma.staff.findMany).toHaveBeenCalledWith({
      where: { storeId: 2, isActive: true },
      orderBy: { id: "asc" },
    });
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run app/actions/staff.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`app/actions/staff.ts`:

```typescript
"use server";

import { prisma } from "@/lib/db";

export interface StaffListItem {
  id: number;
  name: string;
  photoUrl: string | null;
  bio: string | null;
  nominationFee: number;
}

export async function listStaffForStore(storeId: number): Promise<StaffListItem[]> {
  const staff = await prisma.staff.findMany({
    where: { storeId, isActive: true },
    orderBy: { id: "asc" },
  });
  return staff.map((s) => ({
    id: s.id,
    name: s.name,
    photoUrl: s.photoUrl,
    bio: s.bio,
    nominationFee: s.nominationFee,
  }));
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run app/actions/staff.test.ts
```

Expected: PASS（1 test）

- [x] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 2: Step5 スタッフ指名コンポーネント（軽量検証）

**Files:**
- Create: `components/reservation/staff-select-step.tsx`

- [x] **Step 1: 実装する**

`components/reservation/staff-select-step.tsx`:

```tsx
import type { StaffListItem } from "@/app/actions/staff";

interface StaffSelectStepProps {
  staff: StaffListItem[];
  onSelect: (staffId: number | null) => void;
}

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export function StaffSelectStep({ staff, onSelect }: StaffSelectStepProps) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-heading text-xl text-primary-700">スタッフを指名しますか？</h2>
      <button
        type="button"
        onClick={() => onSelect(null)}
        className="rounded-lg border border-primary-300 bg-primary-50 p-4 text-left shadow-sm"
      >
        <p className="font-medium text-neutral-800">指名なし（自動割当）</p>
      </button>
      {staff.map((member) => (
        <button
          key={member.id}
          type="button"
          onClick={() => onSelect(member.id)}
          className="rounded-lg border border-neutral-200 bg-neutral-0 p-4 text-left shadow-sm transition-colors hover:border-primary-300"
        >
          <p className="font-medium text-neutral-800">{member.name}</p>
          {member.bio && <p className="mt-1 text-sm text-neutral-500">{member.bio}</p>}
          {member.nominationFee > 0 && (
            <p className="mt-1 text-sm text-accent-600">
              指名料 {formatYen(member.nominationFee)}
            </p>
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

## Task 3: Step6 日時選択コンポーネント（軽量検証）

**Files:**
- Create: `components/reservation/date-time-select-step.tsx`

**注記:** `getAvailableSlots`（`app/actions/availability.ts`）と`minutesToLabel`（`lib/reservation/time.ts`）はPhase 2で実装済み。再利用し、独自に空き判定ロジックを書かないこと。

- [x] **Step 1: 実装する**

`components/reservation/date-time-select-step.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { getAvailableSlots } from "@/app/actions/availability";
import { minutesToLabel } from "@/lib/reservation/time";

interface DateTimeSelectStepProps {
  storeId: number;
  staffId: number | null;
  courseId: number;
  optionIds: number[];
  onSelect: (date: string, startMinutes: number) => void;
}

function nextDates(count: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 1; i <= count; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export function DateTimeSelectStep({
  storeId,
  staffId,
  courseId,
  optionIds,
  onSelect,
}: DateTimeSelectStepProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const dates = nextDates(14);

  useEffect(() => {
    if (!selectedDate) return;
    // Standard data-fetch-on-dependency-change pattern: always re-fetches (no
    // caching), so switching store/staff/course/options/date never shows stale
    // availability.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    getAvailableSlots({ storeId, staffId, date: selectedDate, courseId, optionIds })
      .then(setSlots)
      .finally(() => setLoading(false));
  }, [selectedDate, storeId, staffId, courseId, optionIds]);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-heading text-xl text-primary-700">日時を選択してください</h2>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {dates.map((date) => (
          <button
            key={date}
            type="button"
            onClick={() => setSelectedDate(date)}
            className={`shrink-0 rounded-lg border px-3 py-2 text-sm ${
              selectedDate === date
                ? "border-primary-500 bg-primary-500 text-white"
                : "border-neutral-200 bg-neutral-0 text-neutral-700"
            }`}
          >
            {date.slice(5).replace("-", "/")}
          </button>
        ))}
      </div>

      {selectedDate && (
        <div className="grid grid-cols-3 gap-2">
          {loading && (
            <p className="col-span-3 text-center text-sm text-neutral-500">読み込み中...</p>
          )}
          {!loading && slots.length === 0 && (
            <p className="col-span-3 text-center text-sm text-neutral-500">空き枠がありません</p>
          )}
          {!loading &&
            slots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => onSelect(selectedDate, slot)}
                className="rounded-lg border border-neutral-200 bg-neutral-0 py-2 text-sm text-neutral-800 hover:border-primary-300"
              >
                {minutesToLabel(slot)}
              </button>
            ))}
        </div>
      )}
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

> **実装時の修正:** 上記コードの`setLoading(true)`はESLintの`react-hooks/set-state-in-effect`ルールに実際に抵触する（有効なエラー）。サブエージェントが最初にこれを日付ごとのキャッシュ（`slotsByDate`）で「回避」しようとしたが、これはスタッフ/コースを変更して同じ日付に戻った際に古い空き状況を表示してしまう新たなバグを生んだため差し戻した。正しい最小限の対応は、キャッシュを導入せず`eslint-disable-next-line react-hooks/set-state-in-effect`をピンポイントで付与すること（このデータ取得パターンはキャッシュしないため古いデータを表示するリスクが無いことをコメントで明記）。

---

## Task 4: ウィザードへの統合（軽量検証）

**Files:**
- Modify: `app/reserve/reservation-wizard.tsx`

**注記:** 日時選択（Step6）で時間枠がタップされたら、Phase 2実装済みの`createTempHoldReservation`を呼び出して仮予約（`temp_hold`）を作成する。作成に成功したら`reservationId`をウィザード状態に保持しStep7へ進む。`slot_unavailable`が返ってきた場合はエラーメッセージを表示しStep6に留まる（他のユーザーに先に予約された場合）。

- [x] **Step 1: `app/reserve/reservation-wizard.tsx`を以下の内容に置き換える**

```tsx
"use client";

import { useEffect, useState } from "react";
import { WizardProgress } from "@/components/reservation/wizard-progress";
import { StoreSelectStep } from "@/components/reservation/store-select-step";
import { CategorySelectStep } from "@/components/reservation/category-select-step";
import { CourseSelectStep } from "@/components/reservation/course-select-step";
import { OptionSelectStep } from "@/components/reservation/option-select-step";
import { StaffSelectStep } from "@/components/reservation/staff-select-step";
import { DateTimeSelectStep } from "@/components/reservation/date-time-select-step";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { listCourseCategories, type CourseCategoryListItem } from "@/app/actions/course-categories";
import { listCoursesForCategory, type CourseListItem } from "@/app/actions/courses";
import { listOptions, type OptionListItem } from "@/app/actions/options";
import { listStaffForStore, type StaffListItem } from "@/app/actions/staff";
import { createTempHoldReservation } from "@/app/actions/create-temp-hold";
import type { MemberGender } from "@/lib/reservation/gender-restriction";

const TOTAL_STEPS = 9;

interface WizardState {
  step: number;
  storeId: number | null;
  categoryId: number | null;
  courseId: number | null;
  optionIds: number[];
  staffId: number | null;
  reservationId: number | null;
  errorMessage: string | null;
}

export function ReservationWizard({ memberGender }: { memberGender: MemberGender | null }) {
  const [state, setState] = useState<WizardState>({
    step: 1,
    storeId: null,
    categoryId: null,
    courseId: null,
    optionIds: [],
    staffId: null,
    reservationId: null,
    errorMessage: null,
  });
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [categories, setCategories] = useState<CourseCategoryListItem[]>([]);
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [options, setOptions] = useState<OptionListItem[]>([]);
  const [staff, setStaff] = useState<StaffListItem[]>([]);

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

  useEffect(() => {
    if (state.step === 5 && state.storeId !== null) {
      listStaffForStore(state.storeId).then(setStaff);
    }
  }, [state.step, state.storeId]);

  async function handleDateTimeSelect(date: string, startMinutes: number) {
    if (state.storeId === null || state.courseId === null) return;

    const result = await createTempHoldReservation({
      storeId: state.storeId,
      staffId: state.staffId,
      courseId: state.courseId,
      optionIds: state.optionIds,
      reservationDate: date,
      startMinutes,
    });

    if (result.status === "slot_unavailable") {
      setState((s) => ({
        ...s,
        errorMessage: "選択した時間枠は他のお客様に予約されました。別の時間をお選びください。",
      }));
      return;
    }

    setState((s) => ({
      ...s,
      reservationId: result.reservationId,
      step: 7,
      errorMessage: null,
    }));
  }

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

      {state.step === 5 && (
        <StaffSelectStep
          staff={staff}
          onSelect={(staffId) => setState((s) => ({ ...s, staffId, step: 6 }))}
        />
      )}

      {state.step === 6 && state.storeId !== null && state.courseId !== null && (
        <div className="flex flex-col gap-3">
          {state.errorMessage && (
            <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{state.errorMessage}</p>
          )}
          <DateTimeSelectStep
            storeId={state.storeId}
            staffId={state.staffId}
            courseId={state.courseId}
            optionIds={state.optionIds}
            onSelect={handleDateTimeSelect}
          />
        </div>
      )}

      {state.step >= 7 && (
        <p className="text-center text-sm text-neutral-500">
          仮予約番号: {state.reservationId ?? "—"}
          <br />
          会員登録/ログイン・確認・完了はPhase 5で実装予定です。
        </p>
      )}
    </div>
  );
}
```

- [x] **Step 2: 型チェックとLintを実行する**

```bash
npx tsc --noEmit
npx eslint .
```

- [x] **Step 3: 全テストスイートを実行する**

```bash
npx vitest run
```

Expected: 既存の102テスト＋本Phaseの新規1テスト（Task1）＝103テストが全てパスする

- [x] **Step 4: 変更ファイルを報告する（コミットしない）**

---

## 完了確認チェックリスト

- [x] `npx vitest run` の全テストがパスする
- [x] `npx tsc --noEmit` がエラーなく通る
- [x] `npx eslint .` がエラーなく通る
- [x] `/reserve`ページでStep5（スタッフ指名）→Step6（日時選択、空き枠表示）→仮予約作成までの流れをユーザーがブラウザで確認する（`npm run dev`はこのサンドボックスでは起動確認できないため、ユーザーのターミナルで確認する）
