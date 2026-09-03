# 店舗向けアプリ内通知 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** WEB予約が入った時・キャンセルが発生した時（管理画面・マイページどちらからも）に、対象店舗向けの通知レコードを作成し、管理画面のヘッダーに通知ベル（未読件数バッジ・一覧・既読化）を表示する。画面仕様書には明記されていない、ユーザーからの追加要望による新規機能。

**Architecture:** 新規`notifications`テーブルに1件ずつレコードを作成する。作成処理は`lib/notifications/create-notification.ts`の単一の関数に集約し、WEB予約確定（`confirm-reservation.ts`）・管理画面からのキャンセル（`reservation-detail.ts`）・マイページからのキャンセル（`member-reservation-detail.ts`）の3箇所から呼び出す。閲覧・既読化は`app/actions/notifications.ts`（Server Action）と管理画面レイアウトに追加する通知ベルのクライアントコンポーネントで行う。外部送信は行わない（メールでのアラートは今回のスコープ外）。

**Tech Stack:** Next.js 16 App Router / TypeScript / Prisma / Vitest

**参照元資料:** なし（画面仕様書には記載のない追加機能。ユーザーとの会話で合意した仕様）

---

## 実行環境に関する注記（継承）

- `.git`への書き込み（`git add`/`git commit`含む）は一切実行できない。ユーザーが自分のターミナルで実行する。
- `.env`/`.env.*`は読み取り・書き込みともに不可。
- `npm run build`・`npm run dev`はこのサンドボックスでは不安定なため実行しない。検証は`npx tsc --noEmit`・`npx eslint .`・`npx vitest run`で行う。
- **CRITICAL: このPhaseは既存の3ファイル（`confirm-reservation.ts`・`reservation-detail.ts`・`member-reservation-detail.ts`）を変更する。** 各Taskで指定するのは「ファイル全体の新しい内容」であり、既存のロジック（認可チェック・ステータス判定等）は一切変更しない。通知作成の呼び出しを追加するだけ。既存のテストケースもすべてそのまま残し、新しいテストケースのみ追加すること。既存テストを削除・改変しないこと。
- 仕様にある関数・ロジックを自己判断で別実装に置き換えない。もし仕様通りに実装できないと判断した場合は、黙って別実装にせず、範囲を絞った`// eslint-disable-next-line`＋理由コメント、またはDONE_WITH_CONCERNSとして報告すること。

---

## スコープ決定事項

1. **アプリ内通知のみ**。メール等の外部アラートは対象外（ユーザーとの合意事項）。
2. **通知イベントは「WEB予約確定時」「キャンセル発生時（管理画面・マイページ両方）」のみ**。No-show検知等は対象外（ユーザーとの合意事項）。
3. **通知は店舗ごとに保存するが、管理画面の通知ベルは全店舗分をまとめて表示する**（現状セッションに`storeId`情報がなく、店舗別の絞り込みUIを作る前提条件が整っていないため）。`listNotifications`等の関数自体は`storeId`引数を受け付ける設計にしておき、将来的な店舗別表示に対応できるようにする。
4. **通知メッセージは日付・時刻のみの簡潔な内容**とし、詳細は通知クリック時に予約詳細画面（`/admin/reservations/[id]`）へ遷移して確認する。

---

## Task 1: notificationsテーブルの追加

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260905020000_add_notifications/migration.sql`

- [ ] **Step 1: スキーマを変更する**

`prisma/schema.prisma`の`CronJobLog`モデルの直後（ファイル末尾）に以下を追加する：

```prisma
enum NotificationType {
  new_reservation
  cancellation

  @@map("notification_type")
}

model Notification {
  id            Int              @id @default(autoincrement()) @map("notification_id")
  storeId       Int              @map("store_id")
  type          NotificationType
  message       String           @db.VarChar(255)
  reservationId Int              @map("reservation_id")
  isRead        Boolean          @default(false) @map("is_read")
  createdAt     DateTime         @default(now()) @map("created_at")

  store       Store       @relation(fields: [storeId], references: [id])
  reservation Reservation @relation(fields: [reservationId], references: [id])

  @@index([storeId, isRead])
  @@map("notifications")
}
```

`Store`モデルの`reservations`行の直後にリレーションを追加する（変更前後）：

変更前:
```prisma
  campaigns      Campaign[]
  reservations   Reservation[]

  @@map("stores")
```

変更後:
```prisma
  campaigns      Campaign[]
  reservations   Reservation[]
  notifications  Notification[]

  @@map("stores")
```

`Reservation`モデルの`items`行の直後にリレーションを追加する（変更前後）：

変更前:
```prisma
  member Member?           @relation(fields: [memberId], references: [id])
  store  Store             @relation(fields: [storeId], references: [id])
  staff  Staff?            @relation(fields: [staffId], references: [id])
  items  ReservationItem[]

  @@index([storeId, reservationDate, staffId])
```

変更後:
```prisma
  member Member?           @relation(fields: [memberId], references: [id])
  store  Store             @relation(fields: [storeId], references: [id])
  staff  Staff?            @relation(fields: [staffId], references: [id])
  items  ReservationItem[]
  notifications Notification[]

  @@index([storeId, reservationDate, staffId])
```

- [ ] **Step 2: マイグレーションSQLを手動作成する**

`prisma/migrations/20260905020000_add_notifications/migration.sql`:

```sql
-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('new_reservation', 'cancellation');

-- CreateTable
CREATE TABLE "notifications" (
    "notification_id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "type" "notification_type" NOT NULL,
    "message" VARCHAR(255) NOT NULL,
    "reservation_id" INTEGER NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("notification_id")
);

-- CreateIndex
CREATE INDEX "notifications_store_id_is_read_idx" ON "notifications"("store_id", "is_read");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("reservation_id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 3: スキーマ構文を検証し、Prisma Clientを再生成する**

```bash
DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" DIRECT_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma validate
DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" DIRECT_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate
```

Expected: `The schema at prisma/schema.prisma is valid 🚀` および Prisma Client生成成功

- [ ] **Step 4: 変更ファイルを報告する（コミット・マイグレーション実行はしない）**

ユーザーには「`npx prisma migrate dev`を実行してください」と伝える。

---

## Task 2: 通知作成の共通ヘルパー（TDD）

**Files:**
- Create: `lib/notifications/create-notification.ts`
- Test: `lib/notifications/create-notification.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`lib/notifications/create-notification.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNotification } from "./create-notification";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    notification: { create: vi.fn() },
  },
}));

describe("createNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a notification row with the given fields", async () => {
    vi.mocked(prisma.notification.create).mockResolvedValue({} as never);

    await createNotification({
      storeId: 2,
      type: "new_reservation",
      message: "新規WEB予約：2026-09-10 10:30〜",
      reservationId: 55,
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        storeId: 2,
        type: "new_reservation",
        message: "新規WEB予約：2026-09-10 10:30〜",
        reservationId: 55,
      },
    });
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

```bash
npx vitest run lib/notifications/create-notification.test.ts
```

Expected: FAIL

- [ ] **Step 3: 実装する**

`lib/notifications/create-notification.ts`:

```typescript
import { prisma } from "@/lib/db";

export type NotificationType = "new_reservation" | "cancellation";

export interface CreateNotificationParams {
  storeId: number;
  type: NotificationType;
  message: string;
  reservationId: number;
}

export async function createNotification(params: CreateNotificationParams): Promise<void> {
  await prisma.notification.create({
    data: {
      storeId: params.storeId,
      type: params.type,
      message: params.message,
      reservationId: params.reservationId,
    },
  });
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

```bash
npx vitest run lib/notifications/create-notification.test.ts
```

Expected: PASS（1 test）

- [ ] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 3: 通知取得・既読化Server Action（TDD）

**Files:**
- Create: `app/actions/notifications.ts`
- Test: `app/actions/notifications.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/notifications.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "./notifications";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/lib/db", () => ({
  prisma: {
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

describe("listNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a non-admin session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "member" } } as never);

    await expect(listNotifications(null)).rejects.toThrow("unauthorized");
    expect(prisma.notification.findMany).not.toHaveBeenCalled();
  });

  it("returns notifications ordered by newest first", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.notification.findMany).mockResolvedValue([
      {
        id: 1,
        type: "new_reservation",
        message: "新規WEB予約：2026-09-10 10:30〜",
        reservationId: 55,
        isRead: false,
        createdAt: new Date("2026-09-05T10:30:00.000Z"),
        storeId: 2,
      },
    ] as never);

    const result = await listNotifications(null);

    expect(result).toEqual([
      {
        id: 1,
        type: "new_reservation",
        message: "新規WEB予約：2026-09-10 10:30〜",
        reservationId: 55,
        isRead: false,
        createdAt: "2026-09-05T10:30:00.000Z",
        storeId: 2,
      },
    ]);
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  });

  it("filters by store when a storeId is given", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.notification.findMany).mockResolvedValue([] as never);

    await listNotifications(2);

    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { storeId: 2 },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  });
});

describe("getUnreadNotificationCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a non-admin session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    await expect(getUnreadNotificationCount(null)).rejects.toThrow("unauthorized");
  });

  it("counts unread notifications", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.notification.count).mockResolvedValue(3 as never);

    const result = await getUnreadNotificationCount(null);

    expect(result).toBe(3);
    expect(prisma.notification.count).toHaveBeenCalledWith({ where: { isRead: false } });
  });
});

describe("markNotificationAsRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a non-admin session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "member" } } as never);

    await expect(markNotificationAsRead(1)).rejects.toThrow("unauthorized");
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it("marks a notification as read", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.notification.update).mockResolvedValue({} as never);

    await markNotificationAsRead(1);

    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isRead: true },
    });
  });
});

describe("markAllNotificationsAsRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks all unread notifications as read", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.notification.updateMany).mockResolvedValue({} as never);

    await markAllNotificationsAsRead(null);

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { isRead: false },
      data: { isRead: true },
    });
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

```bash
npx vitest run app/actions/notifications.test.ts
```

Expected: FAIL

- [ ] **Step 3: 実装する**

`app/actions/notifications.ts`:

```typescript
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

const ADMIN_ROLES = new Set(["hq", "manager", "staff"]);

export type NotificationType = "new_reservation" | "cancellation";

export interface NotificationItem {
  id: number;
  type: NotificationType;
  message: string;
  reservationId: number;
  isRead: boolean;
  createdAt: string;
  storeId: number;
}

export async function listNotifications(storeId: number | null): Promise<NotificationItem[]> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  const notifications = await prisma.notification.findMany({
    where: storeId ? { storeId } : {},
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return notifications.map((n) => ({
    id: n.id,
    type: n.type,
    message: n.message,
    reservationId: n.reservationId,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
    storeId: n.storeId,
  }));
}

export async function getUnreadNotificationCount(storeId: number | null): Promise<number> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  return prisma.notification.count({
    where: storeId ? { isRead: false, storeId } : { isRead: false },
  });
}

export async function markNotificationAsRead(notificationId: number): Promise<void> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

export async function markAllNotificationsAsRead(storeId: number | null): Promise<void> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  await prisma.notification.updateMany({
    where: storeId ? { isRead: false, storeId } : { isRead: false },
    data: { isRead: true },
  });
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

```bash
npx vitest run app/actions/notifications.test.ts
```

Expected: PASS（8 tests）

- [ ] **Step 5: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 4: WEB予約確定時に通知を作成する（既存ファイル変更・TDD）

**Files:**
- Modify: `app/actions/confirm-reservation.ts`（ファイル全体を以下の内容に置き換える）
- Modify: `app/actions/confirm-reservation.test.ts`（ファイル全体を以下の内容に置き換える）

### 補足

既存の6テストケースはすべてそのまま残し、新しいテストケースを1つ追加する。既存の実装ロジック（認可チェック・temp_hold判定・期限切れ判定）は一切変更せず、`prisma.reservation.update`の後に通知作成を追加するだけ。

- [ ] **Step 1: テストファイルを以下の内容に置き換える（新しいテストが失敗する状態にする）**

`app/actions/confirm-reservation.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { confirmReservation } from "./confirm-reservation";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { createNotification } from "@/lib/notifications/create-notification";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/notifications/create-notification", () => ({
  createNotification: vi.fn(),
}));

describe("confirmReservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.reservation.update).mockResolvedValue({
      id: 99,
      storeId: 2,
      reservationDate: new Date("2026-09-20T00:00:00.000Z"),
      startTime: new Date("1970-01-01T11:00:00.000Z"),
    } as never);
  });

  it("confirms using the authenticated member's id from the session, not a client-supplied one", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "5", role: "member" } } as never);
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 99,
      status: "temp_hold",
      tempHoldExpiresAt: new Date(Date.now() + 60_000),
    } as never);

    const result = await confirmReservation({ reservationId: 99 });

    expect(result).toEqual({ status: "confirmed" });
    expect(prisma.reservation.update).toHaveBeenCalledWith({
      where: { id: 99 },
      data: { memberId: 5, status: "confirmed", tempHoldExpiresAt: null },
    });
  });

  it("creates a store notification for the newly confirmed reservation", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "5", role: "member" } } as never);
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 99,
      status: "temp_hold",
      tempHoldExpiresAt: new Date(Date.now() + 60_000),
    } as never);

    await confirmReservation({ reservationId: 99 });

    expect(createNotification).toHaveBeenCalledWith({
      storeId: 2,
      type: "new_reservation",
      message: "新規WEB予約：2026-09-20 11:00〜",
      reservationId: 99,
    });
  });

  it("rejects unauthenticated callers", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await confirmReservation({ reservationId: 99 });

    expect(result).toEqual({ status: "unauthorized" });
    expect(prisma.reservation.findUnique).not.toHaveBeenCalled();
  });

  it("rejects non-member sessions (e.g. an admin session)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "manager" } } as never);

    const result = await confirmReservation({ reservationId: 99 });

    expect(result).toEqual({ status: "unauthorized" });
    expect(prisma.reservation.findUnique).not.toHaveBeenCalled();
  });

  it("rejects when the temp_hold has already expired", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "5", role: "member" } } as never);
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 99,
      status: "temp_hold",
      tempHoldExpiresAt: new Date(Date.now() - 60_000),
    } as never);

    const result = await confirmReservation({ reservationId: 99 });

    expect(result).toEqual({ status: "expired" });
    expect(prisma.reservation.update).not.toHaveBeenCalled();
  });

  it("rejects when the reservation is not in temp_hold status", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "5", role: "member" } } as never);
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 99,
      status: "cancelled",
      tempHoldExpiresAt: new Date(Date.now() + 60_000),
    } as never);

    const result = await confirmReservation({ reservationId: 99 });

    expect(result).toEqual({ status: "not_found" });
  });

  it("rejects when the reservation does not exist", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "5", role: "member" } } as never);
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(null as never);

    const result = await confirmReservation({ reservationId: 999 });

    expect(result).toEqual({ status: "not_found" });
  });
});
```

- [ ] **Step 2: テストを実行し、新規追加した1件が失敗することを確認する**

```bash
npx vitest run app/actions/confirm-reservation.test.ts
```

Expected: 6 passed, 1 failed（`createNotification`未実装のため）

- [ ] **Step 3: 実装ファイルを以下の内容に置き換える**

`app/actions/confirm-reservation.ts`:

```typescript
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isTempHoldExpired } from "@/lib/reservation/temp-hold";
import { createNotification } from "@/lib/notifications/create-notification";
import { minutesToLabel, dbTimeToMinutes } from "@/lib/reservation/time";

export interface ConfirmReservationParams {
  reservationId: number;
}

export type ConfirmReservationResult =
  | { status: "confirmed" }
  | { status: "expired" }
  | { status: "not_found" }
  | { status: "unauthorized" };

export async function confirmReservation(
  params: ConfirmReservationParams,
): Promise<ConfirmReservationResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "member") {
    return { status: "unauthorized" };
  }
  const memberId = Number(session.user.id);

  const reservation = await prisma.reservation.findUnique({
    where: { id: params.reservationId },
  });

  if (!reservation || reservation.status !== "temp_hold") {
    return { status: "not_found" };
  }

  if (
    reservation.tempHoldExpiresAt &&
    isTempHoldExpired(reservation.tempHoldExpiresAt, new Date())
  ) {
    return { status: "expired" };
  }

  const updated = await prisma.reservation.update({
    where: { id: params.reservationId },
    data: { memberId, status: "confirmed", tempHoldExpiresAt: null },
  });

  await createNotification({
    storeId: updated.storeId,
    type: "new_reservation",
    message: `新規WEB予約：${updated.reservationDate.toISOString().slice(0, 10)} ${minutesToLabel(dbTimeToMinutes(updated.startTime))}〜`,
    reservationId: updated.id,
  });

  return { status: "confirmed" };
}
```

- [ ] **Step 4: テストを実行し全件成功を確認する**

```bash
npx vitest run app/actions/confirm-reservation.test.ts
```

Expected: PASS（7 tests）

- [ ] **Step 5: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 5: 管理画面からのキャンセル時に通知を作成する（既存ファイル変更・TDD）

**Files:**
- Modify: `app/actions/reservation-detail.ts`（ファイル全体を以下の内容に置き換える）
- Modify: `app/actions/reservation-detail.test.ts`（ファイル全体を以下の内容に置き換える）

### 補足

`getReservationDetail`・`markNoShow`は変更しない。`cancelReservation`にのみ通知作成を追加する。

- [ ] **Step 1: テストファイルを以下の内容に置き換える**

`app/actions/reservation-detail.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getReservationDetail, cancelReservation, markNoShow } from "./reservation-detail";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications/create-notification";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/notifications/create-notification", () => ({
  createNotification: vi.fn(),
}));

describe("getReservationDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the reservation does not exist", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(null as never);
    expect(await getReservationDetail(999)).toBeNull();
  });

  it("maps a reservation with member/store/staff/items", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 1,
      status: "confirmed",
      source: "phone",
      reservationDate: new Date("2026-09-20T00:00:00Z"),
      startTime: new Date("1970-01-01T11:00:00Z"),
      endTime: new Date("1970-01-01T12:00:00Z"),
      totalPrice: 8000,
      member: { id: 5, name: "佐藤 太郎", phone: "090-0000-0000" },
      store: { name: "フォレスパ 渋谷店" },
      staff: { name: "田中 花子" },
      items: [
        { itemType: "course", course: { name: "スタンダード" }, option: null },
        { itemType: "option", course: null, option: { name: "ハンド・マッサージ" } },
      ],
    } as never);

    const result = await getReservationDetail(1);

    expect(result).toEqual({
      id: 1,
      status: "confirmed",
      source: "phone",
      reservationDate: "2026-09-20",
      startTimeLabel: "11:00",
      endTimeLabel: "12:00",
      totalPrice: 8000,
      memberId: 5,
      memberName: "佐藤 太郎",
      memberPhone: "090-0000-0000",
      storeName: "フォレスパ 渋谷店",
      staffName: "田中 花子",
      courseName: "スタンダード",
      optionNames: ["ハンド・マッサージ"],
    });
  });
});

describe("cancelReservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets the reservation status to cancelled", async () => {
    vi.mocked(prisma.reservation.update).mockResolvedValue({
      id: 1,
      storeId: 2,
      reservationDate: new Date("2026-09-20T00:00:00.000Z"),
      startTime: new Date("1970-01-01T11:00:00.000Z"),
    } as never);

    await cancelReservation(1);

    expect(prisma.reservation.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "cancelled" },
    });
  });

  it("creates a store notification for the cancellation", async () => {
    vi.mocked(prisma.reservation.update).mockResolvedValue({
      id: 1,
      storeId: 2,
      reservationDate: new Date("2026-09-20T00:00:00.000Z"),
      startTime: new Date("1970-01-01T11:00:00.000Z"),
    } as never);

    await cancelReservation(1);

    expect(createNotification).toHaveBeenCalledWith({
      storeId: 2,
      type: "cancellation",
      message: "予約キャンセル：2026-09-20 11:00〜",
      reservationId: 1,
    });
  });
});

describe("markNoShow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets the reservation status to no_show", async () => {
    vi.mocked(prisma.reservation.update).mockResolvedValue({} as never);

    await markNoShow(1);

    expect(prisma.reservation.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "no_show" },
    });
  });
});
```

- [ ] **Step 2: テストを実行し、新規追加した1件が失敗することを確認する**

```bash
npx vitest run app/actions/reservation-detail.test.ts
```

Expected: 4 passed, 1 failed

- [ ] **Step 3: 実装ファイルを以下の内容に置き換える**

`app/actions/reservation-detail.ts`:

```typescript
"use server";

import { prisma } from "@/lib/db";
import { minutesToLabel, dbTimeToMinutes } from "@/lib/reservation/time";
import { createNotification } from "@/lib/notifications/create-notification";

export interface ReservationDetail {
  id: number;
  status: string;
  source: string;
  reservationDate: string;
  startTimeLabel: string;
  endTimeLabel: string;
  totalPrice: number;
  memberId: number | null;
  memberName: string | null;
  memberPhone: string | null;
  storeName: string;
  staffName: string | null;
  courseName: string;
  optionNames: string[];
}

export async function getReservationDetail(
  reservationId: number,
): Promise<ReservationDetail | null> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      member: true,
      store: true,
      staff: true,
      items: { include: { course: true, option: true } },
    },
  });

  if (!reservation) return null;

  const courseItem = reservation.items.find((i) => i.itemType === "course");
  const optionItems = reservation.items.filter((i) => i.itemType === "option");

  return {
    id: reservation.id,
    status: reservation.status,
    source: reservation.source,
    reservationDate: reservation.reservationDate.toISOString().slice(0, 10),
    startTimeLabel: minutesToLabel(dbTimeToMinutes(reservation.startTime)),
    endTimeLabel: minutesToLabel(dbTimeToMinutes(reservation.endTime)),
    totalPrice: reservation.totalPrice,
    memberId: reservation.member?.id ?? null,
    memberName: reservation.member?.name ?? null,
    memberPhone: reservation.member?.phone ?? null,
    storeName: reservation.store.name,
    staffName: reservation.staff?.name ?? null,
    courseName: courseItem?.course?.name ?? "",
    optionNames: optionItems.map((i) => i.option?.name ?? "").filter(Boolean),
  };
}

export async function cancelReservation(reservationId: number): Promise<void> {
  const updated = await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: "cancelled" },
  });

  await createNotification({
    storeId: updated.storeId,
    type: "cancellation",
    message: `予約キャンセル：${updated.reservationDate.toISOString().slice(0, 10)} ${minutesToLabel(dbTimeToMinutes(updated.startTime))}〜`,
    reservationId: updated.id,
  });
}

export async function markNoShow(reservationId: number): Promise<void> {
  await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: "no_show" },
  });
}
```

- [ ] **Step 4: テストを実行し全件成功を確認する**

```bash
npx vitest run app/actions/reservation-detail.test.ts
```

Expected: PASS（5 tests）

- [ ] **Step 5: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 6: マイページからのキャンセル時に通知を作成する（既存ファイル変更・TDD）

**Files:**
- Modify: `app/actions/member-reservation-detail.ts`（ファイル全体を以下の内容に置き換える）
- Modify: `app/actions/member-reservation-detail.test.ts`（ファイル全体を以下の内容に置き換える）

### 補足

`getMemberNextReservation`は変更しない。`cancelMemberReservation`にのみ通知作成を追加する。既存の5テストケースはすべてそのまま残し、新しいテストケースを1つ追加する。

- [ ] **Step 1: テストファイルを以下の内容に置き換える**

`app/actions/member-reservation-detail.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMemberNextReservation, cancelMemberReservation } from "./member-reservation-detail";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { createNotification } from "@/lib/notifications/create-notification";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/notifications/create-notification", () => ({
  createNotification: vi.fn(),
}));

describe("getMemberNextReservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for an unauthenticated caller", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await getMemberNextReservation();

    expect(result).toBeNull();
    expect(prisma.reservation.findFirst).not.toHaveBeenCalled();
  });

  it("returns null when there is no upcoming confirmed reservation", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.reservation.findFirst).mockResolvedValue(null as never);

    const result = await getMemberNextReservation();

    expect(result).toBeNull();
  });

  it("marks canModify true when now is before the cancellation deadline", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.reservation.findFirst).mockResolvedValue({
      id: 55,
      reservationDate: new Date("2026-09-10T00:00:00.000Z"),
      startTime: new Date("1970-01-01T10:30:00.000Z"),
      endTime: new Date("1970-01-01T11:30:00.000Z"),
      totalPrice: 8000,
      cancellationDeadline: new Date("2026-09-09T23:59:59.000Z"),
      store: { name: "フォレスパ 渋谷店", phone: "03-1111-1111" },
      staff: { name: "佐藤 由紀" },
      items: [
        { itemType: "course", course: { name: "頭皮ケアスタンダード" }, option: null },
        { itemType: "option", course: null, option: { name: "ハンド・マッサージ" } },
      ],
    } as never);

    const result = await getMemberNextReservation(new Date("2026-09-08T00:00:00.000Z"));

    expect(result).toEqual({
      id: 55,
      reservationDate: "2026-09-10",
      startTimeLabel: "10:30",
      endTimeLabel: "11:30",
      storeName: "フォレスパ 渋谷店",
      storePhone: "03-1111-1111",
      courseName: "頭皮ケアスタンダード",
      optionNames: ["ハンド・マッサージ"],
      staffName: "佐藤 由紀",
      totalPrice: 8000,
      canModify: true,
    });
  });

  it("marks canModify false when now is at or after the cancellation deadline", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.reservation.findFirst).mockResolvedValue({
      id: 55,
      reservationDate: new Date("2026-09-10T00:00:00.000Z"),
      startTime: new Date("1970-01-01T10:30:00.000Z"),
      endTime: new Date("1970-01-01T11:30:00.000Z"),
      totalPrice: 8000,
      cancellationDeadline: new Date("2026-09-09T23:59:59.000Z"),
      store: { name: "フォレスパ 渋谷店", phone: "03-1111-1111" },
      staff: null,
      items: [{ itemType: "course", course: { name: "頭皮ケアスタンダード" }, option: null }],
    } as never);

    const result = await getMemberNextReservation(new Date("2026-09-10T00:00:00.000Z"));

    expect(result?.canModify).toBe(false);
    expect(result?.staffName).toBeNull();
  });
});

describe("cancelMemberReservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated callers", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await cancelMemberReservation({ reservationId: 55 });

    expect(result).toEqual({ status: "unauthorized" });
    expect(prisma.reservation.findUnique).not.toHaveBeenCalled();
  });

  it("rejects when the reservation belongs to a different member", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 55,
      memberId: 99,
      status: "confirmed",
      cancellationDeadline: new Date("2099-01-01T00:00:00.000Z"),
    } as never);

    const result = await cancelMemberReservation({ reservationId: 55 });

    expect(result).toEqual({ status: "unauthorized" });
    expect(prisma.reservation.update).not.toHaveBeenCalled();
  });

  it("rejects when the reservation is not in confirmed status", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 55,
      memberId: 7,
      status: "cancelled",
      cancellationDeadline: new Date("2099-01-01T00:00:00.000Z"),
    } as never);

    const result = await cancelMemberReservation({ reservationId: 55 });

    expect(result).toEqual({ status: "not_found" });
  });

  it("rejects when the cancellation deadline has passed", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 55,
      memberId: 7,
      status: "confirmed",
      cancellationDeadline: new Date("2026-09-09T23:59:59.000Z"),
    } as never);

    const result = await cancelMemberReservation(
      { reservationId: 55 },
      new Date("2026-09-10T00:00:00.000Z"),
    );

    expect(result).toEqual({ status: "deadline_passed" });
    expect(prisma.reservation.update).not.toHaveBeenCalled();
  });

  it("cancels the reservation when owned, confirmed, and before the deadline", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 55,
      memberId: 7,
      status: "confirmed",
      cancellationDeadline: new Date("2099-01-01T00:00:00.000Z"),
    } as never);
    vi.mocked(prisma.reservation.update).mockResolvedValue({
      id: 55,
      storeId: 2,
      reservationDate: new Date("2026-09-10T00:00:00.000Z"),
      startTime: new Date("1970-01-01T10:30:00.000Z"),
    } as never);

    const result = await cancelMemberReservation({ reservationId: 55 });

    expect(result).toEqual({ status: "cancelled" });
    expect(prisma.reservation.update).toHaveBeenCalledWith({
      where: { id: 55 },
      data: { status: "cancelled" },
    });
  });

  it("creates a store notification when the member cancels their reservation", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 55,
      memberId: 7,
      status: "confirmed",
      cancellationDeadline: new Date("2099-01-01T00:00:00.000Z"),
    } as never);
    vi.mocked(prisma.reservation.update).mockResolvedValue({
      id: 55,
      storeId: 2,
      reservationDate: new Date("2026-09-10T00:00:00.000Z"),
      startTime: new Date("1970-01-01T10:30:00.000Z"),
    } as never);

    await cancelMemberReservation({ reservationId: 55 });

    expect(createNotification).toHaveBeenCalledWith({
      storeId: 2,
      type: "cancellation",
      message: "予約キャンセル：2026-09-10 10:30〜",
      reservationId: 55,
    });
  });
});
```

- [ ] **Step 2: テストを実行し、新規追加した1件が失敗することを確認する**

```bash
npx vitest run app/actions/member-reservation-detail.test.ts
```

Expected: 9 passed, 1 failed

- [ ] **Step 3: 実装ファイルを以下の内容に置き換える**

`app/actions/member-reservation-detail.ts`:

```typescript
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { minutesToLabel, dbTimeToMinutes } from "@/lib/reservation/time";
import { createNotification } from "@/lib/notifications/create-notification";

export interface MemberReservationDetail {
  id: number;
  reservationDate: string;
  startTimeLabel: string;
  endTimeLabel: string;
  storeName: string;
  storePhone: string;
  courseName: string;
  optionNames: string[];
  staffName: string | null;
  totalPrice: number;
  canModify: boolean;
}

export async function getMemberNextReservation(
  today: Date = new Date(),
): Promise<MemberReservationDetail | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "member") {
    return null;
  }
  const memberId = Number(session.user.id);

  const reservation = await prisma.reservation.findFirst({
    where: { memberId, status: "confirmed", reservationDate: { gte: today } },
    orderBy: { reservationDate: "asc" },
    include: {
      store: true,
      staff: true,
      items: { include: { course: true, option: true } },
    },
  });

  if (!reservation) return null;

  const courseItem = reservation.items.find((i) => i.itemType === "course");
  const optionItems = reservation.items.filter((i) => i.itemType === "option");

  return {
    id: reservation.id,
    reservationDate: reservation.reservationDate.toISOString().slice(0, 10),
    startTimeLabel: minutesToLabel(dbTimeToMinutes(reservation.startTime)),
    endTimeLabel: minutesToLabel(dbTimeToMinutes(reservation.endTime)),
    storeName: reservation.store.name,
    storePhone: reservation.store.phone,
    courseName: courseItem?.course?.name ?? "",
    optionNames: optionItems.map((i) => i.option?.name ?? "").filter(Boolean),
    staffName: reservation.staff?.name ?? null,
    totalPrice: reservation.totalPrice,
    canModify: today < reservation.cancellationDeadline,
  };
}

export type CancelMemberReservationResult =
  | { status: "cancelled" }
  | { status: "unauthorized" }
  | { status: "not_found" }
  | { status: "deadline_passed" };

export async function cancelMemberReservation(
  params: { reservationId: number },
  today: Date = new Date(),
): Promise<CancelMemberReservationResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "member") {
    return { status: "unauthorized" };
  }
  const memberId = Number(session.user.id);

  const reservation = await prisma.reservation.findUnique({
    where: { id: params.reservationId },
  });

  if (!reservation || reservation.memberId !== memberId) {
    return { status: "unauthorized" };
  }
  if (reservation.status !== "confirmed") {
    return { status: "not_found" };
  }
  if (today >= reservation.cancellationDeadline) {
    return { status: "deadline_passed" };
  }

  const updated = await prisma.reservation.update({
    where: { id: params.reservationId },
    data: { status: "cancelled" },
  });

  await createNotification({
    storeId: updated.storeId,
    type: "cancellation",
    message: `予約キャンセル：${updated.reservationDate.toISOString().slice(0, 10)} ${minutesToLabel(dbTimeToMinutes(updated.startTime))}〜`,
    reservationId: updated.id,
  });

  return { status: "cancelled" };
}
```

- [ ] **Step 4: テストを実行し全件成功を確認する**

```bash
npx vitest run app/actions/member-reservation-detail.test.ts
```

Expected: PASS（10 tests）

- [ ] **Step 5: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 7: 通知ベルUI（軽量検証）

**Files:**
- Create: `components/admin/notification-bell.tsx`
- Modify: `app/admin/(dashboard)/layout.tsx`

- [ ] **Step 1: 通知ベルコンポーネントを実装する**

`components/admin/notification-bell.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  listNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type NotificationItem,
} from "@/app/actions/notifications";

const TYPE_LABEL: Record<string, string> = {
  new_reservation: "新規予約",
  cancellation: "キャンセル",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    getUnreadNotificationCount(null).then(setUnreadCount);
  }, []);

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      const list = await listNotifications(null);
      setNotifications(list);
    }
  }

  async function handleMarkAllRead() {
    await markAllNotificationsAsRead(null);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }

  async function handleItemClick(n: NotificationItem) {
    if (!n.isRead) {
      await markNotificationAsRead(n.id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-primary-50"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[10px] text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-80 rounded-lg border border-neutral-200 bg-neutral-0 shadow-lg">
          <div className="flex items-center justify-between border-b border-neutral-100 p-3">
            <span className="text-sm font-medium text-neutral-700">通知</span>
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs text-primary-600 underline"
            >
              すべて既読にする
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="p-4 text-sm text-neutral-500">通知はありません。</p>
            )}
            {notifications.map((n) => (
              <Link
                key={n.id}
                href={`/admin/reservations/${n.reservationId}`}
                onClick={() => handleItemClick(n)}
                className={`block border-b border-neutral-50 p-3 text-sm last:border-0 ${
                  n.isRead ? "text-neutral-500" : "bg-primary-50 text-neutral-800"
                }`}
              >
                <span className="text-xs text-neutral-400">{TYPE_LABEL[n.type] ?? n.type}</span>
                <p>{n.message}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: レイアウトに組み込む**

`app/admin/(dashboard)/layout.tsx`の内容を以下に置き換える（既存のサイドバー・全リンクはそのまま。`<main>`をヘッダー付きの`<div>`でラップし、通知ベルを追加する）:

```tsx
import Link from "next/link";
import { NotificationBell } from "@/components/admin/notification-bell";

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-neutral-200 bg-neutral-0 p-4">
        <h1 className="font-heading text-lg text-primary-700">フォレスパ</h1>
        <nav className="mt-6 flex flex-col gap-1">
          <Link
            href="/admin/dashboard"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            ダッシュボード
          </Link>
          <Link
            href="/admin/calendar"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            予約カレンダー
          </Link>
          <Link
            href="/admin/customers"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            顧客管理
          </Link>
          <Link
            href="/admin/customer-statuses"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            ステータス設定
          </Link>
          <Link
            href="/admin/reservations/new"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            電話予約登録
          </Link>
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
          <Link
            href="/admin/staff"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            スタッフ管理
          </Link>
          <Link
            href="/admin/stores"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            店舗管理
          </Link>
          <Link
            href="/admin/reports"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            売上・月報レポート
          </Link>
          <Link
            href="/admin/segment-campaigns"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            メール／LINE配信管理
          </Link>
          <Link
            href="/admin/auto-delivery"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            自動配信設定
          </Link>
          <Link
            href="/admin/templates"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            配信テンプレート管理
          </Link>
          <Link
            href="/admin/cron-logs"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            Cronジョブ実行ログ
          </Link>
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-neutral-200 bg-neutral-0 px-6 py-3">
          <NotificationBell />
        </header>
        <main className="flex-1 bg-neutral-50 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 型チェックとLintを実行する**

```bash
npx tsc --noEmit
npx eslint .
```

- [ ] **Step 4: 全テストスイートを実行する**

```bash
npx vitest run
```

Expected: 既存229テスト＋新規12テスト（Task2:1, Task3:8, Task4:+1, Task5:+1, Task6:+1）＝241テストがパスする

- [ ] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## 完了確認チェックリスト

- [ ] `npx vitest run` の全テストがパスする（`lib/auth/`・`update-member-profile`のbcryptタイムアウトによる既知のフラーキーさを除く）
- [ ] `npx tsc --noEmit` がエラーなく通る
- [ ] `npx eslint .` がエラーなく通る
- [ ] ユーザーのターミナルで`npx prisma migrate dev`を実行し、`notifications`テーブルが追加されることを確認する
- [ ] WEB予約フォーム（`/reserve`）で予約を確定し、管理画面ヘッダーの通知ベルに未読バッジが増えることをユーザーがブラウザで確認する
- [ ] マイページ（`/mypage/reservation`）または管理画面（`/admin/reservations/[id]`）からキャンセルし、同様に通知が作られることを確認する
- [ ] 通知をクリックすると既読になり、該当予約の詳細画面に遷移することを確認する
