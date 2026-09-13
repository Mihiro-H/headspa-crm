# シフト希望3状態化・自動生成ルール再定義 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `StaffShiftRequest`の「休み希望」真偽値を「出勤／休み希望／時短希望」の3状態(`requestType`)に置き換え、自動生成ルール(未提出・出勤・時短の片方未入力の扱い)を再定義し、両画面のUIをそれに追従させる。

**Architecture:** 既存の`docs/superpowers/specs/2026-09-13-staff-shift-management-design.md`で実装済みのフロー(希望入力→AI自動生成→店長確定)自体は変更しない。データモデル・純粋ロジック(`deriveDraftShift`)・両画面のUIをこの追補設計(`docs/superpowers/specs/2026-09-13-shift-request-type-redesign-design.md`)に合わせて更新するのみ。

**Tech Stack:** Next.js (App Router) / React / TypeScript / Prisma / Vitest

---

## 前提知識(実装者向け)

- 対象の3つの設計書: `docs/superpowers/specs/2026-09-13-staff-shift-management-design.md`(元設計)、`docs/superpowers/specs/2026-09-13-shift-request-type-redesign-design.md`(今回の追補設計)。読まなくても以下のタスクで完結する。
- 既に本番相当のDBに`StaffShiftRequest`のデータが1件存在するため、**既存マイグレーションは絶対に編集しない**。新規マイグレーションファイルを追加し、`ALTER TABLE`＋バックフィルSQLで対応する。
- 認可パターン・時刻変換パターンは既存のまま流用する(`getCurrentAdminStoreScope`、`dbTimeToMinutes`/`minutesToLabel`/`monthRange`/`timeOrNull`)。
- 各タスクの最後に`npx tsc --noEmit -p tsconfig.json`を実行し、新規の型エラーが出ていないことを確認すること(既存の無関係な2件のエラーは無視してよい：`app/actions/current-admin-scope.test.ts(44,39)`と`app/actions/manage-permissions.ts(19,42)`)。
- マイグレーション適用はユーザー自身の環境で`npx prisma migrate deploy`を実行してもらう。

---

### Task 1: マイグレーション作成(`StaffShiftRequestType` enum追加、`isDayOffRequested`→`requestType`)

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260913020000_add_shift_request_type/migration.sql`

- [ ] **Step 1: `prisma/schema.prisma`に`StaffShiftRequestType` enumを追加する**

`enum StaffShiftDraft { ... }`の直前など、`StaffShiftRequest`モデルの直前に追加する:

```prisma
enum StaffShiftRequestType {
  full
  day_off
  reduced

  @@map("staff_shift_request_type")
}
```

- [ ] **Step 2: `StaffShiftRequest`モデルの`isDayOffRequested`を`requestType`に置き換える**

現在の`StaffShiftRequest`モデル(`prisma/schema.prisma`)：

```prisma
model StaffShiftRequest {
  id                 Int       @id @default(autoincrement()) @map("request_id")
  staffId            Int       @map("staff_id")
  workDate           DateTime  @map("work_date") @db.Date
  isDayOffRequested  Boolean   @default(false) @map("is_day_off_requested")
  preferredStartTime DateTime? @map("preferred_start_time") @db.Time()
  preferredEndTime   DateTime? @map("preferred_end_time") @db.Time()
  updatedAt          DateTime  @updatedAt @map("updated_at")

  staff Staff @relation(fields: [staffId], references: [id])

  @@unique([staffId, workDate])
  @@map("staff_shift_requests")
}
```

を以下に置き換える：

```prisma
model StaffShiftRequest {
  id                 Int                   @id @default(autoincrement()) @map("request_id")
  staffId            Int                   @map("staff_id")
  workDate           DateTime              @map("work_date") @db.Date
  requestType        StaffShiftRequestType @default(full) @map("request_type")
  preferredStartTime DateTime?             @map("preferred_start_time") @db.Time()
  preferredEndTime   DateTime?             @map("preferred_end_time") @db.Time()
  updatedAt          DateTime              @updatedAt @map("updated_at")

  staff Staff @relation(fields: [staffId], references: [id])

  @@unique([staffId, workDate])
  @@map("staff_shift_requests")
}
```

- [ ] **Step 3: マイグレーションファイルを作成する**

```bash
mkdir -p prisma/migrations/20260913020000_add_shift_request_type
```

`prisma/migrations/20260913020000_add_shift_request_type/migration.sql`を作成：

```sql
-- CreateEnum
CREATE TYPE "staff_shift_request_type" AS ENUM ('full', 'day_off', 'reduced');

-- AlterTable: 旧is_day_off_requestedの意味(false=時間指定)を引き継ぐデフォルトで追加
ALTER TABLE "staff_shift_requests" ADD COLUMN "request_type" "staff_shift_request_type" NOT NULL DEFAULT 'reduced';

-- Backfill: 既存データの意味をそのまま新カラムに反映
UPDATE "staff_shift_requests" SET "request_type" = 'day_off' WHERE "is_day_off_requested" = true;

-- 今後の新規行のデフォルトを'full'に変更(Prisma側の@defaultと合わせる)
ALTER TABLE "staff_shift_requests" ALTER COLUMN "request_type" SET DEFAULT 'full';

-- 旧カラムを削除
ALTER TABLE "staff_shift_requests" DROP COLUMN "is_day_off_requested";
```

- [ ] **Step 4: Prisma Clientを再生成する**

Run: `npx prisma generate`
Expected: `Generated Prisma Client` と表示される。

- [ ] **Step 5: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: この時点では`app/actions/staff-shift-requests.ts`等でまだ`isDayOffRequested`を参照しているため新規の型エラーが出る(Task 3で解消する)。前提知識に記載した既存2件に加え、`isDayOffRequested`関連のエラーが出ていることを確認する程度でよい(このタスクの時点でエラーが出ること自体は想定通り)。

- [ ] **Step 6: コミット**

```bash
git add prisma/schema.prisma prisma/migrations/20260913020000_add_shift_request_type
git commit -m "feat: replace StaffShiftRequest.isDayOffRequested with a 3-state requestType

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

**このマイグレーションはこの時点ではまだ実DBに適用されていない。** 全タスク完了後、ユーザーに`npx prisma migrate deploy`の実行を依頼する(Task 7で案内する)。

---

### Task 2: `lib/scheduling/derive-shift-draft.ts`のルールを再定義する(TDD)

**Files:**
- Modify: `lib/scheduling/derive-shift-draft.ts`
- Modify: `lib/scheduling/derive-shift-draft.test.ts`

- [ ] **Step 1: 失敗するテストに全面書き換える**

`lib/scheduling/derive-shift-draft.test.ts`を以下の内容に**全面置き換え**する:

```ts
import { describe, it, expect } from "vitest";
import { deriveDraftShift } from "./derive-shift-draft";

const STORE_HOURS = { openMinutes: 660, closeMinutes: 1110 }; // 11:00-18:30

describe("deriveDraftShift", () => {
  it("returns full attendance when there is no request (未提出)", () => {
    const result = deriveDraftShift(null, STORE_HOURS);
    expect(result).toEqual({ isDayOff: false, startMinutes: 660, endMinutes: 1110 });
  });

  it("returns full attendance when requestType is 'full', ignoring any preferred times", () => {
    const result = deriveDraftShift(
      { requestType: "full", preferredStartMinutes: 700, preferredEndMinutes: 800 },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: false, startMinutes: 660, endMinutes: 1110 });
  });

  it("returns day off when requestType is 'day_off'", () => {
    const result = deriveDraftShift(
      { requestType: "day_off", preferredStartMinutes: null, preferredEndMinutes: null },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: true, startMinutes: null, endMinutes: null });
  });

  it("returns day off when requestType is 'reduced' but both times are missing (不備)", () => {
    const result = deriveDraftShift(
      { requestType: "reduced", preferredStartMinutes: null, preferredEndMinutes: null },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: true, startMinutes: null, endMinutes: null });
  });

  it("fills in the store's opening time when only the end time is given", () => {
    const result = deriveDraftShift(
      { requestType: "reduced", preferredStartMinutes: null, preferredEndMinutes: 1000 },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: false, startMinutes: 660, endMinutes: 1000 });
  });

  it("fills in the store's closing time when only the start time is given", () => {
    const result = deriveDraftShift(
      { requestType: "reduced", preferredStartMinutes: 700, preferredEndMinutes: null },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: false, startMinutes: 700, endMinutes: 1110 });
  });

  it("uses the requested time range as-is when both are given and fit within store hours", () => {
    const result = deriveDraftShift(
      { requestType: "reduced", preferredStartMinutes: 700, preferredEndMinutes: 1000 },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: false, startMinutes: 700, endMinutes: 1000 });
  });

  it("clamps a requested start time earlier than store open", () => {
    const result = deriveDraftShift(
      { requestType: "reduced", preferredStartMinutes: 500, preferredEndMinutes: 1000 },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: false, startMinutes: 660, endMinutes: 1000 });
  });

  it("clamps a requested end time later than store close", () => {
    const result = deriveDraftShift(
      { requestType: "reduced", preferredStartMinutes: 700, preferredEndMinutes: 1200 },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: false, startMinutes: 700, endMinutes: 1110 });
  });

  it("falls back to a day off when clamping collapses the range to zero or negative width", () => {
    const result = deriveDraftShift(
      { requestType: "reduced", preferredStartMinutes: 500, preferredEndMinutes: 600 },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: true, startMinutes: null, endMinutes: null });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run lib/scheduling/derive-shift-draft.test.ts`
Expected: FAIL(`isDayOffRequested`を要求する現行の型・ロジックと一致せず失敗、または型エラー)

- [ ] **Step 3: `lib/scheduling/derive-shift-draft.ts`を以下の内容に全面置き換える**

```ts
import type { OpenHours } from "@/lib/reservation/store-hours";

export type ShiftRequestType = "full" | "day_off" | "reduced";

export interface ShiftRequestInput {
  requestType: ShiftRequestType;
  preferredStartMinutes: number | null;
  preferredEndMinutes: number | null;
}

export interface DraftShiftResult {
  isDayOff: boolean;
  startMinutes: number | null;
  endMinutes: number | null;
}

const DAY_OFF: DraftShiftResult = { isDayOff: true, startMinutes: null, endMinutes: null };

function fullAttendance(storeHours: OpenHours): DraftShiftResult {
  return { isDayOff: false, startMinutes: storeHours.openMinutes, endMinutes: storeHours.closeMinutes };
}

/**
 * スタッフの希望（StaffShiftRequest相当）から、店舗の営業時間に収まる
 * ドラフトシフトを機械的に導出する（ルールベース、外部API呼び出しなし）。
 * 複数スタッフ間の必要人数調整は行わない（各人の希望を独立に変換するだけ）。
 * 店舗営業時間の型は既存の`getStoreOpenHours`の戻り値（`OpenHours`）をそのまま使う
 * （同じ形の型をここで再定義しない）。
 *
 * 未提出（requestがnull）は「出勤」明示選択と同じ扱いにする（店舗の営業時間フル）。
 * これは自動生成における安全側のデフォルトであり、希望入力画面側の「完了/不備」
 * 判定（lib/scheduling/shift-request-completion.ts）とは別の目的・別のロジック。
 */
export function deriveDraftShift(
  request: ShiftRequestInput | null,
  storeHours: OpenHours,
): DraftShiftResult {
  if (!request || request.requestType === "full") {
    return fullAttendance(storeHours);
  }
  if (request.requestType === "day_off") {
    return DAY_OFF;
  }

  // requestType === "reduced"
  if (request.preferredStartMinutes === null && request.preferredEndMinutes === null) {
    return DAY_OFF;
  }

  const rawStart = request.preferredStartMinutes ?? storeHours.openMinutes;
  const rawEnd = request.preferredEndMinutes ?? storeHours.closeMinutes;
  const start = Math.max(rawStart, storeHours.openMinutes);
  const end = Math.min(rawEnd, storeHours.closeMinutes);
  if (start >= end) {
    return DAY_OFF;
  }

  return { isDayOff: false, startMinutes: start, endMinutes: end };
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run lib/scheduling/derive-shift-draft.test.ts`
Expected: `Tests 10 passed (10)`

- [ ] **Step 5: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: `lib/scheduling/derive-shift-draft.ts`起因の新規エラーは出ない(呼び出し元の`app/actions/generate-shift-draft.ts`はまだ古い型のままなのでそちらのエラーは出る。Task 4で解消する)。

- [ ] **Step 6: コミット**

```bash
git add lib/scheduling/derive-shift-draft.ts lib/scheduling/derive-shift-draft.test.ts
git commit -m "feat: redefine shift draft derivation rules for the 3-state request type

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 3: 「完了/不備」判定の純粋関数を新規作成する(TDD)

**Files:**
- Create: `lib/scheduling/shift-request-completion.ts`
- Create: `lib/scheduling/shift-request-completion.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`lib/scheduling/shift-request-completion.test.ts`を新規作成：

```ts
import { describe, it, expect } from "vitest";
import { isShiftRequestComplete } from "./shift-request-completion";

describe("isShiftRequestComplete", () => {
  it("returns false when there is no submitted request (未提出)", () => {
    expect(isShiftRequestComplete(undefined)).toBe(false);
  });

  it("returns true for requestType 'full'", () => {
    expect(
      isShiftRequestComplete({
        requestType: "full",
        preferredStartMinutes: null,
        preferredEndMinutes: null,
      }),
    ).toBe(true);
  });

  it("returns true for requestType 'day_off'", () => {
    expect(
      isShiftRequestComplete({
        requestType: "day_off",
        preferredStartMinutes: null,
        preferredEndMinutes: null,
      }),
    ).toBe(true);
  });

  it("returns false for requestType 'reduced' when both times are missing (不備)", () => {
    expect(
      isShiftRequestComplete({
        requestType: "reduced",
        preferredStartMinutes: null,
        preferredEndMinutes: null,
      }),
    ).toBe(false);
  });

  it("returns true for requestType 'reduced' when only the start time is given", () => {
    expect(
      isShiftRequestComplete({
        requestType: "reduced",
        preferredStartMinutes: 660,
        preferredEndMinutes: null,
      }),
    ).toBe(true);
  });

  it("returns true for requestType 'reduced' when only the end time is given", () => {
    expect(
      isShiftRequestComplete({
        requestType: "reduced",
        preferredStartMinutes: null,
        preferredEndMinutes: 1000,
      }),
    ).toBe(true);
  });

  it("returns true for requestType 'reduced' when both times are given", () => {
    expect(
      isShiftRequestComplete({
        requestType: "reduced",
        preferredStartMinutes: 660,
        preferredEndMinutes: 1000,
      }),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run lib/scheduling/shift-request-completion.test.ts`
Expected: FAIL(`./shift-request-completion`が存在しない)

- [ ] **Step 3: `lib/scheduling/shift-request-completion.ts`を実装する**

```ts
import type { ShiftRequestType } from "./derive-shift-draft";

export interface ShiftRequestLike {
  requestType: ShiftRequestType;
  preferredStartMinutes: number | null;
  preferredEndMinutes: number | null;
}

/**
 * スタッフのシフト希望画面で、その日の入力が「完了」しているかを判定する。
 *
 * 自動生成ロジック（deriveDraftShift）では「未提出＝出勤扱い」という安全側の
 * デフォルトを採用しているが、ここでの目的は入力の完了確認であり別軸の判定。
 * 未提出のまま何も入力しない状態を「完了」とはみなさない（スタッフに毎日
 * 明示的な選択を促すため）。同様に「時短希望」を選んでいるのに開始・終了
 * 時刻がどちらも未入力の場合も、まだ入力途中とみなし「不備」として扱う。
 */
export function isShiftRequestComplete(item: ShiftRequestLike | undefined): boolean {
  if (!item) return false;
  if (item.requestType === "reduced") {
    return item.preferredStartMinutes !== null || item.preferredEndMinutes !== null;
  }
  return true;
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run lib/scheduling/shift-request-completion.test.ts`
Expected: `Tests 7 passed (7)`

- [ ] **Step 5: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 新規エラーなし

- [ ] **Step 6: コミット**

```bash
git add lib/scheduling/shift-request-completion.ts lib/scheduling/shift-request-completion.test.ts
git commit -m "feat: add pure function to classify shift request input completion

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 4: `app/actions/staff-shift-requests.ts`を`requestType`対応にする(TDD)

**Files:**
- Modify: `app/actions/staff-shift-requests.ts`
- Modify: `app/actions/staff-shift-requests.test.ts`

- [ ] **Step 1: `app/actions/staff-shift-requests.test.ts`を以下の内容に全面置き換える**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getMyStaffId,
  getStaffShiftRequests,
  saveStaffShiftRequest,
  listShiftRequestsForStore,
} from "./staff-shift-requests";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { getCurrentAdminStoreScope } from "./current-admin-scope";

vi.mock("@/lib/db", () => ({
  prisma: {
    admin: { findUnique: vi.fn() },
    staff: { findUnique: vi.fn(), findMany: vi.fn() },
    staffShiftRequest: { findMany: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("./current-admin-scope", () => ({
  getCurrentAdminStoreScope: vi.fn(),
}));

describe("getMyStaffId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect(await getMyStaffId()).toBeNull();
  });

  it("returns null when the session role is not staff", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "manager" } } as never);
    expect(await getMyStaffId()).toBeNull();
    expect(prisma.admin.findUnique).not.toHaveBeenCalled();
  });

  it("returns the linked staffId for a staff-role admin", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "staff" } } as never);
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({ id: 7, staffId: 42 } as never);

    expect(await getMyStaffId()).toBe(42);
  });

  it("returns null when a staff-role admin has no linked staffId", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "staff" } } as never);
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({ id: 7, staffId: null } as never);

    expect(await getMyStaffId()).toBeNull();
  });
});

describe("getStaffShiftRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the requests when called by the linked staff member themselves", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "staff" } } as never);
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({ id: 7, staffId: 42 } as never);
    vi.mocked(prisma.staffShiftRequest.findMany).mockResolvedValue([
      {
        workDate: new Date("2026-10-01T00:00:00.000Z"),
        requestType: "reduced",
        preferredStartTime: new Date("1970-01-01T10:00:00.000Z"),
        preferredEndTime: new Date("1970-01-01T15:00:00.000Z"),
      },
    ] as never);

    const result = await getStaffShiftRequests(42, "2026-10");

    expect(result).toEqual([
      {
        workDate: "2026-10-01",
        requestType: "reduced",
        preferredStartMinutes: 600,
        preferredEndMinutes: 900,
      },
    ]);
  });

  it("returns an empty array when called by someone who is neither the staff member nor a manager/hq", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "staff" } } as never);
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({ id: 9, staffId: 99 } as never);

    const result = await getStaffShiftRequests(42, "2026-10");

    expect(result).toEqual([]);
    expect(prisma.staffShiftRequest.findMany).not.toHaveBeenCalled();
  });

  it("returns the requests for a manager whose store scope includes the staff's store", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", role: "manager" } } as never);
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({ id: 3, staffId: null } as never);
    vi.mocked(getCurrentAdminStoreScope).mockResolvedValue({
      isUnrestricted: false,
      storeIds: [1],
    });
    vi.mocked(prisma.staff.findUnique).mockResolvedValue({ id: 42, storeId: 1 } as never);
    vi.mocked(prisma.staffShiftRequest.findMany).mockResolvedValue([] as never);

    const result = await getStaffShiftRequests(42, "2026-10");

    expect(result).toEqual([]);
    expect(prisma.staffShiftRequest.findMany).toHaveBeenCalled();
  });

  it("returns an empty array for a manager whose store scope does not include the staff's store", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", role: "manager" } } as never);
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({ id: 3, staffId: null } as never);
    vi.mocked(getCurrentAdminStoreScope).mockResolvedValue({
      isUnrestricted: false,
      storeIds: [2],
    });
    vi.mocked(prisma.staff.findUnique).mockResolvedValue({ id: 42, storeId: 1 } as never);

    const result = await getStaffShiftRequests(42, "2026-10");

    expect(result).toEqual([]);
    expect(prisma.staffShiftRequest.findMany).not.toHaveBeenCalled();
  });

  it("returns the requests for an hq caller regardless of store scope", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "5", role: "hq" } } as never);
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({ id: 5, staffId: null } as never);
    vi.mocked(getCurrentAdminStoreScope).mockResolvedValue({
      isUnrestricted: true,
      storeIds: [],
    });
    vi.mocked(prisma.staff.findUnique).mockResolvedValue({ id: 42, storeId: 1 } as never);
    vi.mocked(prisma.staffShiftRequest.findMany).mockResolvedValue([
      {
        workDate: new Date("2026-10-01T00:00:00.000Z"),
        requestType: "reduced",
        preferredStartTime: new Date("1970-01-01T10:00:00.000Z"),
        preferredEndTime: new Date("1970-01-01T15:00:00.000Z"),
      },
    ] as never);

    const result = await getStaffShiftRequests(42, "2026-10");

    expect(result).toEqual([
      {
        workDate: "2026-10-01",
        requestType: "reduced",
        preferredStartMinutes: 600,
        preferredEndMinutes: 900,
      },
    ]);
    expect(prisma.staffShiftRequest.findMany).toHaveBeenCalled();
  });

  it("returns an empty array without querying shift requests when the staffId does not exist", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", role: "manager" } } as never);
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({ id: 3, staffId: null } as never);
    vi.mocked(prisma.staff.findUnique).mockResolvedValue(null as never);

    const result = await getStaffShiftRequests(999, "2026-10");

    expect(result).toEqual([]);
    expect(prisma.staffShiftRequest.findMany).not.toHaveBeenCalled();
  });
});

describe("saveStaffShiftRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthorized when the caller is not the linked staff member", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "staff" } } as never);
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({ id: 9, staffId: 99 } as never);

    const result = await saveStaffShiftRequest({
      staffId: 42,
      workDate: "2026-10-01",
      requestType: "reduced",
      preferredStartMinutes: 600,
      preferredEndMinutes: 900,
    });

    expect(result).toEqual({ status: "unauthorized" });
    expect(prisma.staffShiftRequest.upsert).not.toHaveBeenCalled();
  });

  it("upserts the request when the caller is the linked staff member", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "staff" } } as never);
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({ id: 7, staffId: 42 } as never);

    const result = await saveStaffShiftRequest({
      staffId: 42,
      workDate: "2026-10-01",
      requestType: "reduced",
      preferredStartMinutes: 600,
      preferredEndMinutes: 900,
    });

    expect(result).toEqual({ status: "saved" });
    expect(prisma.staffShiftRequest.upsert).toHaveBeenCalledWith({
      where: {
        staffId_workDate: { staffId: 42, workDate: new Date("2026-10-01T00:00:00.000Z") },
      },
      create: {
        staffId: 42,
        workDate: new Date("2026-10-01T00:00:00.000Z"),
        requestType: "reduced",
        preferredStartTime: new Date("1970-01-01T10:00:00.000Z"),
        preferredEndTime: new Date("1970-01-01T15:00:00.000Z"),
      },
      update: {
        requestType: "reduced",
        preferredStartTime: new Date("1970-01-01T10:00:00.000Z"),
        preferredEndTime: new Date("1970-01-01T15:00:00.000Z"),
      },
    });
  });

  it("upserts null preferred times when a day off is requested", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "staff" } } as never);
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({ id: 7, staffId: 42 } as never);

    const result = await saveStaffShiftRequest({
      staffId: 42,
      workDate: "2026-10-01",
      requestType: "day_off",
      preferredStartMinutes: null,
      preferredEndMinutes: null,
    });

    expect(result).toEqual({ status: "saved" });
    expect(prisma.staffShiftRequest.upsert).toHaveBeenCalledWith({
      where: {
        staffId_workDate: { staffId: 42, workDate: new Date("2026-10-01T00:00:00.000Z") },
      },
      create: {
        staffId: 42,
        workDate: new Date("2026-10-01T00:00:00.000Z"),
        requestType: "day_off",
        preferredStartTime: null,
        preferredEndTime: null,
      },
      update: {
        requestType: "day_off",
        preferredStartTime: null,
        preferredEndTime: null,
      },
    });
  });

  it("upserts requestType 'full' when the staff selects full attendance", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "staff" } } as never);
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({ id: 7, staffId: 42 } as never);

    const result = await saveStaffShiftRequest({
      staffId: 42,
      workDate: "2026-10-01",
      requestType: "full",
      preferredStartMinutes: null,
      preferredEndMinutes: null,
    });

    expect(result).toEqual({ status: "saved" });
    expect(prisma.staffShiftRequest.upsert).toHaveBeenCalledWith({
      where: {
        staffId_workDate: { staffId: 42, workDate: new Date("2026-10-01T00:00:00.000Z") },
      },
      create: {
        staffId: 42,
        workDate: new Date("2026-10-01T00:00:00.000Z"),
        requestType: "full",
        preferredStartTime: null,
        preferredEndTime: null,
      },
      update: {
        requestType: "full",
        preferredStartTime: null,
        preferredEndTime: null,
      },
    });
  });
});

describe("listShiftRequestsForStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthorized for a non-manager role", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "staff" } } as never);

    const result = await listShiftRequestsForStore(1, "2026-10");

    expect(result).toEqual({ status: "unauthorized" });
  });

  it("returns unauthorized when the store is outside the manager's scope", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", role: "manager" } } as never);
    vi.mocked(getCurrentAdminStoreScope).mockResolvedValue({
      isUnrestricted: false,
      storeIds: [2],
    });

    const result = await listShiftRequestsForStore(1, "2026-10");

    expect(result).toEqual({ status: "unauthorized" });
  });

  it("returns requests grouped by staffId for an authorized manager", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", role: "manager" } } as never);
    vi.mocked(getCurrentAdminStoreScope).mockResolvedValue({
      isUnrestricted: false,
      storeIds: [1],
    });
    vi.mocked(prisma.staff.findMany).mockResolvedValue([{ id: 42 }, { id: 43 }] as never);
    vi.mocked(prisma.staffShiftRequest.findMany).mockResolvedValue([
      {
        staffId: 42,
        workDate: new Date("2026-10-01T00:00:00.000Z"),
        requestType: "day_off",
        preferredStartTime: null,
        preferredEndTime: null,
      },
    ] as never);

    const result = await listShiftRequestsForStore(1, "2026-10");

    expect(result).toEqual({
      status: "ok",
      requestsByStaffId: {
        42: [
          {
            workDate: "2026-10-01",
            requestType: "day_off",
            preferredStartMinutes: null,
            preferredEndMinutes: null,
          },
        ],
      },
    });
  });

  it("returns an empty requestsByStaffId when the store has no active staff", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", role: "manager" } } as never);
    vi.mocked(getCurrentAdminStoreScope).mockResolvedValue({
      isUnrestricted: false,
      storeIds: [1],
    });
    vi.mocked(prisma.staff.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.staffShiftRequest.findMany).mockResolvedValue([] as never);

    const result = await listShiftRequestsForStore(1, "2026-10");

    expect(result).toEqual({ status: "ok", requestsByStaffId: {} });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run app/actions/staff-shift-requests.test.ts`
Expected: FAIL(現行実装は`isDayOffRequested`ベースのため、`requestType`を期待するアサーションが失敗する)

- [ ] **Step 3: `app/actions/staff-shift-requests.ts`を以下の内容に全面置き換える**

```ts
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { dbTimeToMinutes, minutesToLabel, monthRange } from "@/lib/reservation/time";
import type { ShiftRequestType } from "@/lib/scheduling/derive-shift-draft";
import { getCurrentAdminStoreScope } from "./current-admin-scope";

// UI（my-shift-requests/page.tsx）はこのファイル経由で型をimportするため再エクスポートする
// （`lib/scheduling/derive-shift-draft.ts`を型の定義元として一本化し、重複定義しない）
export type { ShiftRequestType };

export interface StaffShiftRequestItem {
  workDate: string;
  requestType: ShiftRequestType;
  preferredStartMinutes: number | null;
  preferredEndMinutes: number | null;
}

function toItem(r: {
  workDate: Date;
  requestType: ShiftRequestType;
  preferredStartTime: Date | null;
  preferredEndTime: Date | null;
}): StaffShiftRequestItem {
  return {
    workDate: r.workDate.toISOString().slice(0, 10),
    requestType: r.requestType,
    preferredStartMinutes: r.preferredStartTime ? dbTimeToMinutes(r.preferredStartTime) : null,
    preferredEndMinutes: r.preferredEndTime ? dbTimeToMinutes(r.preferredEndTime) : null,
  };
}

export async function getMyStaffId(): Promise<number | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "staff") {
    return null;
  }
  const admin = await prisma.admin.findUnique({ where: { id: Number(session.user.id) } });
  return admin?.staffId ?? null;
}

export async function getStaffShiftRequests(
  staffId: number,
  yearMonth: string,
): Promise<StaffShiftRequestItem[]> {
  const session = await auth();
  if (!session?.user) return [];

  const myStaffId = await getMyStaffId();
  if (myStaffId !== staffId) {
    const isManagerRole = session.user.role === "manager" || session.user.role === "hq";
    if (!isManagerRole) return [];

    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) return [];

    const scope = await getCurrentAdminStoreScope();
    if (!scope.isUnrestricted && !scope.storeIds.includes(staff.storeId)) return [];
  }

  const { start, end } = monthRange(yearMonth);
  const requests = await prisma.staffShiftRequest.findMany({
    where: { staffId, workDate: { gte: start, lte: end } },
    orderBy: { workDate: "asc" },
  });

  return requests.map(toItem);
}

export interface SaveStaffShiftRequestParams {
  staffId: number;
  workDate: string;
  requestType: ShiftRequestType;
  preferredStartMinutes: number | null;
  preferredEndMinutes: number | null;
}

export type SaveStaffShiftRequestResult = { status: "saved" } | { status: "unauthorized" };

export async function saveStaffShiftRequest(
  params: SaveStaffShiftRequestParams,
): Promise<SaveStaffShiftRequestResult> {
  const myStaffId = await getMyStaffId();
  if (myStaffId !== params.staffId) {
    return { status: "unauthorized" };
  }

  const workDate = new Date(`${params.workDate}T00:00:00.000Z`);
  const preferredStartTime =
    params.preferredStartMinutes !== null
      ? new Date(`1970-01-01T${minutesToLabel(params.preferredStartMinutes)}:00.000Z`)
      : null;
  const preferredEndTime =
    params.preferredEndMinutes !== null
      ? new Date(`1970-01-01T${minutesToLabel(params.preferredEndMinutes)}:00.000Z`)
      : null;

  await prisma.staffShiftRequest.upsert({
    where: { staffId_workDate: { staffId: params.staffId, workDate } },
    create: {
      staffId: params.staffId,
      workDate,
      requestType: params.requestType,
      preferredStartTime,
      preferredEndTime,
    },
    update: {
      requestType: params.requestType,
      preferredStartTime,
      preferredEndTime,
    },
  });

  return { status: "saved" };
}

export type ListShiftRequestsForStoreResult =
  | { status: "ok"; requestsByStaffId: Record<number, StaffShiftRequestItem[]> }
  | { status: "unauthorized" };

export async function listShiftRequestsForStore(
  storeId: number,
  yearMonth: string,
): Promise<ListShiftRequestsForStoreResult> {
  const session = await auth();
  if (!session?.user || (session.user.role !== "hq" && session.user.role !== "manager")) {
    return { status: "unauthorized" };
  }
  const scope = await getCurrentAdminStoreScope();
  if (!scope.isUnrestricted && !scope.storeIds.includes(storeId)) {
    return { status: "unauthorized" };
  }

  const staffList = await prisma.staff.findMany({ where: { storeId, isActive: true } });
  const { start, end } = monthRange(yearMonth);
  const requests = await prisma.staffShiftRequest.findMany({
    where: { staffId: { in: staffList.map((s) => s.id) }, workDate: { gte: start, lte: end } },
    orderBy: { workDate: "asc" },
  });

  const requestsByStaffId: Record<number, StaffShiftRequestItem[]> = {};
  for (const r of requests) {
    requestsByStaffId[r.staffId] = requestsByStaffId[r.staffId] ?? [];
    requestsByStaffId[r.staffId].push(toItem(r));
  }

  return { status: "ok", requestsByStaffId };
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run app/actions/staff-shift-requests.test.ts`
Expected: 全テスト passed(17件)

- [ ] **Step 5: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: `app/actions/generate-shift-draft.ts`はまだ古い`isDayOffRequested`を参照しているため、そちらのエラーは出る(Task 5で解消)。それ以外に新規エラーが無いことを確認する。

- [ ] **Step 6: コミット**

```bash
git add app/actions/staff-shift-requests.ts app/actions/staff-shift-requests.test.ts
git commit -m "feat: switch staff shift request actions to the 3-state requestType

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 5: `app/actions/generate-shift-draft.ts`を`requestType`対応にする(TDD)

**Files:**
- Modify: `app/actions/generate-shift-draft.ts`
- Modify: `app/actions/generate-shift-draft.test.ts`

- [ ] **Step 1: `app/actions/generate-shift-draft.test.ts`を以下の内容に全面置き換える**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateShiftDraftForStore } from "./generate-shift-draft";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { getCurrentAdminStoreScope } from "./current-admin-scope";

vi.mock("@/lib/db", () => ({
  prisma: {
    store: { findUnique: vi.fn() },
    staff: { findMany: vi.fn() },
    staffShiftRequest: { findMany: vi.fn() },
    staffShiftDraft: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("./current-admin-scope", () => ({
  getCurrentAdminStoreScope: vi.fn(),
}));

const STORE = {
  id: 1,
  weekdayOpen: new Date("1970-01-01T11:00:00.000Z"),
  weekdayClose: new Date("1970-01-01T18:30:00.000Z"),
  weekendOpen: new Date("1970-01-01T10:00:00.000Z"),
  weekendClose: new Date("1970-01-01T17:30:00.000Z"),
};

describe("generateShiftDraftForStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", role: "manager" } } as never);
    vi.mocked(getCurrentAdminStoreScope).mockResolvedValue({
      isUnrestricted: false,
      storeIds: [1],
    });
    // $transactionはPromise配列をまとめて実行するモック実装（実DBのトランザクションは張らない）
    vi.mocked(prisma.$transaction).mockImplementation(((ops: Promise<unknown>[]) =>
      Promise.all(ops)) as never);
  });

  it("returns unauthorized for a staff-role caller", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "staff" } } as never);

    const result = await generateShiftDraftForStore(1, "2026-10");

    expect(result).toEqual({ status: "unauthorized" });
    expect(prisma.staffShiftDraft.upsert).not.toHaveBeenCalled();
  });

  it("returns unauthorized when the store is outside the manager's scope", async () => {
    vi.mocked(getCurrentAdminStoreScope).mockResolvedValue({
      isUnrestricted: false,
      storeIds: [2],
    });

    const result = await generateShiftDraftForStore(1, "2026-10");

    expect(result).toEqual({ status: "unauthorized" });
  });

  it("returns unauthorized when the store does not exist", async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValue(null as never);

    const result = await generateShiftDraftForStore(1, "2026-10");

    expect(result).toEqual({ status: "unauthorized" });
    expect(prisma.staffShiftDraft.upsert).not.toHaveBeenCalled();
  });

  it("fetches only active staff for the store", async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValue(STORE as never);
    vi.mocked(prisma.staff.findMany).mockResolvedValue([{ id: 42, storeId: 1 }] as never);
    vi.mocked(prisma.staffShiftRequest.findMany).mockResolvedValue([] as never);

    await generateShiftDraftForStore(1, "2026-10");

    expect(prisma.staff.findMany).toHaveBeenCalledWith({ where: { storeId: 1, isActive: true } });
  });

  it("generates a full-attendance draft row per staff per day when no request was submitted (未提出)", async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValue(STORE as never);
    vi.mocked(prisma.staff.findMany).mockResolvedValue([{ id: 42, storeId: 1 }] as never);
    // 2026年10月は31日。全ての日で希望未提出→出勤扱い（店舗営業時間フル）になる想定。
    vi.mocked(prisma.staffShiftRequest.findMany).mockResolvedValue([] as never);

    const result = await generateShiftDraftForStore(1, "2026-10");

    expect(result).toEqual({ status: "generated", count: 31 });
    expect(prisma.staffShiftDraft.upsert).toHaveBeenCalledTimes(31);
    // 10/1は平日想定（木曜）：weekdayOpen 11:00〜weekdayClose 18:30が出勤扱いになる
    expect(prisma.staffShiftDraft.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          staffId_workDate: { staffId: 42, workDate: new Date("2026-10-01T00:00:00.000Z") },
        },
        create: expect.objectContaining({
          staffId: 42,
          workDate: new Date("2026-10-01T00:00:00.000Z"),
          isDayOff: false,
          startTime: new Date("1970-01-01T11:00:00.000Z"),
          endTime: new Date("1970-01-01T18:30:00.000Z"),
        }),
      }),
    );
  });

  it("returns a day off when the staff explicitly requested one", async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValue(STORE as never);
    vi.mocked(prisma.staff.findMany).mockResolvedValue([{ id: 42, storeId: 1 }] as never);
    vi.mocked(prisma.staffShiftRequest.findMany).mockResolvedValue([
      {
        staffId: 42,
        workDate: new Date("2026-10-01T00:00:00.000Z"),
        requestType: "day_off",
        preferredStartTime: null,
        preferredEndTime: null,
      },
    ] as never);

    await generateShiftDraftForStore(1, "2026-10");

    expect(prisma.staffShiftDraft.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          staffId_workDate: { staffId: 42, workDate: new Date("2026-10-01T00:00:00.000Z") },
        },
        create: expect.objectContaining({
          isDayOff: true,
          startTime: null,
          endTime: null,
        }),
      }),
    );
  });

  it("reflects a submitted time-range request, clamped to store hours", async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValue(STORE as never);
    vi.mocked(prisma.staff.findMany).mockResolvedValue([{ id: 42, storeId: 1 }] as never);
    vi.mocked(prisma.staffShiftRequest.findMany).mockResolvedValue([
      {
        staffId: 42,
        workDate: new Date("2026-10-01T00:00:00.000Z"),
        requestType: "reduced",
        preferredStartTime: new Date("1970-01-01T10:00:00.000Z"),
        preferredEndTime: new Date("1970-01-01T15:00:00.000Z"),
      },
    ] as never);

    await generateShiftDraftForStore(1, "2026-10");

    // 10/1は平日想定（木曜）：weekdayOpen 11:00なので希望開始10:00は11:00にクランプされる
    expect(prisma.staffShiftDraft.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          staffId_workDate: { staffId: 42, workDate: new Date("2026-10-01T00:00:00.000Z") },
        },
        create: expect.objectContaining({
          isDayOff: false,
          startTime: new Date("1970-01-01T11:00:00.000Z"),
          endTime: new Date("1970-01-01T15:00:00.000Z"),
        }),
      }),
    );
  });

  it("aggregates the count across multiple staff members", async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValue(STORE as never);
    vi.mocked(prisma.staff.findMany).mockResolvedValue([
      { id: 42, storeId: 1 },
      { id: 43, storeId: 1 },
    ] as never);
    vi.mocked(prisma.staffShiftRequest.findMany).mockResolvedValue([] as never);

    const result = await generateShiftDraftForStore(1, "2026-10");

    expect(result).toEqual({ status: "generated", count: 62 });
    expect(prisma.staffShiftDraft.upsert).toHaveBeenCalledTimes(62);
  });

  it("wraps all upserts in a single transaction so a mid-loop failure cannot leave a partially-applied month", async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValue(STORE as never);
    vi.mocked(prisma.staff.findMany).mockResolvedValue([{ id: 42, storeId: 1 }] as never);
    vi.mocked(prisma.staffShiftRequest.findMany).mockResolvedValue([] as never);

    await generateShiftDraftForStore(1, "2026-10");

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run app/actions/generate-shift-draft.test.ts`
Expected: FAIL(「未提出=出勤扱い」等、新しいルールに一致しないアサーションで失敗)

- [ ] **Step 3: `app/actions/generate-shift-draft.ts`の`deriveDraftShift`呼び出し部分を修正する**

現在の該当箇所(`app/actions/generate-shift-draft.ts`):

```ts
      const storeHours = getStoreOpenHours(store, workDate);
      const draft = deriveDraftShift(
        request
          ? {
              isDayOffRequested: request.isDayOffRequested,
              preferredStartMinutes: request.preferredStartTime
                ? dbTimeToMinutes(request.preferredStartTime)
                : null,
              preferredEndMinutes: request.preferredEndTime
                ? dbTimeToMinutes(request.preferredEndTime)
                : null,
            }
          : null,
        storeHours,
      );
```

を以下に置き換える(`isDayOffRequested`を`requestType`に変えるだけ):

```ts
      const storeHours = getStoreOpenHours(store, workDate);
      const draft = deriveDraftShift(
        request
          ? {
              requestType: request.requestType,
              preferredStartMinutes: request.preferredStartTime
                ? dbTimeToMinutes(request.preferredStartTime)
                : null,
              preferredEndMinutes: request.preferredEndTime
                ? dbTimeToMinutes(request.preferredEndTime)
                : null,
            }
          : null,
        storeHours,
      );
```

ファイルの他の部分(認可ロジック・`$transaction`まわり)は変更不要。

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run app/actions/generate-shift-draft.test.ts`
Expected: 全テスト passed(9件)

- [ ] **Step 5: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 前提知識に記載した既存2件以外のエラーなし

- [ ] **Step 6: コミット**

```bash
git add app/actions/generate-shift-draft.ts app/actions/generate-shift-draft.test.ts
git commit -m "feat: switch shift draft generation to the 3-state requestType

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 6: `/admin/my-shift-requests`ページをラジオボタン化し、完了/不備サマリーを追加する

**Files:**
- Modify: `app/admin/(dashboard)/my-shift-requests/page.tsx`

このタスクは表示のみの変更(Task 3・4のロジックを使うだけ)のため、新規のアクションテストは書かない。

- [ ] **Step 1: `app/admin/(dashboard)/my-shift-requests/page.tsx`を以下の内容に全面置き換える**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  getMyStaffId,
  getStaffShiftRequests,
  saveStaffShiftRequest,
  type ShiftRequestType,
  type StaffShiftRequestItem,
} from "@/app/actions/staff-shift-requests";
import { minutesToLabel } from "@/lib/reservation/time";
import { resolveSaveOutcome } from "@/lib/scheduling/resolve-save-outcome";
import { isShiftRequestComplete } from "@/lib/scheduling/shift-request-completion";

function yearMonthWithOffset(monthOffset: number): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + monthOffset);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function daysInYearMonth(yearMonth: string): string[] {
  const [year, month] = yearMonth.split("-").map(Number);
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${yearMonth}-${String(i + 1).padStart(2, "0")}`);
}

function minutesFromTimeInput(value: string): number | null {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function timeInputFromMinutes(minutes: number | null): string {
  return minutes === null ? "" : minutesToLabel(minutes);
}

const REQUEST_TYPES: readonly ShiftRequestType[] = ["full", "day_off", "reduced"];

const REQUEST_TYPE_LABELS: Record<ShiftRequestType, string> = {
  full: "出勤",
  day_off: "休み希望",
  reduced: "時短希望",
};

const EMPTY_ITEM = (workDate: string): StaffShiftRequestItem => ({
  workDate,
  requestType: "full",
  preferredStartMinutes: null,
  preferredEndMinutes: null,
});

export default function MyShiftRequestsPage() {
  const [staffId, setStaffId] = useState<number | null | undefined>(undefined);
  const [yearMonth, setYearMonth] = useState(yearMonthWithOffset(1));
  const [requests, setRequests] = useState<Map<string, StaffShiftRequestItem>>(new Map());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 同一日付への変更が短時間に連続した場合、古いリクエストの失敗結果で
  // 新しい変更を誤って巻き戻さないよう、日付ごとに連番を振って
  // 「自分が最後に投げたリクエストか」を判定する
  const requestSeqRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    getMyStaffId().then(setStaffId);
  }, []);

  useEffect(() => {
    if (!staffId) return;
    getStaffShiftRequests(staffId, yearMonth).then((items) => {
      setRequests(new Map(items.map((i) => [i.workDate, i])));
    });
  }, [staffId, yearMonth]);

  async function handleChange(workDate: string, patch: Partial<StaffShiftRequestItem>) {
    if (!staffId) return;
    const previous = requests.get(workDate);
    const next = { ...(previous ?? EMPTY_ITEM(workDate)), ...patch };
    setRequests((prev) => new Map(prev).set(workDate, next));
    setErrorMessage(null);

    const seq = (requestSeqRef.current.get(workDate) ?? 0) + 1;
    requestSeqRef.current.set(workDate, seq);

    const result = await saveStaffShiftRequest({
      staffId,
      workDate,
      requestType: next.requestType,
      preferredStartMinutes: next.preferredStartMinutes,
      preferredEndMinutes: next.preferredEndMinutes,
    });

    const outcome = resolveSaveOutcome({
      latestSeqForDate: requestSeqRef.current.get(workDate) ?? seq,
      ownSeq: seq,
      saveSucceeded: result.status === "saved",
    });

    if (outcome === "rollback") {
      setRequests((prev) => {
        const rolledBack = new Map(prev);
        if (previous) {
          rolledBack.set(workDate, previous);
        } else {
          rolledBack.delete(workDate);
        }
        return rolledBack;
      });
      setErrorMessage(`${workDate}の保存に失敗しました。もう一度お試しください。`);
    }
  }

  function handleRequestTypeChange(workDate: string, requestType: ShiftRequestType) {
    const item = requests.get(workDate);
    if (requestType === "reduced") {
      // 時短希望に切り替えた直後は、既存の時刻があればそれを引き継ぐ
      handleChange(workDate, {
        requestType,
        preferredStartMinutes: item?.preferredStartMinutes ?? null,
        preferredEndMinutes: item?.preferredEndMinutes ?? null,
      });
    } else {
      // 出勤・休み希望では時刻は使わないのでクリアする
      handleChange(workDate, { requestType, preferredStartMinutes: null, preferredEndMinutes: null });
    }
  }

  if (staffId === undefined) {
    return <p className="text-sm text-neutral-500">読み込み中...</p>;
  }
  if (staffId === null) {
    return (
      <p className="text-sm text-neutral-500">
        スタッフとして紐付けられていません。管理者にお問い合わせください。
      </p>
    );
  }

  const days = daysInYearMonth(yearMonth);
  const completeCount = days.filter((d) => isShiftRequestComplete(requests.get(d))).length;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl text-primary-700">シフト希望</h1>
      <select
        value={yearMonth}
        onChange={(e) => setYearMonth(e.target.value)}
        className="h-10 w-32 rounded-md border border-neutral-300 px-2 text-sm"
      >
        {[0, 1, 2].map((offset) => {
          const value = yearMonthWithOffset(offset);
          return (
            <option key={value} value={value}>
              {value}
            </option>
          );
        })}
      </select>

      <p className="text-sm text-neutral-600">
        {days.length}日中{completeCount}件完了・{days.length - completeCount}件不備
      </p>

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-neutral-500">
              <th scope="col" className="p-2 font-medium">日付</th>
              <th scope="col" className="p-2 font-medium">希望区分</th>
              <th scope="col" className="p-2 font-medium">希望開始</th>
              <th scope="col" className="p-2 font-medium">希望終了</th>
            </tr>
          </thead>
          <tbody>
            {days.map((workDate) => {
              const item = requests.get(workDate);
              const requestType = item?.requestType ?? "full";
              const isReduced = requestType === "reduced";
              return (
                <tr key={workDate} className="border-b border-neutral-100 last:border-0">
                  <td className="p-2 text-neutral-800">{workDate}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-3">
                      {REQUEST_TYPES.map((type) => (
                        <label key={type} className="flex items-center gap-1 text-xs text-neutral-700">
                          <input
                            type="radio"
                            name={`request-type-${workDate}`}
                            aria-label={`${workDate} ${REQUEST_TYPE_LABELS[type]}`}
                            checked={requestType === type}
                            onChange={() => handleRequestTypeChange(workDate, type)}
                          />
                          {REQUEST_TYPE_LABELS[type]}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td className="p-2">
                    <input
                      type="time"
                      aria-label={`${workDate} 希望開始時刻`}
                      disabled={!isReduced}
                      value={timeInputFromMinutes(item?.preferredStartMinutes ?? null)}
                      onChange={(e) =>
                        handleChange(workDate, {
                          preferredStartMinutes: minutesFromTimeInput(e.target.value),
                        })
                      }
                      className="rounded-md border border-neutral-300 px-2 py-1 disabled:opacity-50"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="time"
                      aria-label={`${workDate} 希望終了時刻`}
                      disabled={!isReduced}
                      value={timeInputFromMinutes(item?.preferredEndMinutes ?? null)}
                      onChange={(e) =>
                        handleChange(workDate, {
                          preferredEndMinutes: minutesFromTimeInput(e.target.value),
                        })
                      }
                      className="rounded-md border border-neutral-300 px-2 py-1 disabled:opacity-50"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 前提知識に記載した既存2件以外のエラーなし

- [ ] **Step 3: ESLintチェック**

Run: `npx eslint "app/admin/(dashboard)/my-shift-requests/page.tsx"`
Expected: エラー・警告なし

- [ ] **Step 4: コミット**

```bash
git add "app/admin/(dashboard)/my-shift-requests/page.tsx"
git commit -m "feat: switch shift request input to 3-way radio selection with a completion summary

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 7: `/admin/staff-shifts`ページの「提出済みの希望」表示を`requestType`対応にする

**Files:**
- Modify: `app/admin/(dashboard)/staff-shifts/page.tsx`

このタスクも表示のみの変更のため、新規のアクションテストは書かない。

- [ ] **Step 1: `requestSummary`関数を修正する**

現在の該当箇所(`app/admin/(dashboard)/staff-shifts/page.tsx`):

```ts
function requestSummary(item: StaffShiftRequestItem | undefined): string {
  if (!item) return "未提出";
  if (item.isDayOffRequested) return "休み希望";
  if (item.preferredStartMinutes !== null && item.preferredEndMinutes !== null) {
    return `${timeInputFromMinutes(item.preferredStartMinutes)}〜${timeInputFromMinutes(item.preferredEndMinutes)}`;
  }
  return "未提出";
}
```

を以下に置き換える:

```ts
function requestSummary(item: StaffShiftRequestItem | undefined): string {
  if (!item) return "未提出";
  if (item.requestType === "day_off") return "休み希望";
  if (item.requestType === "full") return "出勤";
  // requestType === "reduced"
  if (item.preferredStartMinutes !== null || item.preferredEndMinutes !== null) {
    const start = item.preferredStartMinutes !== null ? timeInputFromMinutes(item.preferredStartMinutes) : "?";
    const end = item.preferredEndMinutes !== null ? timeInputFromMinutes(item.preferredEndMinutes) : "?";
    return `時短 ${start}〜${end}`;
  }
  return "不備(時短希望・時間未入力)";
}
```

ファイルの他の部分(store/月選択、ドラフトグリッド、ボタン類)は変更不要。

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 前提知識に記載した既存2件以外のエラーなし

- [ ] **Step 3: ESLintチェック**

Run: `npx eslint "app/admin/(dashboard)/staff-shifts/page.tsx"`
Expected: エラー・警告なし

- [ ] **Step 4: コミット**

```bash
git add "app/admin/(dashboard)/staff-shifts/page.tsx"
git commit -m "feat: display the 3-state request type in the manager shift overview

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 8: 最終確認

**Files:** なし(確認のみ)

- [ ] **Step 1: このplanで変更した範囲のテストを実行する**

Run: `npx vitest run lib/scheduling/derive-shift-draft.test.ts lib/scheduling/shift-request-completion.test.ts app/actions/staff-shift-requests.test.ts app/actions/generate-shift-draft.test.ts`
Expected: 全て passed

- [ ] **Step 2: プロジェクト全体のテストを実行する(リグレッション確認)**

Run: `npx vitest run app lib`
Expected: 既存テストを含め全て passed(`app`/`lib`配下のみを対象にすることで、`.claude/worktrees/`配下の無関係な古いworktreeのテストを拾わないようにする)

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 前提知識に記載した既存2件以外のエラーなし

- [ ] **Step 4: ユーザーへの引き継ぎ**

以下を案内する:
1. `npx prisma migrate deploy`を実行して`20260913020000_add_shift_request_type`マイグレーションを適用する(既存の`is_day_off_requested`の値は`request_type`にバックフィルされてから削除される)。
2. `npm run dev`を再起動する(Prisma Client再生成後は開発サーバーの再起動が必要)。
3. `/admin/my-shift-requests`で、出勤/休み希望/時短希望の3択と完了/不備サマリーが正しく表示されるか確認する。
4. `/admin/staff-shifts`で「AIで自動作成」を実行し、未提出の日が出勤(店舗営業時間フル)として反映されることを確認する。
