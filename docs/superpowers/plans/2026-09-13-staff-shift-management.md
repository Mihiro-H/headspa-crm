# スタッフシフト管理機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スタッフ本人のシフト希望入力→店長のルールベース自動ドラフト生成→店長確定、という3段階のシフト管理フローを実装する。確定シフトは既存の`StaffShift`（予約可能時間判定が読むテーブル）にのみ反映される。

**Architecture:** 既存パターン（`"use client"`ページ＋`"use server"`アクション）を踏襲。新規ロジックは`lib/scheduling/derive-shift-draft.ts`の純粋関数に切り出し、単体テストしやすくする。希望(`StaffShiftRequest`)とドラフト(`StaffShiftDraft`)は`StaffShift`とは別テーブルにし、確定操作のみが`StaffShift`へ書き込む。

**Tech Stack:** Next.js (App Router) / React / TypeScript / Prisma / Vitest

---

## 前提知識（実装者向け）

- 設計書は`docs/superpowers/specs/2026-09-13-staff-shift-management-design.md`（読まなくても以下のタスクで完結する）。
- 認可パターン：`await auth()`で`session.user.role`を見る。`"hq"`または`"manager"`が店長権限、`"staff"`が施術者本人。店舗スコープの絞り込みは既存の`getCurrentAdminStoreScope()`（`app/actions/current-admin-scope.ts`）を使う。
- 時刻は分単位の数値でやり取りし、DB保存時は`new Date(\`1970-01-01T${minutesToLabel(minutes)}:00.000Z\`)`、読み出し時は`dbTimeToMinutes(date)`（`lib/reservation/time.ts`）を使う（既存の`create-temp-hold.ts`等と同じパターン）。
- 店舗の営業時間は`lib/reservation/store-hours.ts`の`getStoreOpenHours(store, date)`を使う。
- マイグレーション適用はユーザー自身の環境で`npx prisma migrate deploy`を実行してもらう（`migrate dev`のリセット確認プロンプトを避けるため）。
- 各タスクの最後に`npx tsc --noEmit -p tsconfig.json`を実行し、新規の型エラーが出ていないことを確認すること（既存の無関係な2件のエラーは無視してよい：`app/actions/current-admin-scope.test.ts(44,39)`と`app/actions/manage-permissions.ts(19,42)`）。

---

### Task 1: マイグレーション作成（Admin.staffId追加、StaffShiftRequest／StaffShiftDraft新規）

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260913010000_add_staff_shift_management/migration.sql`

- [ ] **Step 1: `prisma/schema.prisma`の`Admin`モデルを編集する**

`Admin`モデルの`inviteTokenExpiresAt`フィールドの直後に`staffId`を追加し、リレーション欄に`staff`を追加する：

```prisma
model Admin {
  id           Int       @id @default(autoincrement()) @map("admin_id")
  name         String    @db.VarChar(100)
  email        String    @unique @db.VarChar(255)
  passwordHash String?   @map("password_hash") @db.VarChar(255)
  role         AdminRole
  isActive     Boolean   @default(true) @map("is_active")
  inviteToken           String?   @unique @map("invite_token") @db.VarChar(255)
  inviteTokenExpiresAt  DateTime? @map("invite_token_expires_at")
  staffId      Int?      @map("staff_id")
  createdAt    DateTime  @default(now()) @map("created_at")

  stores            AdminStore[]
  segmentCampaigns SegmentCampaign[]
  staff             Staff?            @relation(fields: [staffId], references: [id])

  @@map("admins")
}
```

- [ ] **Step 2: `Staff`モデルに逆リレーションを追加する**

```prisma
model Staff {
  id            Int      @id @default(autoincrement()) @map("staff_id")
  storeId       Int      @map("store_id")
  name          String   @db.VarChar(100)
  photoUrl      String?  @map("photo_url") @db.VarChar(255)
  bio           String?
  nominationFee Int      @default(0) @map("nomination_fee")
  isActive      Boolean  @default(true) @map("is_active")
  createdAt     DateTime @default(now()) @map("created_at")

  store         Store          @relation(fields: [storeId], references: [id])
  shifts        StaffShift[]
  reservations  Reservation[]
  customerNotes CustomerNote[]
  admins        Admin[]
  shiftRequests StaffShiftRequest[]
  shiftDrafts   StaffShiftDraft[]

  @@map("staff")
}
```

- [ ] **Step 3: `StaffShiftRequest`と`StaffShiftDraft`モデルを新規追加する**

`model StaffShift { ... }`の直後に追加する：

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

model StaffShiftDraft {
  id          Int       @id @default(autoincrement()) @map("draft_id")
  staffId     Int       @map("staff_id")
  workDate    DateTime  @map("work_date") @db.Date
  startTime   DateTime? @map("start_time") @db.Time()
  endTime     DateTime? @map("end_time") @db.Time()
  isDayOff    Boolean   @default(false) @map("is_day_off")
  generatedAt DateTime  @default(now()) @map("generated_at")

  staff Staff @relation(fields: [staffId], references: [id])

  @@unique([staffId, workDate])
  @@map("staff_shift_drafts")
}
```

- [ ] **Step 4: マイグレーションファイルを作成する**

```bash
mkdir -p prisma/migrations/20260913010000_add_staff_shift_management
```

`prisma/migrations/20260913010000_add_staff_shift_management/migration.sql`を作成：

```sql
-- AlterTable
ALTER TABLE "admins" ADD COLUMN "staff_id" INTEGER;

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("staff_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "staff_shift_requests" (
    "request_id" SERIAL NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "work_date" DATE NOT NULL,
    "is_day_off_requested" BOOLEAN NOT NULL DEFAULT false,
    "preferred_start_time" TIME,
    "preferred_end_time" TIME,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_shift_requests_pkey" PRIMARY KEY ("request_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_shift_requests_staff_id_work_date_key" ON "staff_shift_requests"("staff_id", "work_date");

-- AddForeignKey
ALTER TABLE "staff_shift_requests" ADD CONSTRAINT "staff_shift_requests_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("staff_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "staff_shift_drafts" (
    "draft_id" SERIAL NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "work_date" DATE NOT NULL,
    "start_time" TIME,
    "end_time" TIME,
    "is_day_off" BOOLEAN NOT NULL DEFAULT false,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_shift_drafts_pkey" PRIMARY KEY ("draft_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_shift_drafts_staff_id_work_date_key" ON "staff_shift_drafts"("staff_id", "work_date");

-- AddForeignKey
ALTER TABLE "staff_shift_drafts" ADD CONSTRAINT "staff_shift_drafts_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("staff_id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 5: Prisma Clientを再生成する**

Run: `npx prisma generate`
Expected: `Generated Prisma Client` と表示される（`.env`が読めない旨のエラーが出ても、Client生成自体は成功する — このプロジェクトのサンドボックス既知事象）。

- [ ] **Step 6: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 前提知識に記載した既存2件以外のエラーなし。

- [ ] **Step 7: コミット**

```bash
git add prisma/schema.prisma prisma/migrations/20260913010000_add_staff_shift_management
git commit -m "feat: add Admin.staffId link and StaffShiftRequest/StaffShiftDraft tables

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

**このマイグレーションはこの時点ではまだ実DBに適用されていない。** 全タスク完了後、ユーザーに`npx prisma migrate deploy`の実行を依頼する（Task 9で案内する）。

---

### Task 2: `lib/scheduling/derive-shift-draft.ts`を実装する（TDD）

**Files:**
- Create: `lib/scheduling/derive-shift-draft.ts`
- Test: `lib/scheduling/derive-shift-draft.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`lib/scheduling/derive-shift-draft.test.ts`を新規作成：

```ts
import { describe, it, expect } from "vitest";
import { deriveDraftShift } from "./derive-shift-draft";

const STORE_HOURS = { openMinutes: 660, closeMinutes: 1110 }; // 11:00-18:30

describe("deriveDraftShift", () => {
  it("returns day off when there is no request", () => {
    const result = deriveDraftShift(null, STORE_HOURS);
    expect(result).toEqual({ isDayOff: true, startMinutes: null, endMinutes: null });
  });

  it("returns day off when the request asks for a day off", () => {
    const result = deriveDraftShift(
      { isDayOffRequested: true, preferredStartMinutes: null, preferredEndMinutes: null },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: true, startMinutes: null, endMinutes: null });
  });

  it("returns day off when times are missing despite not being a day-off request", () => {
    const result = deriveDraftShift(
      { isDayOffRequested: false, preferredStartMinutes: null, preferredEndMinutes: 1000 },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: true, startMinutes: null, endMinutes: null });
  });

  it("uses the requested time range as-is when it fits within store hours", () => {
    const result = deriveDraftShift(
      { isDayOffRequested: false, preferredStartMinutes: 700, preferredEndMinutes: 1000 },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: false, startMinutes: 700, endMinutes: 1000 });
  });

  it("clamps a requested start time earlier than store open", () => {
    const result = deriveDraftShift(
      { isDayOffRequested: false, preferredStartMinutes: 500, preferredEndMinutes: 1000 },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: false, startMinutes: 660, endMinutes: 1000 });
  });

  it("clamps a requested end time later than store close", () => {
    const result = deriveDraftShift(
      { isDayOffRequested: false, preferredStartMinutes: 700, preferredEndMinutes: 1200 },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: false, startMinutes: 700, endMinutes: 1110 });
  });

  it("falls back to a day off when clamping collapses the range to zero or negative width", () => {
    // 希望が丸ごと営業時間外（開店前に終わる希望）→ クランプ後 start(660) >= end(660)
    const result = deriveDraftShift(
      { isDayOffRequested: false, preferredStartMinutes: 500, preferredEndMinutes: 600 },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: true, startMinutes: null, endMinutes: null });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run lib/scheduling/derive-shift-draft.test.ts`
Expected: FAIL（`./derive-shift-draft`が存在しない）

- [ ] **Step 3: `lib/scheduling/derive-shift-draft.ts`を実装する**

```ts
import type { OpenHours } from "@/lib/reservation/store-hours";

export interface ShiftRequestInput {
  isDayOffRequested: boolean;
  preferredStartMinutes: number | null;
  preferredEndMinutes: number | null;
}

export interface DraftShiftResult {
  isDayOff: boolean;
  startMinutes: number | null;
  endMinutes: number | null;
}

const DAY_OFF: DraftShiftResult = { isDayOff: true, startMinutes: null, endMinutes: null };

/**
 * スタッフの希望（StaffShiftRequest相当）から、店舗の営業時間に収まる
 * ドラフトシフトを機械的に導出する（ルールベース、外部API呼び出しなし）。
 * 複数スタッフ間の必要人数調整は行わない（各人の希望を独立に変換するだけ）。
 * 店舗営業時間の型は既存の`getStoreOpenHours`の戻り値（`OpenHours`）をそのまま使う
 * （同じ形の型をここで再定義しない）。
 */
export function deriveDraftShift(
  request: ShiftRequestInput | null,
  storeHours: OpenHours,
): DraftShiftResult {
  if (!request || request.isDayOffRequested) {
    return DAY_OFF;
  }
  if (request.preferredStartMinutes === null || request.preferredEndMinutes === null) {
    return DAY_OFF;
  }

  const start = Math.max(request.preferredStartMinutes, storeHours.openMinutes);
  const end = Math.min(request.preferredEndMinutes, storeHours.closeMinutes);
  if (start >= end) {
    return DAY_OFF;
  }

  return { isDayOff: false, startMinutes: start, endMinutes: end };
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run lib/scheduling/derive-shift-draft.test.ts`
Expected: `Tests 7 passed (7)`

- [ ] **Step 5: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 新規エラーなし

- [ ] **Step 6: コミット**

```bash
git add lib/scheduling/derive-shift-draft.ts lib/scheduling/derive-shift-draft.test.ts
git commit -m "feat: add rule-based shift draft derivation logic

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 3: `app/actions/staff-shift-requests.ts`を実装する（TDD）

**Files:**
- Create: `app/actions/staff-shift-requests.ts`
- Test: `app/actions/staff-shift-requests.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/staff-shift-requests.test.ts`を新規作成：

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
        isDayOffRequested: false,
        preferredStartTime: new Date("1970-01-01T10:00:00.000Z"),
        preferredEndTime: new Date("1970-01-01T15:00:00.000Z"),
      },
    ] as never);

    const result = await getStaffShiftRequests(42, "2026-10");

    expect(result).toEqual([
      {
        workDate: "2026-10-01",
        isDayOffRequested: false,
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
      isDayOffRequested: false,
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
      isDayOffRequested: false,
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
        isDayOffRequested: false,
        preferredStartTime: new Date("1970-01-01T10:00:00.000Z"),
        preferredEndTime: new Date("1970-01-01T15:00:00.000Z"),
      },
      update: {
        isDayOffRequested: false,
        preferredStartTime: new Date("1970-01-01T10:00:00.000Z"),
        preferredEndTime: new Date("1970-01-01T15:00:00.000Z"),
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
        isDayOffRequested: true,
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
            isDayOffRequested: true,
            preferredStartMinutes: null,
            preferredEndMinutes: null,
          },
        ],
      },
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run app/actions/staff-shift-requests.test.ts`
Expected: FAIL（`./staff-shift-requests`が存在しない）

- [ ] **Step 3: `app/actions/staff-shift-requests.ts`を実装する**

```ts
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { dbTimeToMinutes, minutesToLabel } from "@/lib/reservation/time";
import { getCurrentAdminStoreScope } from "./current-admin-scope";

export interface StaffShiftRequestItem {
  workDate: string;
  isDayOffRequested: boolean;
  preferredStartMinutes: number | null;
  preferredEndMinutes: number | null;
}

function monthRange(yearMonth: string): { start: Date; end: Date } {
  const [year, month] = yearMonth.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 0)),
  };
}

function toItem(r: {
  workDate: Date;
  isDayOffRequested: boolean;
  preferredStartTime: Date | null;
  preferredEndTime: Date | null;
}): StaffShiftRequestItem {
  return {
    workDate: r.workDate.toISOString().slice(0, 10),
    isDayOffRequested: r.isDayOffRequested,
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
  isDayOffRequested: boolean;
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
      isDayOffRequested: params.isDayOffRequested,
      preferredStartTime,
      preferredEndTime,
    },
    update: {
      isDayOffRequested: params.isDayOffRequested,
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
Expected: 全テスト passed

- [ ] **Step 5: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 新規エラーなし

- [ ] **Step 6: コミット**

```bash
git add app/actions/staff-shift-requests.ts app/actions/staff-shift-requests.test.ts
git commit -m "feat: add staff shift request actions (self-service + manager view)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 4: `app/actions/generate-shift-draft.ts`を実装する（TDD）

**Files:**
- Create: `app/actions/generate-shift-draft.ts`
- Test: `app/actions/generate-shift-draft.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/generate-shift-draft.test.ts`を新規作成：

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
    staffShiftRequest: { findUnique: vi.fn() },
    staffShiftDraft: { upsert: vi.fn() },
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

  it("generates one draft row per staff per day of the month, using each day's request", async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValue(STORE as never);
    vi.mocked(prisma.staff.findMany).mockResolvedValue([{ id: 42, storeId: 1 }] as never);
    // 2026年10月は31日。全ての日で希望なし（休み扱いになる想定）。
    vi.mocked(prisma.staffShiftRequest.findUnique).mockResolvedValue(null as never);

    const result = await generateShiftDraftForStore(1, "2026-10");

    expect(result).toEqual({ status: "generated", count: 31 });
    expect(prisma.staffShiftDraft.upsert).toHaveBeenCalledTimes(31);
    expect(prisma.staffShiftDraft.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          staffId_workDate: { staffId: 42, workDate: new Date("2026-10-01T00:00:00.000Z") },
        },
        create: expect.objectContaining({
          staffId: 42,
          workDate: new Date("2026-10-01T00:00:00.000Z"),
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
    vi.mocked(prisma.staffShiftRequest.findUnique).mockImplementation(({ where }: never) => {
      const workDate: Date = where.staffId_workDate.workDate;
      if (workDate.getUTCDate() === 1) {
        return Promise.resolve({
          isDayOffRequested: false,
          preferredStartTime: new Date("1970-01-01T10:00:00.000Z"),
          preferredEndTime: new Date("1970-01-01T15:00:00.000Z"),
        } as never);
      }
      return Promise.resolve(null);
    });

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
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run app/actions/generate-shift-draft.test.ts`
Expected: FAIL（`./generate-shift-draft`が存在しない）

- [ ] **Step 3: `app/actions/generate-shift-draft.ts`を実装する**

```ts
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { dbTimeToMinutes, minutesToLabel } from "@/lib/reservation/time";
import { getStoreOpenHours } from "@/lib/reservation/store-hours";
import { deriveDraftShift } from "@/lib/scheduling/derive-shift-draft";
import { getCurrentAdminStoreScope } from "./current-admin-scope";

export type GenerateShiftDraftResult =
  | { status: "generated"; count: number }
  | { status: "unauthorized" };

function daysInMonth(yearMonth: string): number {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function workDateFor(yearMonth: string, day: number): Date {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function timeOrNull(minutes: number | null): Date | null {
  return minutes !== null
    ? new Date(`1970-01-01T${minutesToLabel(minutes)}:00.000Z`)
    : null;
}

export async function generateShiftDraftForStore(
  storeId: number,
  yearMonth: string,
): Promise<GenerateShiftDraftResult> {
  const session = await auth();
  if (!session?.user || (session.user.role !== "hq" && session.user.role !== "manager")) {
    return { status: "unauthorized" };
  }
  const scope = await getCurrentAdminStoreScope();
  if (!scope.isUnrestricted && !scope.storeIds.includes(storeId)) {
    return { status: "unauthorized" };
  }

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) {
    return { status: "unauthorized" };
  }

  const staffList = await prisma.staff.findMany({ where: { storeId, isActive: true } });
  const totalDays = daysInMonth(yearMonth);

  let count = 0;
  for (const staff of staffList) {
    for (let day = 1; day <= totalDays; day++) {
      const workDate = workDateFor(yearMonth, day);

      const request = await prisma.staffShiftRequest.findUnique({
        where: { staffId_workDate: { staffId: staff.id, workDate } },
      });

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

      const data = {
        isDayOff: draft.isDayOff,
        startTime: timeOrNull(draft.startMinutes),
        endTime: timeOrNull(draft.endMinutes),
      };

      await prisma.staffShiftDraft.upsert({
        where: { staffId_workDate: { staffId: staff.id, workDate } },
        create: { staffId: staff.id, workDate, ...data },
        update: data,
      });
      count++;
    }
  }

  return { status: "generated", count };
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run app/actions/generate-shift-draft.test.ts`
Expected: 全テスト passed

- [ ] **Step 5: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 新規エラーなし

- [ ] **Step 6: コミット**

```bash
git add app/actions/generate-shift-draft.ts app/actions/generate-shift-draft.test.ts
git commit -m "feat: add rule-based shift draft generation action

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 5: `app/actions/shift-drafts.ts`を実装する（TDD）

**Files:**
- Create: `app/actions/shift-drafts.ts`
- Test: `app/actions/shift-drafts.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/shift-drafts.test.ts`を新規作成：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listShiftDraftsForStore, updateShiftDraft, confirmShiftDraftForStore } from "./shift-drafts";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { getCurrentAdminStoreScope } from "./current-admin-scope";

vi.mock("@/lib/db", () => ({
  prisma: {
    staff: { findMany: vi.fn(), findUnique: vi.fn() },
    staffShiftDraft: { findMany: vi.fn(), upsert: vi.fn() },
    staffShift: { upsert: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("./current-admin-scope", () => ({
  getCurrentAdminStoreScope: vi.fn(),
}));

describe("listShiftDraftsForStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", role: "manager" } } as never);
    vi.mocked(getCurrentAdminStoreScope).mockResolvedValue({
      isUnrestricted: false,
      storeIds: [1],
    });
  });

  it("returns unauthorized for a non-manager role", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "staff" } } as never);

    const result = await listShiftDraftsForStore(1, "2026-10");

    expect(result).toEqual({ status: "unauthorized" });
  });

  it("returns drafts grouped by staffId", async () => {
    vi.mocked(prisma.staff.findMany).mockResolvedValue([{ id: 42 }] as never);
    vi.mocked(prisma.staffShiftDraft.findMany).mockResolvedValue([
      {
        staffId: 42,
        workDate: new Date("2026-10-01T00:00:00.000Z"),
        isDayOff: false,
        startTime: new Date("1970-01-01T11:00:00.000Z"),
        endTime: new Date("1970-01-01T15:00:00.000Z"),
      },
    ] as never);

    const result = await listShiftDraftsForStore(1, "2026-10");

    expect(result).toEqual({
      status: "ok",
      draftsByStaffId: {
        42: [
          {
            workDate: "2026-10-01",
            isDayOff: false,
            startMinutes: 660,
            endMinutes: 900,
          },
        ],
      },
    });
  });
});

describe("updateShiftDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", role: "manager" } } as never);
    vi.mocked(getCurrentAdminStoreScope).mockResolvedValue({
      isUnrestricted: false,
      storeIds: [1],
    });
  });

  it("returns unauthorized for a non-manager role", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "staff" } } as never);

    const result = await updateShiftDraft({
      staffId: 42,
      workDate: "2026-10-01",
      isDayOff: true,
      startMinutes: null,
      endMinutes: null,
    });

    expect(result).toEqual({ status: "unauthorized" });
    expect(prisma.staffShiftDraft.upsert).not.toHaveBeenCalled();
  });

  it("returns unauthorized when the staff's store is outside the manager's scope", async () => {
    vi.mocked(prisma.staff.findUnique).mockResolvedValue({ id: 42, storeId: 2 } as never);

    const result = await updateShiftDraft({
      staffId: 42,
      workDate: "2026-10-01",
      isDayOff: true,
      startMinutes: null,
      endMinutes: null,
    });

    expect(result).toEqual({ status: "unauthorized" });
    expect(prisma.staffShiftDraft.upsert).not.toHaveBeenCalled();
  });

  it("upserts the draft when authorized", async () => {
    vi.mocked(prisma.staff.findUnique).mockResolvedValue({ id: 42, storeId: 1 } as never);

    const result = await updateShiftDraft({
      staffId: 42,
      workDate: "2026-10-01",
      isDayOff: false,
      startMinutes: 660,
      endMinutes: 900,
    });

    expect(result).toEqual({ status: "updated" });
    expect(prisma.staffShiftDraft.upsert).toHaveBeenCalledWith({
      where: {
        staffId_workDate: { staffId: 42, workDate: new Date("2026-10-01T00:00:00.000Z") },
      },
      create: {
        staffId: 42,
        workDate: new Date("2026-10-01T00:00:00.000Z"),
        isDayOff: false,
        startTime: new Date("1970-01-01T11:00:00.000Z"),
        endTime: new Date("1970-01-01T15:00:00.000Z"),
      },
      update: {
        isDayOff: false,
        startTime: new Date("1970-01-01T11:00:00.000Z"),
        endTime: new Date("1970-01-01T15:00:00.000Z"),
      },
    });
  });
});

describe("confirmShiftDraftForStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", role: "manager" } } as never);
    vi.mocked(getCurrentAdminStoreScope).mockResolvedValue({
      isUnrestricted: false,
      storeIds: [1],
    });
  });

  it("returns unauthorized for a non-manager role", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "staff" } } as never);

    const result = await confirmShiftDraftForStore(1, "2026-10");

    expect(result).toEqual({ status: "unauthorized" });
    expect(prisma.staffShift.upsert).not.toHaveBeenCalled();
  });

  it("copies every draft row for the store's staff into StaffShift", async () => {
    vi.mocked(prisma.staff.findMany).mockResolvedValue([{ id: 42 }] as never);
    vi.mocked(prisma.staffShiftDraft.findMany).mockResolvedValue([
      {
        staffId: 42,
        workDate: new Date("2026-10-01T00:00:00.000Z"),
        isDayOff: false,
        startTime: new Date("1970-01-01T11:00:00.000Z"),
        endTime: new Date("1970-01-01T15:00:00.000Z"),
      },
    ] as never);

    const result = await confirmShiftDraftForStore(1, "2026-10");

    expect(result).toEqual({ status: "confirmed", count: 1 });
    expect(prisma.staffShift.upsert).toHaveBeenCalledWith({
      where: {
        staffId_workDate: { staffId: 42, workDate: new Date("2026-10-01T00:00:00.000Z") },
      },
      create: {
        staffId: 42,
        workDate: new Date("2026-10-01T00:00:00.000Z"),
        isDayOff: false,
        startTime: new Date("1970-01-01T11:00:00.000Z"),
        endTime: new Date("1970-01-01T15:00:00.000Z"),
      },
      update: {
        isDayOff: false,
        startTime: new Date("1970-01-01T11:00:00.000Z"),
        endTime: new Date("1970-01-01T15:00:00.000Z"),
      },
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run app/actions/shift-drafts.test.ts`
Expected: FAIL（`./shift-drafts`が存在しない）

- [ ] **Step 3: `app/actions/shift-drafts.ts`を実装する**

```ts
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { dbTimeToMinutes, minutesToLabel } from "@/lib/reservation/time";
import { getCurrentAdminStoreScope } from "./current-admin-scope";

export interface ShiftDraftItem {
  workDate: string;
  isDayOff: boolean;
  startMinutes: number | null;
  endMinutes: number | null;
}

function monthRange(yearMonth: string): { start: Date; end: Date } {
  const [year, month] = yearMonth.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 0)),
  };
}

function timeOrNull(minutes: number | null): Date | null {
  return minutes !== null
    ? new Date(`1970-01-01T${minutesToLabel(minutes)}:00.000Z`)
    : null;
}

async function requireManagerForStore(storeId: number): Promise<boolean> {
  const session = await auth();
  if (!session?.user || (session.user.role !== "hq" && session.user.role !== "manager")) {
    return false;
  }
  const scope = await getCurrentAdminStoreScope();
  return scope.isUnrestricted || scope.storeIds.includes(storeId);
}

export type ListShiftDraftsForStoreResult =
  | { status: "ok"; draftsByStaffId: Record<number, ShiftDraftItem[]> }
  | { status: "unauthorized" };

export async function listShiftDraftsForStore(
  storeId: number,
  yearMonth: string,
): Promise<ListShiftDraftsForStoreResult> {
  if (!(await requireManagerForStore(storeId))) {
    return { status: "unauthorized" };
  }

  const staffList = await prisma.staff.findMany({ where: { storeId, isActive: true } });
  const { start, end } = monthRange(yearMonth);
  const drafts = await prisma.staffShiftDraft.findMany({
    where: { staffId: { in: staffList.map((s) => s.id) }, workDate: { gte: start, lte: end } },
    orderBy: { workDate: "asc" },
  });

  const draftsByStaffId: Record<number, ShiftDraftItem[]> = {};
  for (const d of drafts) {
    draftsByStaffId[d.staffId] = draftsByStaffId[d.staffId] ?? [];
    draftsByStaffId[d.staffId].push({
      workDate: d.workDate.toISOString().slice(0, 10),
      isDayOff: d.isDayOff,
      startMinutes: d.startTime ? dbTimeToMinutes(d.startTime) : null,
      endMinutes: d.endTime ? dbTimeToMinutes(d.endTime) : null,
    });
  }

  return { status: "ok", draftsByStaffId };
}

export interface UpdateShiftDraftParams {
  staffId: number;
  workDate: string;
  isDayOff: boolean;
  startMinutes: number | null;
  endMinutes: number | null;
}

export type UpdateShiftDraftResult = { status: "updated" } | { status: "unauthorized" };

export async function updateShiftDraft(
  params: UpdateShiftDraftParams,
): Promise<UpdateShiftDraftResult> {
  const session = await auth();
  if (!session?.user || (session.user.role !== "hq" && session.user.role !== "manager")) {
    return { status: "unauthorized" };
  }

  const staff = await prisma.staff.findUnique({ where: { id: params.staffId } });
  if (!staff) {
    return { status: "unauthorized" };
  }
  const scope = await getCurrentAdminStoreScope();
  if (!scope.isUnrestricted && !scope.storeIds.includes(staff.storeId)) {
    return { status: "unauthorized" };
  }

  const workDate = new Date(`${params.workDate}T00:00:00.000Z`);
  const data = {
    isDayOff: params.isDayOff,
    startTime: timeOrNull(params.startMinutes),
    endTime: timeOrNull(params.endMinutes),
  };

  await prisma.staffShiftDraft.upsert({
    where: { staffId_workDate: { staffId: params.staffId, workDate } },
    create: { staffId: params.staffId, workDate, ...data },
    update: data,
  });

  return { status: "updated" };
}

export type ConfirmShiftDraftForStoreResult =
  | { status: "confirmed"; count: number }
  | { status: "unauthorized" };

export async function confirmShiftDraftForStore(
  storeId: number,
  yearMonth: string,
): Promise<ConfirmShiftDraftForStoreResult> {
  if (!(await requireManagerForStore(storeId))) {
    return { status: "unauthorized" };
  }

  const staffList = await prisma.staff.findMany({ where: { storeId, isActive: true } });
  const { start, end } = monthRange(yearMonth);
  const drafts = await prisma.staffShiftDraft.findMany({
    where: { staffId: { in: staffList.map((s) => s.id) }, workDate: { gte: start, lte: end } },
  });

  let count = 0;
  for (const d of drafts) {
    const data = { isDayOff: d.isDayOff, startTime: d.startTime, endTime: d.endTime };
    await prisma.staffShift.upsert({
      where: { staffId_workDate: { staffId: d.staffId, workDate: d.workDate } },
      create: { staffId: d.staffId, workDate: d.workDate, ...data },
      update: data,
    });
    count++;
  }

  return { status: "confirmed", count };
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run app/actions/shift-drafts.test.ts`
Expected: 全テスト passed

- [ ] **Step 5: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 新規エラーなし

- [ ] **Step 6: コミット**

```bash
git add app/actions/shift-drafts.ts app/actions/shift-drafts.test.ts
git commit -m "feat: add shift draft listing, editing, and confirmation actions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 6: `/admin/my-shift-requests`ページを新規作成する

**Files:**
- Create: `app/admin/(dashboard)/my-shift-requests/page.tsx`

このタスクは表示のみの変更（Task 3のアクションを使うだけ）のため、新規のアクションテストは書かない。

- [ ] **Step 1: `app/admin/(dashboard)/my-shift-requests/page.tsx`を新規作成する**

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  getMyStaffId,
  getStaffShiftRequests,
  saveStaffShiftRequest,
  type StaffShiftRequestItem,
} from "@/app/actions/staff-shift-requests";

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
  if (minutes === null) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const EMPTY_ITEM = (workDate: string): StaffShiftRequestItem => ({
  workDate,
  isDayOffRequested: false,
  preferredStartMinutes: null,
  preferredEndMinutes: null,
});

export default function MyShiftRequestsPage() {
  const [staffId, setStaffId] = useState<number | null | undefined>(undefined);
  const [yearMonth, setYearMonth] = useState(yearMonthWithOffset(1));
  const [requests, setRequests] = useState<Map<string, StaffShiftRequestItem>>(new Map());

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
    const next = { ...(requests.get(workDate) ?? EMPTY_ITEM(workDate)), ...patch };
    setRequests((prev) => new Map(prev).set(workDate, next));
    await saveStaffShiftRequest({
      staffId,
      workDate,
      isDayOffRequested: next.isDayOffRequested,
      preferredStartMinutes: next.preferredStartMinutes,
      preferredEndMinutes: next.preferredEndMinutes,
    });
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

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-neutral-500">
              <th className="p-2 font-medium">日付</th>
              <th className="p-2 font-medium">休み希望</th>
              <th className="p-2 font-medium">希望開始</th>
              <th className="p-2 font-medium">希望終了</th>
            </tr>
          </thead>
          <tbody>
            {daysInYearMonth(yearMonth).map((workDate) => {
              const item = requests.get(workDate);
              const isDayOff = item?.isDayOffRequested ?? false;
              return (
                <tr key={workDate} className="border-b border-neutral-100 last:border-0">
                  <td className="p-2 text-neutral-800">{workDate}</td>
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={isDayOff}
                      onChange={(e) =>
                        handleChange(workDate, {
                          isDayOffRequested: e.target.checked,
                          preferredStartMinutes: e.target.checked ? null : item?.preferredStartMinutes ?? null,
                          preferredEndMinutes: e.target.checked ? null : item?.preferredEndMinutes ?? null,
                        })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="time"
                      disabled={isDayOff}
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
                      disabled={isDayOff}
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
Expected: 新規エラーなし

- [ ] **Step 3: コミット**

```bash
git add "app/admin/(dashboard)/my-shift-requests/page.tsx"
git commit -m "feat: add staff self-service shift request page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 7: `/admin/staff-shifts`ページを新規作成する

**Files:**
- Create: `app/admin/(dashboard)/staff-shifts/page.tsx`

このタスクも表示のみの変更のため、新規のアクションテストは書かない。

- [ ] **Step 1: `app/admin/(dashboard)/staff-shifts/page.tsx`を新規作成する**

```tsx
"use client";

import { useEffect, useState } from "react";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { getCurrentAdminStoreScope, type AdminStoreScope } from "@/app/actions/current-admin-scope";
import { listStaffForStore, type StaffListItem } from "@/app/actions/staff";
import { listShiftRequestsForStore, type StaffShiftRequestItem } from "@/app/actions/staff-shift-requests";
import { generateShiftDraftForStore } from "@/app/actions/generate-shift-draft";
import {
  listShiftDraftsForStore,
  updateShiftDraft,
  confirmShiftDraftForStore,
  type ShiftDraftItem,
} from "@/app/actions/shift-drafts";

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
  if (minutes === null) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function requestSummary(item: StaffShiftRequestItem | undefined): string {
  if (!item) return "未提出";
  if (item.isDayOffRequested) return "休み希望";
  if (item.preferredStartMinutes !== null && item.preferredEndMinutes !== null) {
    return `${timeInputFromMinutes(item.preferredStartMinutes)}〜${timeInputFromMinutes(item.preferredEndMinutes)}`;
  }
  return "未提出";
}

export default function StaffShiftsPage() {
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [scope, setScope] = useState<AdminStoreScope>({ isUnrestricted: true, storeIds: [] });
  const [storeId, setStoreId] = useState<number | null>(null);
  const [yearMonth, setYearMonth] = useState(yearMonthWithOffset(1));
  const [staffList, setStaffList] = useState<StaffListItem[]>([]);
  const [requestsByStaffId, setRequestsByStaffId] = useState<Record<number, StaffShiftRequestItem[]>>({});
  const [draftsByStaffId, setDraftsByStaffId] = useState<Record<number, ShiftDraftItem[]>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listStores(), getCurrentAdminStoreScope()]).then(([list, s]) => {
      setStores(list);
      setScope(s);
      const visible = s.isUnrestricted ? list : list.filter((store) => s.storeIds.includes(store.id));
      if (visible.length > 0) setStoreId(visible[0].id);
    });
  }, []);

  async function reload() {
    if (storeId === null) return;
    const [staff, requestsResult, draftsResult] = await Promise.all([
      listStaffForStore(storeId),
      listShiftRequestsForStore(storeId, yearMonth),
      listShiftDraftsForStore(storeId, yearMonth),
    ]);
    setStaffList(staff);
    setRequestsByStaffId(requestsResult.status === "ok" ? requestsResult.requestsByStaffId : {});
    setDraftsByStaffId(draftsResult.status === "ok" ? draftsResult.draftsByStaffId : {});
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, yearMonth]);

  const visibleStores = scope.isUnrestricted ? stores : stores.filter((s) => scope.storeIds.includes(s.id));
  const days = daysInYearMonth(yearMonth);

  function draftFor(staffId: number, workDate: string): ShiftDraftItem | undefined {
    return draftsByStaffId[staffId]?.find((d) => d.workDate === workDate);
  }

  async function handleGenerate() {
    if (storeId === null) return;
    const result = await generateShiftDraftForStore(storeId, yearMonth);
    if (result.status === "generated") {
      setMessage(`${result.count}件のドラフトを作成しました。`);
      reload();
    } else {
      setMessage("ドラフトの作成に失敗しました。");
    }
  }

  async function handleDraftChange(staffId: number, workDate: string, patch: Partial<ShiftDraftItem>) {
    const current = draftFor(staffId, workDate) ?? {
      workDate,
      isDayOff: true,
      startMinutes: null,
      endMinutes: null,
    };
    const next = { ...current, ...patch };
    await updateShiftDraft({
      staffId,
      workDate,
      isDayOff: next.isDayOff,
      startMinutes: next.startMinutes,
      endMinutes: next.endMinutes,
    });
    reload();
  }

  async function handleConfirm() {
    if (storeId === null) return;
    const result = await confirmShiftDraftForStore(storeId, yearMonth);
    if (result.status === "confirmed") {
      setMessage(`${result.count}件のシフトを確定しました。`);
    } else {
      setMessage("確定に失敗しました。");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl text-primary-700">スタッフシフト管理</h1>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={storeId ?? ""}
          onChange={(e) => setStoreId(e.target.value ? Number(e.target.value) : null)}
          className="h-10 rounded-md border border-neutral-300 px-2 text-sm"
        >
          {visibleStores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
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
        <button
          type="button"
          onClick={handleGenerate}
          className="h-10 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white"
        >
          AIで自動作成
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="h-10 rounded-lg bg-accent-500 px-4 text-sm font-medium text-white"
        >
          確定する
        </button>
      </div>

      {message && <p className="text-sm text-neutral-600">{message}</p>}

      <div>
        <h2 className="mb-2 text-sm font-medium text-neutral-600">提出済みの希望（閲覧のみ）</h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="w-24 p-2 text-left font-medium text-neutral-700">日付</th>
                {staffList.map((s) => (
                  <th key={s.id} className="p-2 text-left font-medium text-neutral-700">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((workDate) => (
                <tr key={workDate} className="border-b border-neutral-100 last:border-0">
                  <td className="p-2 text-xs text-neutral-500">{workDate}</td>
                  {staffList.map((s) => (
                    <td key={s.id} className="p-2 text-xs text-neutral-700">
                      {requestSummary(requestsByStaffId[s.id]?.find((r) => r.workDate === workDate))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-neutral-600">ドラフト（クリックして編集）</h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="w-24 p-2 text-left font-medium text-neutral-700">日付</th>
                {staffList.map((s) => (
                  <th key={s.id} className="p-2 text-left font-medium text-neutral-700">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((workDate) => (
                <tr key={workDate} className="border-b border-neutral-100 last:border-0">
                  <td className="p-2 text-xs text-neutral-500">{workDate}</td>
                  {staffList.map((s) => {
                    const draft = draftFor(s.id, workDate);
                    const isDayOff = draft?.isDayOff ?? true;
                    return (
                      <td key={s.id} className="p-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={isDayOff}
                            onChange={(e) =>
                              handleDraftChange(s.id, workDate, {
                                isDayOff: e.target.checked,
                                startMinutes: e.target.checked ? null : draft?.startMinutes ?? null,
                                endMinutes: e.target.checked ? null : draft?.endMinutes ?? null,
                              })
                            }
                          />
                          <input
                            type="time"
                            disabled={isDayOff}
                            value={timeInputFromMinutes(draft?.startMinutes ?? null)}
                            onChange={(e) =>
                              handleDraftChange(s.id, workDate, {
                                startMinutes: minutesFromTimeInput(e.target.value),
                              })
                            }
                            className="w-20 rounded-md border border-neutral-300 px-1 py-0.5 text-xs disabled:opacity-50"
                          />
                          <input
                            type="time"
                            disabled={isDayOff}
                            value={timeInputFromMinutes(draft?.endMinutes ?? null)}
                            onChange={(e) =>
                              handleDraftChange(s.id, workDate, {
                                endMinutes: minutesFromTimeInput(e.target.value),
                              })
                            }
                            className="w-20 rounded-md border border-neutral-300 px-1 py-0.5 text-xs disabled:opacity-50"
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 新規エラーなし

- [ ] **Step 3: コミット**

```bash
git add "app/admin/(dashboard)/staff-shifts/page.tsx"
git commit -m "feat: add manager shift draft review/generate/confirm page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 8: ナビゲーションに新規ページを追加する

**Files:**
- Modify: `app/admin/(dashboard)/layout.tsx`

- [ ] **Step 1: importとNAV_ITEMSを編集する**

`lucide-react`のimportに`CalendarClock`と`CalendarCheck`を追加する（`CalendarDays`の直後などに）：

```tsx
import {
  LayoutDashboard,
  CalendarDays,
  CalendarClock,
  CalendarCheck,
  Users,
  Tag,
  PhoneCall,
  ListChecks,
  Percent,
  UserCog,
  Store,
  ChartColumn,
  Send,
} from "lucide-react";
```

`NAV_ITEMS`配列の`{ href: "/admin/staff", label: "スタッフ管理", icon: UserCog }`の直後に2件追加する：

```ts
const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/admin/calendar", label: "予約カレンダー", icon: CalendarDays },
  { href: "/admin/customers", label: "顧客管理", icon: Users },
  { href: "/admin/customer-statuses", label: "ステータス設定", icon: Tag },
  { href: "/admin/reservations/new", label: "電話予約登録", icon: PhoneCall },
  { href: "/admin/menu", label: "メニュー・料金管理", icon: ListChecks },
  { href: "/admin/campaigns", label: "キャンペーン管理", icon: Percent },
  { href: "/admin/staff", label: "スタッフ管理", icon: UserCog },
  { href: "/admin/staff-shifts", label: "スタッフシフト管理", icon: CalendarClock },
  { href: "/admin/my-shift-requests", label: "シフト希望", icon: CalendarCheck },
  { href: "/admin/stores", label: "店舗管理", icon: Store },
  { href: "/admin/reports", label: "売上・月報レポート", icon: ChartColumn },
  { href: "/admin/segment-campaigns", label: "メール／LINE配信管理", icon: Send },
] as const;
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 新規エラーなし

- [ ] **Step 3: コミット**

```bash
git add "app/admin/(dashboard)/layout.tsx"
git commit -m "feat: add shift management pages to admin navigation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 9: 最終確認

**Files:** なし（確認のみ）

- [ ] **Step 1: 全体テストを実行する**

Run: `npx vitest run lib/scheduling/derive-shift-draft.test.ts app/actions/staff-shift-requests.test.ts app/actions/generate-shift-draft.test.ts app/actions/shift-drafts.test.ts`
Expected: 全て passed

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 前提知識に記載した既存2件以外のエラーなし

- [ ] **Step 3: ユーザーにマイグレーション適用と動作確認を依頼する**

以下を案内する：
1. `npx prisma migrate deploy`を実行してマイグレーションを適用する。
2. 少なくとも1つの`Admin`（role: staff）に`staffId`を設定する必要がある（現状、招待・編集画面から`staffId`を設定するUIは無いため、Prisma Studio等から手動で設定してもらう。今後のタスクとして管理画面への項目追加を検討してもよい旨を伝える）。
3. `npm run dev`起動後、スタッフ役のアカウントで`/admin/my-shift-requests`から希望を入力し、店長役のアカウントで`/admin/staff-shifts`から自動作成→確定までの一連の流れを確認してもらう。
