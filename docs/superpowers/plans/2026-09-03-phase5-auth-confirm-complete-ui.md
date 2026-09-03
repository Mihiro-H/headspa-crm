# フォレスパ Phase 5: 会員登録/ログイン・確認・完了UI（Step7〜9） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** WEB予約フォーム（M-02）のStep7（会員登録／ログイン）・Step8（確認画面）・Step9（完了画面）を実装し、店舗選択から予約確定までの9ステップ全体を通しで動作させる。

**Architecture:** Step7はメール新規登録（`registerMember`新規Server Action）とログイン（Auth.js v5の`next-auth/react`の`signIn`をクライアントから呼び出し、既存の`member-credentials`プロバイダを利用）、およびLINE連携ログイン導線。Step8はウィザードが既に保持しているクライアント状態（店舗・コース・オプション・スタッフ・日時）から表示し、DBへの再取得は行わない。「予約する」ボタンでPhase 2実装済みの`confirmReservation`（認証済みセッションの`memberId`を使う）を呼び出しStep9へ。

**Tech Stack:** Next.js App Router / TypeScript / Tailwind v4 / Auth.js v5（既存Phase 0〜4基盤を使用）

**参照元資料:** `02_screenspecification.md`（M-02節 Step7・Step8・Step9、M-01節）

**このPhaseで作らないもの:** LINE連携登録時の性別・生年月日追加入力画面（既存会員テーブルのLINE紐付けロジックはPhase 0で実装済みだが、UIは別タスク）、マイページ（`/mypage`）実装。

> **既知の制限 → 解消済み:** Phase 5完了直後のフォローアップで修正済み。`create-temp-hold.ts`と`courses.ts`が別々にキャンペーン照会ロジックを持っていた重複を、共有ヘルパー`app/actions/course-campaigns.ts`の`resolveCourseCampaigns`に統合。`createTempHoldReservation`もこれを使ってキャンペーン適用後価格を正しく`totalPrice`に記録するようになった（テスト追加済み：全111テストパス）。

> **実行環境に関する注記（継承）:** `.git`書き込み不可（コミットは後回し）、`.env`系ファイル読み書き不可、`npm run build`/`npm run dev`は不安定（`tsc --noEmit`/`eslint`/`vitest`を使う）。UIコンポーネントは軽量検証（tsc/eslintのみ）、データ取得・作成系Server ActionsはTDD、という前Phaseの方針を踏襲する。

---

## Task 1: 会員登録Server Action（TDD）

**Files:**
- Create: `app/actions/register-member.ts`
- Test: `app/actions/register-member.test.ts`

**注記:** `hashPassword`（`lib/auth/password.ts`）はPhase 0実装済み。再利用する。新規会員のステータスは`customer_statuses`の`sortOrder`最小値（ビジター）を自動採用する。

- [x] **Step 1: 失敗するテストを書く**

`app/actions/register-member.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerMember } from "./register-member";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    member: { findUnique: vi.fn(), create: vi.fn() },
    customerStatus: { findFirstOrThrow: vi.fn() },
  },
}));

describe("registerMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new member with a hashed password and the lowest-tier status", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.customerStatus.findFirstOrThrow).mockResolvedValue({ id: 3 } as never);
    vi.mocked(prisma.member.create).mockResolvedValue({ id: 42 } as never);

    const result = await registerMember({
      name: "山田花子",
      email: "hanako@example.com",
      phone: "090-0000-0000",
      password: "himitsu-password",
      birthDate: "1995-05-01",
      gender: "female",
    });

    expect(result).toEqual({ status: "created", memberId: 42 });
    expect(prisma.customerStatus.findFirstOrThrow).toHaveBeenCalledWith({
      orderBy: { sortOrder: "asc" },
    });
    const createArgs = vi.mocked(prisma.member.create).mock.calls[0][0];
    expect(createArgs.data.email).toBe("hanako@example.com");
    expect(createArgs.data.statusId).toBe(3);
    expect(createArgs.data.passwordHash).not.toBe("himitsu-password");
  });

  it("refuses to register when the email is already taken", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue({ id: 1 } as never);

    const result = await registerMember({
      name: "山田花子",
      email: "hanako@example.com",
      phone: "090-0000-0000",
      password: "himitsu-password",
      birthDate: "1995-05-01",
      gender: "female",
    });

    expect(result).toEqual({ status: "email_taken" });
    expect(prisma.member.create).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run app/actions/register-member.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`app/actions/register-member.ts`:

```typescript
"use server";

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

export interface RegisterMemberParams {
  name: string;
  email: string;
  phone: string;
  password: string;
  birthDate: string;
  gender: "female" | "male" | "other";
}

export type RegisterMemberResult =
  | { status: "created"; memberId: number }
  | { status: "email_taken" };

export async function registerMember(
  params: RegisterMemberParams,
): Promise<RegisterMemberResult> {
  const existing = await prisma.member.findUnique({ where: { email: params.email } });
  if (existing) {
    return { status: "email_taken" };
  }

  const passwordHash = await hashPassword(params.password);
  const defaultStatus = await prisma.customerStatus.findFirstOrThrow({
    orderBy: { sortOrder: "asc" },
  });

  const member = await prisma.member.create({
    data: {
      name: params.name,
      email: params.email,
      phone: params.phone,
      passwordHash,
      birthDate: new Date(`${params.birthDate}T00:00:00.000Z`),
      gender: params.gender,
      statusId: defaultStatus.id,
    },
  });

  return { status: "created", memberId: member.id };
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run app/actions/register-member.test.ts
```

Expected: PASS（2 tests）

- [x] **Step 5: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [x] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 2: Step7 会員登録/ログインコンポーネント（軽量検証）

**Files:**
- Create: `components/reservation/auth-step.tsx`

**注記:** `signIn`は`next-auth/react`（クライアント用）から使う。Phase 0で実装済みの`member-credentials`プロバイダをそのまま使用する。`redirect: false`を指定し、ウィザードのクライアント状態（選択内容）を失わないようにする。

- [x] **Step 1: 実装する**

`components/reservation/auth-step.tsx`:

```tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { registerMember } from "@/app/actions/register-member";

interface AuthStepProps {
  onAuthenticated: () => void;
}

const inputClass = "h-12 rounded-md border border-neutral-300 px-3";

export function AuthStep({ onAuthenticated }: AuthStepProps) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    birthDate: "",
    gender: "female" as "female" | "male" | "other",
  });
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleRegister() {
    setSubmitting(true);
    setError(null);
    const result = await registerMember(form);
    if (result.status === "email_taken") {
      setError("このメールアドレスは既に登録されています。");
      setSubmitting(false);
      return;
    }
    const signInResult = await signIn("member-credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });
    setSubmitting(false);
    if (signInResult?.ok) {
      onAuthenticated();
    } else {
      setError("登録は完了しましたが、ログインに失敗しました。もう一度ログインしてください。");
    }
  }

  async function handleLogin() {
    setSubmitting(true);
    setError(null);
    const signInResult = await signIn("member-credentials", {
      email: loginForm.email,
      password: loginForm.password,
      redirect: false,
    });
    setSubmitting(false);
    if (signInResult?.ok) {
      onAuthenticated();
    } else {
      setError("メールアドレスまたはパスワードが正しくありません。");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-heading text-xl text-primary-700">会員登録／ログイン</h2>

      <button
        type="button"
        onClick={() => signIn("line")}
        className="h-12 w-full rounded-lg bg-[#06C755] font-medium text-white"
      >
        LINEで連携ログイン
      </button>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`flex-1 rounded-lg border p-2 text-sm ${
            mode === "register"
              ? "border-primary-500 bg-primary-50 text-primary-700"
              : "border-neutral-200 text-neutral-600"
          }`}
        >
          新規登録
        </button>
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex-1 rounded-lg border p-2 text-sm ${
            mode === "login"
              ? "border-primary-500 bg-primary-50 text-primary-700"
              : "border-neutral-200 text-neutral-600"
          }`}
        >
          ログイン
        </button>
      </div>

      {error && <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}

      {mode === "register" ? (
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="氏名"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={inputClass}
          />
          <input
            type="email"
            placeholder="メールアドレス"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className={inputClass}
          />
          <input
            type="tel"
            placeholder="電話番号"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className={inputClass}
          />
          <input
            type="password"
            placeholder="パスワード"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className={inputClass}
          />
          <input
            type="date"
            value={form.birthDate}
            onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
            className={inputClass}
          />
          <select
            value={form.gender}
            onChange={(e) =>
              setForm((f) => ({ ...f, gender: e.target.value as typeof form.gender }))
            }
            className={inputClass}
          >
            <option value="female">女性</option>
            <option value="male">男性</option>
            <option value="other">その他</option>
          </select>
          <p className="text-xs text-neutral-500">
            性別は、フォーメン等の性別限定コース・オプションの選択可否判定に使用します。
          </p>
          <button
            type="button"
            disabled={submitting}
            onClick={handleRegister}
            className="h-12 w-full rounded-lg bg-accent-500 font-medium text-white disabled:opacity-50"
          >
            登録して次へ
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="メールアドレス"
            value={loginForm.email}
            onChange={(e) => setLoginForm((f) => ({ ...f, email: e.target.value }))}
            className={inputClass}
          />
          <input
            type="password"
            placeholder="パスワード"
            value={loginForm.password}
            onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
            className={inputClass}
          />
          <button
            type="button"
            disabled={submitting}
            onClick={handleLogin}
            className="h-12 w-full rounded-lg bg-accent-500 font-medium text-white disabled:opacity-50"
          >
            ログインして次へ
          </button>
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

---

## Task 3: Step8 確認画面コンポーネント（軽量検証）

**Files:**
- Create: `components/reservation/confirmation-step.tsx`

**注記:** キャンセル期限の計算は`calculateCancellationDeadline`（`lib/reservation/cancellation-deadline.ts`、Phase 2実装済み）を再利用する。独自に日付計算ロジックを書かないこと。

- [x] **Step 1: 実装する**

`components/reservation/confirmation-step.tsx`:

```tsx
import { calculateCancellationDeadline } from "@/lib/reservation/cancellation-deadline";
import type { StoreListItem } from "@/app/actions/stores";
import type { CourseListItem } from "@/app/actions/courses";
import type { OptionListItem } from "@/app/actions/options";
import type { StaffListItem } from "@/app/actions/staff";

interface ConfirmationStepProps {
  store: StoreListItem | undefined;
  course: CourseListItem | undefined;
  options: OptionListItem[];
  staff: StaffListItem | undefined;
  reservationDate: string;
  startTimeLabel: string;
  onConfirm: () => void;
  submitting: boolean;
  errorMessage: string | null;
}

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export function ConfirmationStep({
  store,
  course,
  options,
  staff,
  reservationDate,
  startTimeLabel,
  onConfirm,
  submitting,
  errorMessage,
}: ConfirmationStepProps) {
  const deadline = calculateCancellationDeadline(new Date(`${reservationDate}T00:00:00.000Z`));
  const deadlineLabel = `${deadline.toISOString().slice(0, 10)} 23:59`;
  const total =
    (course?.finalPrice ?? 0) +
    options.reduce((sum, o) => sum + o.price, 0) +
    (staff?.nominationFee ?? 0);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-heading text-xl text-primary-700">予約内容の確認</h2>

      <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-sm">
        <p className="text-neutral-800">
          <span className="text-neutral-500">店舗：</span>
          {store?.name}
        </p>
        <p className="text-neutral-800">
          <span className="text-neutral-500">コース：</span>
          {course?.name}
        </p>
        {options.length > 0 && (
          <p className="text-neutral-800">
            <span className="text-neutral-500">オプション：</span>
            {options.map((o) => o.name).join("、")}
          </p>
        )}
        <p className="text-neutral-800">
          <span className="text-neutral-500">スタッフ：</span>
          {staff ? staff.name : "指名なし（自動割当）"}
        </p>
        <p className="text-neutral-800">
          <span className="text-neutral-500">日時：</span>
          {reservationDate} {startTimeLabel}〜
        </p>
        <p className="mt-2 text-lg font-medium text-neutral-800">合計 {formatYen(total)}</p>
      </div>

      <p className="text-xs text-neutral-500">
        ご予約前日23:59（{deadlineLabel}）までマイページから変更・キャンセル可能です。
      </p>

      {errorMessage && (
        <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{errorMessage}</p>
      )}

      <button
        type="button"
        disabled={submitting}
        onClick={onConfirm}
        className="h-12 w-full rounded-lg bg-accent-500 font-medium text-white disabled:opacity-50"
      >
        予約する
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

## Task 4: Step9 完了画面コンポーネント（軽量検証）

**Files:**
- Create: `components/reservation/completion-step.tsx`

- [x] **Step 1: 実装する**

`components/reservation/completion-step.tsx`:

```tsx
interface CompletionStepProps {
  reservationId: number;
}

export function CompletionStep({ reservationId }: CompletionStepProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <h2 className="font-heading text-xl text-primary-700">ご予約が完了しました</h2>
      <p className="text-neutral-600">予約番号：{reservationId}</p>
      <p className="text-sm text-neutral-500">確認メールをお送りしましたのでご確認ください。</p>
      <a
        href="/mypage"
        className="mt-2 h-12 w-full max-w-xs rounded-lg bg-primary-500 px-4 py-3 text-center font-medium text-white"
      >
        マイページへ
      </a>
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

## Task 5: ウィザードへの統合（軽量検証）

**Files:**
- Modify: `app/reserve/reservation-wizard.tsx`

**注記:** `confirmReservation`（`app/actions/confirm-reservation.ts`、Phase 2実装済み・セキュリティ修正済み）は引数が`{ reservationId }`のみで、認証済みセッションから`memberId`を取得する。クライアントから`memberId`を渡す必要はない（渡してもフィールドが存在しないため型エラーになる）。

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
import { AuthStep } from "@/components/reservation/auth-step";
import { ConfirmationStep } from "@/components/reservation/confirmation-step";
import { CompletionStep } from "@/components/reservation/completion-step";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { listCourseCategories, type CourseCategoryListItem } from "@/app/actions/course-categories";
import { listCoursesForCategory, type CourseListItem } from "@/app/actions/courses";
import { listOptions, type OptionListItem } from "@/app/actions/options";
import { listStaffForStore, type StaffListItem } from "@/app/actions/staff";
import { createTempHoldReservation } from "@/app/actions/create-temp-hold";
import { confirmReservation } from "@/app/actions/confirm-reservation";
import { minutesToLabel } from "@/lib/reservation/time";
import type { MemberGender } from "@/lib/reservation/gender-restriction";

const TOTAL_STEPS = 9;

interface WizardState {
  step: number;
  storeId: number | null;
  categoryId: number | null;
  courseId: number | null;
  optionIds: number[];
  staffId: number | null;
  reservationDate: string | null;
  startTimeLabel: string | null;
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
    reservationDate: null,
    startTimeLabel: null,
    reservationId: null,
    errorMessage: null,
  });
  const [confirming, setConfirming] = useState(false);
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
      reservationDate: date,
      startTimeLabel: minutesToLabel(startMinutes),
      step: 7,
      errorMessage: null,
    }));
  }

  async function handleConfirm() {
    if (state.reservationId === null) return;
    setConfirming(true);
    const result = await confirmReservation({ reservationId: state.reservationId });
    setConfirming(false);

    if (result.status !== "confirmed") {
      setState((s) => ({
        ...s,
        errorMessage:
          result.status === "expired"
            ? "仮予約の有効期限が切れました。お手数ですが最初からやり直してください。"
            : "予約の確定に失敗しました。もう一度お試しください。",
      }));
      return;
    }

    setState((s) => ({ ...s, step: 9, errorMessage: null }));
  }

  const selectedStore = stores.find((s) => s.id === state.storeId);
  const selectedCourse = courses.find((c) => c.id === state.courseId);
  const selectedOptions = options.filter((o) => state.optionIds.includes(o.id));
  const selectedStaff = staff.find((s) => s.id === state.staffId);

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

      {state.step === 7 && (
        <AuthStep onAuthenticated={() => setState((s) => ({ ...s, step: 8 }))} />
      )}

      {state.step === 8 && state.reservationDate !== null && state.startTimeLabel !== null && (
        <ConfirmationStep
          store={selectedStore}
          course={selectedCourse}
          options={selectedOptions}
          staff={selectedStaff}
          reservationDate={state.reservationDate}
          startTimeLabel={state.startTimeLabel}
          onConfirm={handleConfirm}
          submitting={confirming}
          errorMessage={state.errorMessage}
        />
      )}

      {state.step === 9 && state.reservationId !== null && (
        <CompletionStep reservationId={state.reservationId} />
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

Expected: 既存の103テスト＋本Phaseの新規2テスト（Task1）＝105テストが全てパスする

- [x] **Step 4: 変更ファイルを報告する（コミットしない）**

---

## 完了確認チェックリスト

- [x] `npx vitest run` の全テストがパスする
- [x] `npx tsc --noEmit` がエラーなく通る
- [x] `npx eslint .` がエラーなく通る
- [x] `/reserve`ページで店舗選択から予約確定・完了画面までの9ステップ全体をユーザーがブラウザで確認する（`npm run dev`はこのサンドボックスでは起動確認できないため、ユーザーのターミナルで確認する）
- [x] （フォローアップ課題として記録）`create-temp-hold.ts`にキャンペーン照会ロジックを追加し、表示価格と記録される`total_price`を一致させる
