# マイページ（M-01簡易ログイン・M-03〜M-06）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 会員向けマイページ（M-03マイページトップ／M-04予約確認・変更・キャンセル／M-05来店履歴・ステータス確認／M-06プロフィール編集）を実装する。あわせて、これらの画面にアクセスするための最小限のログイン専用ページ（`/login`）を用意する。

**Architecture:** 既存の`app/actions/`のServer Action層パターンを踏襲し、すべての会員向けアクションは`auth()`セッションから`memberId`を導出する（クライアントからのID指定は一切受け付けない＝IDOR対策）。UIは`/reserve`予約フォームと同じくスマホファーストのTailwindクラスで構築する。`/mypage/:path*`の認証ガードは既存の`middleware.ts`（`resolveAccessDecision`）が既に実装済みのためそのまま利用し、新規のガードコードは書かない。

**Tech Stack:** Next.js 16 App Router / TypeScript / Prisma / Auth.js v5（`member-credentials`・`line`プロバイダは実装済み）/ Vitest

**参照元資料:** `02_screenspecification.md`（画面仕様書 M-01・M-03・M-04・M-05・M-06節）

---

## 実行環境に関する注記（継承）

- `.git`への書き込み（`git add`/`git commit`含む）は一切実行できない。ユーザーが自分のターミナルで実行する。
- `.env`/`.env.*`は読み取り・書き込みともに不可。
- `npm run build`・`npm run dev`はこのサンドボックスでは不安定なため実行しない。検証は`npx tsc --noEmit`・`npx eslint .`・`npx vitest run`で行う。
- Prisma CLI（`migrate dev`等）は環境変数読み込みの問題でこのサンドボックスでは動かない。スキーマ変更は`prisma/schema.prisma`の編集＋マイグレーションSQLファイルの手動作成までとし、`npx prisma migrate dev`の実行はユーザーに依頼する。
- **CRITICAL: 仕様にある関数・ロジックを自己判断で別実装に置き換えない。** 既存の`lib/reservation/`・`app/actions/`のロジック（`minutesToLabel`・`dbTimeToMinutes`・`hashPassword`・`verifyPassword`等）は必ずそのまま再利用すること。もし仕様通りに実装できないと判断した場合は、黙って別実装にせず、範囲を絞った`// eslint-disable-next-line`＋理由コメント、またはDONE_WITH_CONCERNSとして報告すること。

---

## スコープ決定事項（このPhaseで意図的に簡略化した点）

以下は画面仕様書の記述をそのまま実装すると別Phase相当の大規模機能になるため、意図的にスコープを絞った。ユーザーへの報告時に明示する。

1. **M-04「変更する」**：仕様は「M-02 Step6以降に戻り再選択」だが、これは予約ウィザードの状態を予約変更モードで再利用する大規模な追加実装になる。今回は「変更する＝現在の予約をキャンセルしてから`/reserve`で予約し直す」という単純なフローとする。
2. **M-03のボトムナビ「お知らせ」タブ**：お知らせ配信機能（A-09/A-10）は未実装のため、遷移先の実体がない。今回のボトムナビは「予約する／マイページ／来店履歴／設定」の4項目とし、「お知らせ」は含めない。
3. **M-01（ログイン／会員登録）はログインのみ実装**：新規会員登録フォームは既に`/reserve`予約フォームのStep7に実装済みのため重複実装しない。`/login`ページはログイン専用とし、新規の方は「初めての方はご予約はこちらから」で`/reserve`へ誘導する。
4. **LINE連携登録時の性別・生年月日追加入力画面は対象外**：これは別タスクとして認識済み（LINE新規会員登録フロー自体が未実装）。M-06の「パスワード未設定会員向けの追加設定導線」はスキーマ上`passwordHash`がnull許容であることを前提に実装するが、実際にpasswordHashがnullの会員を作る手段（LINE新規登録）は今回のスコープ外。

---

## Task 1: Memberテーブルに通知設定カラムを追加する

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260904000000_add_member_notification_settings/migration.sql`

- [ ] **Step 1: スキーマを変更する**

`prisma/schema.prisma`の`Member`モデル、`totalSpent`行の直後に以下を追加する：

```prisma
  emailNotificationEnabled Boolean @default(true) @map("email_notification_enabled")
  lineNotificationEnabled  Boolean @default(true) @map("line_notification_enabled")
```

変更後の該当ブロックは以下のようになる（`totalSpent`〜`createdAt`の間）：

```prisma
  visitCount     Int      @default(0) @map("visit_count")
  totalSpent     Int      @default(0) @map("total_spent")
  emailNotificationEnabled Boolean @default(true) @map("email_notification_enabled")
  lineNotificationEnabled  Boolean @default(true) @map("line_notification_enabled")
  createdAt      DateTime @default(now()) @map("created_at")
```

- [ ] **Step 2: マイグレーションSQLを手動作成する**

`prisma/migrations/20260904000000_add_member_notification_settings/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "members" ADD COLUMN "email_notification_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "members" ADD COLUMN "line_notification_enabled" BOOLEAN NOT NULL DEFAULT true;
```

- [ ] **Step 3: スキーマ構文を検証する**

```bash
DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" DIRECT_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: 変更ファイルを報告する（コミット・マイグレーション実行はしない）**

ユーザーには「`npx prisma migrate dev`を実行してください」と伝える。

---

## Task 2: マイページサマリーServer Action（TDD）

**Files:**
- Create: `app/actions/mypage-summary.ts`
- Test: `app/actions/mypage-summary.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/mypage-summary.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMypageSummary } from "./mypage-summary";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/lib/db", () => ({
  prisma: {
    member: { findUnique: vi.fn() },
    customerStatus: { findMany: vi.fn() },
    reservation: { findFirst: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

const STATUSES = [
  { id: 1, name: "ブロンズ", minVisitCount: 0, sortOrder: 1 },
  { id: 2, name: "シルバー", minVisitCount: 5, sortOrder: 2 },
  { id: 3, name: "ゴールド", minVisitCount: 10, sortOrder: 3 },
];

describe("getMypageSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.customerStatus.findMany).mockResolvedValue(STATUSES as never);
    vi.mocked(prisma.reservation.findFirst).mockResolvedValue(null as never);
  });

  it("returns null for an unauthenticated caller", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await getMypageSummary();

    expect(result).toBeNull();
    expect(prisma.member.findUnique).not.toHaveBeenCalled();
  });

  it("returns null for a non-member session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "manager" } } as never);

    const result = await getMypageSummary();

    expect(result).toBeNull();
  });

  it("computes the next status and remaining visit count", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: 7,
      name: "田中 花子",
      visitCount: 3,
      statusId: 1,
      status: { id: 1, name: "ブロンズ", colorCode: "#CD7F32" },
    } as never);

    const result = await getMypageSummary();

    expect(result).toEqual({
      name: "田中 花子",
      statusName: "ブロンズ",
      statusColor: "#CD7F32",
      visitCount: 3,
      nextStatusName: "シルバー",
      visitsToNextStatus: 2,
      nextReservation: null,
    });
  });

  it("returns null next status when already at the top tier", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: 7,
      name: "田中 花子",
      visitCount: 20,
      statusId: 3,
      status: { id: 3, name: "ゴールド", colorCode: "#FFD700" },
    } as never);

    const result = await getMypageSummary();

    expect(result?.nextStatusName).toBeNull();
    expect(result?.visitsToNextStatus).toBeNull();
  });

  it("includes the nearest upcoming confirmed reservation when present", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: 7,
      name: "田中 花子",
      visitCount: 3,
      statusId: 1,
      status: { id: 1, name: "ブロンズ", colorCode: "#CD7F32" },
    } as never);
    vi.mocked(prisma.reservation.findFirst).mockResolvedValue({
      id: 55,
      reservationDate: new Date("2026-09-10T00:00:00.000Z"),
      startTime: new Date("1970-01-01T10:30:00.000Z"),
      store: { name: "フォレスパ 渋谷店" },
      staff: { name: "佐藤 由紀" },
      items: [{ itemType: "course", course: { name: "頭皮ケアスタンダード" } }],
    } as never);

    const result = await getMypageSummary();

    expect(result?.nextReservation).toEqual({
      id: 55,
      reservationDate: "2026-09-10",
      startTimeLabel: "10:30",
      storeName: "フォレスパ 渋谷店",
      courseName: "頭皮ケアスタンダード",
      staffName: "佐藤 由紀",
    });
    expect(prisma.reservation.findFirst).toHaveBeenCalledWith({
      where: { memberId: 7, status: "confirmed", reservationDate: { gte: expect.any(Date) } },
      orderBy: { reservationDate: "asc" },
      include: { store: true, staff: true, items: { include: { course: true } } },
    });
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

```bash
npx vitest run app/actions/mypage-summary.test.ts
```

Expected: FAIL（`mypage-summary.ts`が存在しない）

- [ ] **Step 3: 実装する**

`app/actions/mypage-summary.ts`:

```typescript
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { minutesToLabel, dbTimeToMinutes } from "@/lib/reservation/time";

export interface NextReservationSummary {
  id: number;
  reservationDate: string;
  startTimeLabel: string;
  storeName: string;
  courseName: string;
  staffName: string | null;
}

export interface MypageSummary {
  name: string;
  statusName: string;
  statusColor: string;
  visitCount: number;
  nextStatusName: string | null;
  visitsToNextStatus: number | null;
  nextReservation: NextReservationSummary | null;
}

export async function getMypageSummary(today: Date = new Date()): Promise<MypageSummary | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "member") {
    return null;
  }
  const memberId = Number(session.user.id);

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: { status: true },
  });
  if (!member) return null;

  const statuses = await prisma.customerStatus.findMany({ orderBy: { sortOrder: "asc" } });
  const currentIndex = statuses.findIndex((s) => s.id === member.statusId);
  const nextStatus = currentIndex >= 0 ? statuses[currentIndex + 1] : undefined;

  const nextReservation = await prisma.reservation.findFirst({
    where: { memberId, status: "confirmed", reservationDate: { gte: today } },
    orderBy: { reservationDate: "asc" },
    include: { store: true, staff: true, items: { include: { course: true } } },
  });

  return {
    name: member.name,
    statusName: member.status.name,
    statusColor: member.status.colorCode,
    visitCount: member.visitCount,
    nextStatusName: nextStatus?.name ?? null,
    visitsToNextStatus: nextStatus ? nextStatus.minVisitCount - member.visitCount : null,
    nextReservation: nextReservation
      ? {
          id: nextReservation.id,
          reservationDate: nextReservation.reservationDate.toISOString().slice(0, 10),
          startTimeLabel: minutesToLabel(dbTimeToMinutes(nextReservation.startTime)),
          storeName: nextReservation.store.name,
          courseName:
            nextReservation.items.find((i) => i.itemType === "course")?.course?.name ?? "",
          staffName: nextReservation.staff?.name ?? null,
        }
      : null,
  };
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

```bash
npx vitest run app/actions/mypage-summary.test.ts
```

Expected: PASS（5 tests）

- [ ] **Step 5: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 3: 会員側予約詳細・キャンセルServer Action（TDD）

**Files:**
- Create: `app/actions/member-reservation-detail.ts`
- Test: `app/actions/member-reservation-detail.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/member-reservation-detail.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMemberNextReservation, cancelMemberReservation } from "./member-reservation-detail";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
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
    vi.mocked(prisma.reservation.update).mockResolvedValue({} as never);

    const result = await cancelMemberReservation({ reservationId: 55 });

    expect(result).toEqual({ status: "cancelled" });
    expect(prisma.reservation.update).toHaveBeenCalledWith({
      where: { id: 55 },
      data: { status: "cancelled" },
    });
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

```bash
npx vitest run app/actions/member-reservation-detail.test.ts
```

Expected: FAIL

- [ ] **Step 3: 実装する**

`app/actions/member-reservation-detail.ts`:

```typescript
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { minutesToLabel, dbTimeToMinutes } from "@/lib/reservation/time";

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

  await prisma.reservation.update({
    where: { id: params.reservationId },
    data: { status: "cancelled" },
  });

  return { status: "cancelled" };
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

```bash
npx vitest run app/actions/member-reservation-detail.test.ts
```

Expected: PASS（9 tests）

- [ ] **Step 5: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 4: 来店履歴Server Action（TDD）

**Files:**
- Create: `app/actions/member-reservation-history.ts`
- Test: `app/actions/member-reservation-history.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/member-reservation-history.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMemberReservationHistory } from "./member-reservation-history";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: { findMany: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

describe("getMemberReservationHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for an unauthenticated caller", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await getMemberReservationHistory();

    expect(result).toBeNull();
    expect(prisma.reservation.findMany).not.toHaveBeenCalled();
  });

  it("returns the authenticated member's reservation history, newest first", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      {
        id: 40,
        reservationDate: new Date("2026-08-01T00:00:00.000Z"),
        totalPrice: 9000,
        status: "completed",
        store: { name: "フォレスパ 渋谷店" },
        staff: { name: "佐藤 由紀" },
        items: [{ itemType: "course", course: { name: "頭皮ケアプレミアム" } }],
      },
    ] as never);

    const result = await getMemberReservationHistory();

    expect(result).toEqual([
      {
        id: 40,
        date: "2026-08-01",
        storeName: "フォレスパ 渋谷店",
        courseName: "頭皮ケアプレミアム",
        staffName: "佐藤 由紀",
        totalPrice: 9000,
        status: "completed",
      },
    ]);
    expect(prisma.reservation.findMany).toHaveBeenCalledWith({
      where: { memberId: 7, status: { in: ["completed", "confirmed", "cancelled", "no_show"] } },
      orderBy: { reservationDate: "desc" },
      include: { store: true, staff: true, items: { include: { course: true } } },
    });
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

```bash
npx vitest run app/actions/member-reservation-history.test.ts
```

Expected: FAIL

- [ ] **Step 3: 実装する**

`app/actions/member-reservation-history.ts`:

```typescript
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export interface MemberReservationHistoryItem {
  id: number;
  date: string;
  storeName: string;
  courseName: string;
  staffName: string | null;
  totalPrice: number;
  status: string;
}

export async function getMemberReservationHistory(): Promise<
  MemberReservationHistoryItem[] | null
> {
  const session = await auth();
  if (!session?.user || session.user.role !== "member") {
    return null;
  }
  const memberId = Number(session.user.id);

  const reservations = await prisma.reservation.findMany({
    where: { memberId, status: { in: ["completed", "confirmed", "cancelled", "no_show"] } },
    orderBy: { reservationDate: "desc" },
    include: { store: true, staff: true, items: { include: { course: true } } },
  });

  return reservations.map((r) => ({
    id: r.id,
    date: r.reservationDate.toISOString().slice(0, 10),
    storeName: r.store.name,
    courseName: r.items.find((i) => i.itemType === "course")?.course?.name ?? "",
    staffName: r.staff?.name ?? null,
    totalPrice: r.totalPrice,
    status: r.status,
  }));
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

```bash
npx vitest run app/actions/member-reservation-history.test.ts
```

Expected: PASS（2 tests）

- [ ] **Step 5: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 5: プロフィール編集Server Action（TDD）

**Files:**
- Create: `app/actions/update-member-profile.ts`
- Test: `app/actions/update-member-profile.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/update-member-profile.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getMemberProfile,
  updateMemberProfile,
  changeMemberPassword,
} from "./update-member-profile";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { hashPassword } from "@/lib/auth/password";

vi.mock("@/lib/db", () => ({
  prisma: {
    member: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

describe("getMemberProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for an unauthenticated caller", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await getMemberProfile();

    expect(result).toBeNull();
  });

  it("maps the member's profile, including hasPassword and lineLinked flags", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: 7,
      name: "田中 花子",
      phone: "090-1111-2222",
      birthDate: new Date("1995-05-01T00:00:00.000Z"),
      gender: "female",
      passwordHash: "some-hash",
      lineUserId: null,
      emailNotificationEnabled: true,
      lineNotificationEnabled: false,
    } as never);

    const result = await getMemberProfile();

    expect(result).toEqual({
      name: "田中 花子",
      phone: "090-1111-2222",
      birthDate: "1995-05-01",
      gender: "female",
      hasPassword: true,
      lineLinked: false,
      emailNotificationEnabled: true,
      lineNotificationEnabled: false,
    });
  });

  it("reports hasPassword false for a LINE-only member with no password set", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: 7,
      name: "田中 花子",
      phone: "090-1111-2222",
      birthDate: new Date("1995-05-01T00:00:00.000Z"),
      gender: "female",
      passwordHash: null,
      lineUserId: "line-user-1",
      emailNotificationEnabled: true,
      lineNotificationEnabled: true,
    } as never);

    const result = await getMemberProfile();

    expect(result?.hasPassword).toBe(false);
    expect(result?.lineLinked).toBe(true);
  });
});

describe("updateMemberProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated callers", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await updateMemberProfile({
      name: "田中 花子",
      phone: "090-1111-2222",
      birthDate: "1995-05-01",
      gender: "female",
      emailNotificationEnabled: true,
      lineNotificationEnabled: true,
    });

    expect(result).toEqual({ status: "unauthorized" });
    expect(prisma.member.update).not.toHaveBeenCalled();
  });

  it("updates using the authenticated member's id from the session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.member.update).mockResolvedValue({} as never);

    const result = await updateMemberProfile({
      name: "田中 花子",
      phone: "090-9999-8888",
      birthDate: "1995-05-01",
      gender: "female",
      emailNotificationEnabled: false,
      lineNotificationEnabled: true,
    });

    expect(result).toEqual({ status: "updated" });
    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        name: "田中 花子",
        phone: "090-9999-8888",
        birthDate: new Date("1995-05-01T00:00:00.000Z"),
        gender: "female",
        emailNotificationEnabled: false,
        lineNotificationEnabled: true,
      },
    });
  });
});

describe("changeMemberPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated callers", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await changeMemberPassword({
      currentPassword: "old-pass",
      newPassword: "new-pass",
    });

    expect(result).toEqual({ status: "unauthorized" });
  });

  it("rejects an incorrect current password when one is already set", async () => {
    const existingHash = await hashPassword("correct-password");
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: 7,
      passwordHash: existingHash,
    } as never);

    const result = await changeMemberPassword({
      currentPassword: "wrong-password",
      newPassword: "new-password",
    });

    expect(result).toEqual({ status: "incorrect_current_password" });
    expect(prisma.member.update).not.toHaveBeenCalled();
  });

  it("updates the password when the current password is correct", async () => {
    const existingHash = await hashPassword("correct-password");
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: 7,
      passwordHash: existingHash,
    } as never);
    vi.mocked(prisma.member.update).mockResolvedValue({} as never);

    const result = await changeMemberPassword({
      currentPassword: "correct-password",
      newPassword: "brand-new-password",
    });

    expect(result).toEqual({ status: "updated" });
    const updateArgs = vi.mocked(prisma.member.update).mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 7 });
    expect(updateArgs.data.passwordHash).not.toBe(existingHash);
    expect(updateArgs.data.passwordHash).not.toBe("brand-new-password");
  });

  it("sets a password without requiring a current one when the member has none yet (LINE-only)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: 7,
      passwordHash: null,
    } as never);
    vi.mocked(prisma.member.update).mockResolvedValue({} as never);

    const result = await changeMemberPassword({
      currentPassword: null,
      newPassword: "first-password",
    });

    expect(result).toEqual({ status: "updated" });
    expect(prisma.member.update).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

```bash
npx vitest run app/actions/update-member-profile.test.ts
```

Expected: FAIL

- [ ] **Step 3: 実装する**

`app/actions/update-member-profile.ts`:

```typescript
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export interface MemberProfile {
  name: string;
  phone: string;
  birthDate: string;
  gender: "female" | "male" | "other";
  hasPassword: boolean;
  lineLinked: boolean;
  emailNotificationEnabled: boolean;
  lineNotificationEnabled: boolean;
}

export async function getMemberProfile(): Promise<MemberProfile | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "member") {
    return null;
  }
  const memberId = Number(session.user.id);

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return null;

  return {
    name: member.name,
    phone: member.phone,
    birthDate: member.birthDate.toISOString().slice(0, 10),
    gender: member.gender,
    hasPassword: member.passwordHash !== null,
    lineLinked: member.lineUserId !== null,
    emailNotificationEnabled: member.emailNotificationEnabled,
    lineNotificationEnabled: member.lineNotificationEnabled,
  };
}

export interface UpdateMemberProfileParams {
  name: string;
  phone: string;
  birthDate: string;
  gender: "female" | "male" | "other";
  emailNotificationEnabled: boolean;
  lineNotificationEnabled: boolean;
}

export type UpdateMemberProfileResult = { status: "updated" } | { status: "unauthorized" };

export async function updateMemberProfile(
  params: UpdateMemberProfileParams,
): Promise<UpdateMemberProfileResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "member") {
    return { status: "unauthorized" };
  }
  const memberId = Number(session.user.id);

  await prisma.member.update({
    where: { id: memberId },
    data: {
      name: params.name,
      phone: params.phone,
      birthDate: new Date(`${params.birthDate}T00:00:00.000Z`),
      gender: params.gender,
      emailNotificationEnabled: params.emailNotificationEnabled,
      lineNotificationEnabled: params.lineNotificationEnabled,
    },
  });

  return { status: "updated" };
}

export type ChangeMemberPasswordResult =
  | { status: "updated" }
  | { status: "unauthorized" }
  | { status: "incorrect_current_password" };

export async function changeMemberPassword(params: {
  currentPassword: string | null;
  newPassword: string;
}): Promise<ChangeMemberPasswordResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "member") {
    return { status: "unauthorized" };
  }
  const memberId = Number(session.user.id);

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return { status: "unauthorized" };

  if (member.passwordHash) {
    if (
      !params.currentPassword ||
      !(await verifyPassword(params.currentPassword, member.passwordHash))
    ) {
      return { status: "incorrect_current_password" };
    }
  }

  const newHash = await hashPassword(params.newPassword);
  await prisma.member.update({ where: { id: memberId }, data: { passwordHash: newHash } });

  return { status: "updated" };
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

```bash
npx vitest run app/actions/update-member-profile.test.ts
```

Expected: PASS（8 tests）

- [ ] **Step 5: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 6: 会員ログイン専用ページ（軽量検証）

**Files:**
- Create: `app/login/page.tsx`

- [ ] **Step 1: 実装する**

`app/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function MemberLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const result = await signIn("member-credentials", { email, password, redirect: false });
    setSubmitting(false);
    if (result?.ok) {
      router.push("/mypage");
    } else {
      setError("メールアドレスまたはパスワードが正しくありません。");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-4">
      <h1 className="font-heading text-2xl text-primary-700">フォレスパ</h1>
      {error && <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}
      <button
        type="button"
        onClick={() => signIn("line", { callbackUrl: "/mypage" })}
        className="h-12 w-full rounded-lg bg-[#06C755] font-medium text-white"
      >
        LINEで連携ログイン
      </button>
      <div className="flex items-center gap-3 text-xs text-neutral-400">
        <div className="h-px flex-1 bg-neutral-200" />
        または
        <div className="h-px flex-1 bg-neutral-200" />
      </div>
      <input
        type="email"
        placeholder="メールアドレス"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-12 rounded-md border border-neutral-300 px-3"
      />
      <input
        type="password"
        placeholder="パスワード"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="h-12 rounded-md border border-neutral-300 px-3"
      />
      <button
        type="button"
        disabled={submitting}
        onClick={handleSubmit}
        className="h-12 rounded-lg bg-primary-500 font-medium text-white disabled:opacity-50"
      >
        ログイン
      </button>
      <p className="text-center text-sm text-neutral-500">
        初めての方は
        <a href="/reserve" className="text-primary-600 underline">
          ご予約はこちら
        </a>
        から会員登録できます。
      </p>
    </div>
  );
}
```

- [ ] **Step 2: 型チェックとLintを実行する**

```bash
npx tsc --noEmit
npx eslint .
```

- [ ] **Step 3: 変更ファイルを報告する（コミットしない）**

---

## Task 7: マイページ共通シェル・トップ画面 M-03（軽量検証）

**Files:**
- Create: `app/mypage/layout.tsx`
- Create: `app/mypage/page.tsx`

### 補足

`/mypage/:path*`の認証ガード（会員以外はログインページへリダイレクト）は`middleware.ts`の`resolveAccessDecision`で実装済みのため、`layout.tsx`側で改めて認証チェックは行わない。`layout.tsx`はボトムナビと共通の画面幅（スマホ想定：`max-w-md`）だけを提供する。

- [ ] **Step 1: 共通レイアウトを実装する**

`app/mypage/layout.tsx`:

```tsx
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/reserve", label: "予約する" },
  { href: "/mypage", label: "マイページ" },
  { href: "/mypage/history", label: "来店履歴" },
  { href: "/mypage/profile", label: "設定" },
];

export default function MypageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col pb-20">
      <main className="flex-1 p-4">{children}</main>
      <nav className="fixed bottom-0 left-1/2 flex w-full max-w-md -translate-x-1/2 border-t border-neutral-200 bg-neutral-0">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 py-3 text-center text-xs text-neutral-600 hover:text-primary-600"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
```

- [ ] **Step 2: トップページを実装する**

`app/mypage/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { getMypageSummary, type MypageSummary } from "@/app/actions/mypage-summary";

export default function MypageTopPage() {
  const [summary, setSummary] = useState<MypageSummary | null>(null);

  useEffect(() => {
    getMypageSummary().then(setSummary);
  }, []);

  if (!summary) {
    return <p className="text-sm text-neutral-500">読み込み中...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg text-primary-700">フォレスパ</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-700">{summary.name} 様</span>
          <span
            className="rounded-full px-3 py-1 text-xs font-medium text-white"
            style={{ backgroundColor: summary.statusColor }}
          >
            {summary.statusName}
          </span>
        </div>
      </div>

      {summary.nextReservation ? (
        <a
          href="/mypage/reservation"
          className="flex flex-col gap-1 rounded-lg border border-primary-200 bg-primary-50 p-4"
        >
          <p className="text-xs text-primary-600">次回のご予約</p>
          <p className="font-medium text-neutral-800">
            {summary.nextReservation.reservationDate} {summary.nextReservation.startTimeLabel}〜
          </p>
          <p className="text-sm text-neutral-600">
            {summary.nextReservation.storeName} / {summary.nextReservation.courseName}
          </p>
          {summary.nextReservation.staffName && (
            <p className="text-sm text-neutral-600">担当：{summary.nextReservation.staffName}</p>
          )}
        </a>
      ) : (
        <div className="rounded-lg border border-neutral-200 p-4 text-sm text-neutral-500">
          次回のご予約はありません。
        </div>
      )}

      {summary.nextStatusName && summary.visitsToNextStatus !== null && (
        <div className="rounded-lg border border-neutral-200 p-4">
          <p className="text-sm text-neutral-700">
            次回来店まであと{summary.visitsToNextStatus}回で{summary.nextStatusName}
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 型チェックとLintを実行する**

```bash
npx tsc --noEmit
npx eslint .
```

- [ ] **Step 4: 変更ファイルを報告する（コミットしない）**

---

## Task 8: 予約確認・変更・キャンセル画面 M-04（軽量検証）

**Files:**
- Create: `app/mypage/reservation/page.tsx`

- [ ] **Step 1: 実装する**

`app/mypage/reservation/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  getMemberNextReservation,
  cancelMemberReservation,
  type MemberReservationDetail,
} from "@/app/actions/member-reservation-detail";

export default function MemberReservationPage() {
  const [reservation, setReservation] = useState<MemberReservationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getMemberNextReservation().then((r) => {
      setReservation(r);
      setLoading(false);
    });
  }, []);

  async function handleCancel() {
    if (!reservation) return;
    if (!window.confirm("ご予約をキャンセルします。よろしいですか？")) return;

    setProcessing(true);
    const result = await cancelMemberReservation({ reservationId: reservation.id });
    setProcessing(false);

    if (result.status === "cancelled") {
      setReservation(null);
      setMessage("ご予約をキャンセルしました。");
    } else if (result.status === "deadline_passed") {
      setMessage("キャンセル期限を過ぎているため、お電話にて店舗へご連絡ください。");
    } else {
      setMessage("キャンセルに失敗しました。");
    }
  }

  async function handleChange() {
    if (!reservation) return;
    if (
      !window.confirm(
        "変更のため、現在のご予約を一度キャンセルして新しいご予約に進みます。よろしいですか？",
      )
    ) {
      return;
    }

    setProcessing(true);
    const result = await cancelMemberReservation({ reservationId: reservation.id });
    setProcessing(false);

    if (result.status === "cancelled") {
      window.location.href = "/reserve";
    } else if (result.status === "deadline_passed") {
      setMessage("変更期限を過ぎているため、お電話にて店舗へご連絡ください。");
    } else {
      setMessage("変更に失敗しました。");
    }
  }

  if (loading) {
    return <p className="text-sm text-neutral-500">読み込み中...</p>;
  }

  if (!reservation) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-heading text-xl text-primary-700">予約確認</h1>
        {message && <p className="text-sm text-neutral-600">{message}</p>}
        <p className="text-sm text-neutral-500">次回のご予約はありません。</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-xl text-primary-700">予約確認</h1>
      {message && <p className="text-sm text-neutral-600">{message}</p>}

      <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4">
        <p className="font-medium text-neutral-800">
          {reservation.reservationDate} {reservation.startTimeLabel}〜{reservation.endTimeLabel}
        </p>
        <p className="text-sm text-neutral-600">店舗：{reservation.storeName}</p>
        <p className="text-sm text-neutral-600">メニュー：{reservation.courseName}</p>
        {reservation.optionNames.length > 0 && (
          <p className="text-sm text-neutral-600">
            オプション：{reservation.optionNames.join("、")}
          </p>
        )}
        {reservation.staffName && (
          <p className="text-sm text-neutral-600">担当：{reservation.staffName}</p>
        )}
        <p className="text-sm font-medium text-neutral-800">
          合計金額：{reservation.totalPrice.toLocaleString()}円
        </p>
      </div>

      {reservation.canModify ? (
        <div className="flex gap-3">
          <button
            type="button"
            disabled={processing}
            onClick={handleChange}
            className="h-12 flex-1 rounded-lg border border-primary-500 font-medium text-primary-600 disabled:opacity-50"
          >
            変更する
          </button>
          <button
            type="button"
            disabled={processing}
            onClick={handleCancel}
            className="h-12 flex-1 rounded-lg border border-error text-error disabled:opacity-50"
          >
            キャンセルする
          </button>
        </div>
      ) : (
        <div className="rounded-lg bg-neutral-100 p-4 text-sm text-neutral-600">
          <p>キャンセル期限（施術日前日23:59）を過ぎています。</p>
          <p>お電話にて店舗へご連絡ください：{reservation.storePhone}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 型チェックとLintを実行する**

```bash
npx tsc --noEmit
npx eslint .
```

- [ ] **Step 3: 変更ファイルを報告する（コミットしない）**

---

## Task 9: 来店履歴・ステータス確認画面 M-05（軽量検証）

**Files:**
- Create: `app/mypage/history/page.tsx`

- [ ] **Step 1: 実装する**

`app/mypage/history/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  getMemberReservationHistory,
  type MemberReservationHistoryItem,
} from "@/app/actions/member-reservation-history";
import {
  listCustomerStatuses,
  type CustomerStatusItem,
} from "@/app/actions/customer-statuses";

const STATUS_LABEL: Record<string, string> = {
  completed: "来店済み",
  confirmed: "予約確定",
  cancelled: "キャンセル",
  no_show: "無断キャンセル",
};

export default function MemberHistoryPage() {
  const [history, setHistory] = useState<MemberReservationHistoryItem[]>([]);
  const [statuses, setStatuses] = useState<CustomerStatusItem[]>([]);

  useEffect(() => {
    getMemberReservationHistory().then((h) => setHistory(h ?? []));
    listCustomerStatuses().then(setStatuses);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-xl text-primary-700">来店履歴・ステータス確認</h1>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-neutral-600">ステータス条件</h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="p-3">ステータス</th>
                <th className="p-3">来店回数</th>
              </tr>
            </thead>
            <tbody>
              {statuses.map((s) => (
                <tr key={s.id} className="border-b border-neutral-100 last:border-0">
                  <td className="p-3">
                    <span
                      className="rounded-full px-2 py-1 text-xs font-medium text-white"
                      style={{ backgroundColor: s.colorCode }}
                    >
                      {s.name}
                    </span>
                  </td>
                  <td className="p-3">{s.minVisitCount}回以上</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-neutral-600">来店履歴</h2>
        {history.length === 0 ? (
          <p className="text-sm text-neutral-500">来店履歴はまだありません。</p>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map((h) => (
              <div key={h.id} className="rounded-lg border border-neutral-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-neutral-800">{h.date}</p>
                  <span className="text-xs text-neutral-500">{STATUS_LABEL[h.status] ?? h.status}</span>
                </div>
                <p className="text-sm text-neutral-600">
                  {h.storeName} / {h.courseName}
                </p>
                {h.staffName && <p className="text-sm text-neutral-600">担当：{h.staffName}</p>}
                <p className="text-sm font-medium text-neutral-800">
                  {h.totalPrice.toLocaleString()}円
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 型チェックとLintを実行する**

```bash
npx tsc --noEmit
npx eslint .
```

- [ ] **Step 3: 変更ファイルを報告する（コミットしない）**

---

## Task 10: プロフィール編集画面 M-06（軽量検証）

**Files:**
- Create: `app/mypage/profile/page.tsx`

- [ ] **Step 1: 実装する**

`app/mypage/profile/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  getMemberProfile,
  updateMemberProfile,
  changeMemberPassword,
  type MemberProfile,
} from "@/app/actions/update-member-profile";

const inputClass = "h-12 rounded-md border border-neutral-300 px-3";

export default function MemberProfilePage() {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  useEffect(() => {
    getMemberProfile().then(setProfile);
  }, []);

  async function handleProfileSave() {
    if (!profile) return;
    setSavingProfile(true);
    setProfileMessage(null);
    const result = await updateMemberProfile({
      name: profile.name,
      phone: profile.phone,
      birthDate: profile.birthDate,
      gender: profile.gender,
      emailNotificationEnabled: profile.emailNotificationEnabled,
      lineNotificationEnabled: profile.lineNotificationEnabled,
    });
    setSavingProfile(false);
    setProfileMessage(result.status === "updated" ? "保存しました。" : "保存に失敗しました。");
  }

  async function handlePasswordSave() {
    setSavingPassword(true);
    setPasswordMessage(null);
    const result = await changeMemberPassword({
      currentPassword: profile?.hasPassword ? currentPassword : null,
      newPassword,
    });
    setSavingPassword(false);
    if (result.status === "updated") {
      setPasswordMessage("パスワードを更新しました。");
      setCurrentPassword("");
      setNewPassword("");
      setProfile((p) => (p ? { ...p, hasPassword: true } : p));
    } else if (result.status === "incorrect_current_password") {
      setPasswordMessage("現在のパスワードが正しくありません。");
    } else {
      setPasswordMessage("更新に失敗しました。");
    }
  }

  if (!profile) {
    return <p className="text-sm text-neutral-500">読み込み中...</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-heading text-xl text-primary-700">プロフィール編集</h1>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-neutral-600">基本情報</h2>
        {profileMessage && <p className="text-sm text-neutral-600">{profileMessage}</p>}
        <input
          type="text"
          value={profile.name}
          onChange={(e) => setProfile({ ...profile, name: e.target.value })}
          className={inputClass}
          placeholder="氏名"
        />
        <input
          type="tel"
          value={profile.phone}
          onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
          className={inputClass}
          placeholder="電話番号"
        />
        <input
          type="date"
          value={profile.birthDate}
          onChange={(e) => setProfile({ ...profile, birthDate: e.target.value })}
          className={inputClass}
        />
        <select
          value={profile.gender}
          onChange={(e) =>
            setProfile({ ...profile, gender: e.target.value as MemberProfile["gender"] })
          }
          className={inputClass}
        >
          <option value="female">女性</option>
          <option value="male">男性</option>
          <option value="other">その他</option>
        </select>

        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={profile.emailNotificationEnabled}
            onChange={(e) =>
              setProfile({ ...profile, emailNotificationEnabled: e.target.checked })
            }
          />
          メール配信を受け取る
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={profile.lineNotificationEnabled}
            onChange={(e) => setProfile({ ...profile, lineNotificationEnabled: e.target.checked })}
          />
          LINE配信を受け取る
        </label>

        <button
          type="button"
          disabled={savingProfile}
          onClick={handleProfileSave}
          className="h-12 rounded-lg bg-primary-500 font-medium text-white disabled:opacity-50"
        >
          保存する
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-neutral-600">
          {profile.hasPassword ? "パスワード変更" : "メールログインを追加設定する"}
        </h2>
        {!profile.hasPassword && (
          <p className="text-xs text-neutral-500">
            現在LINE連携のみでログインしています。パスワードを設定すると、メールアドレス＋パスワードでもログインできるようになります。
          </p>
        )}
        {passwordMessage && <p className="text-sm text-neutral-600">{passwordMessage}</p>}
        {profile.hasPassword && (
          <input
            type="password"
            placeholder="現在のパスワード"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={inputClass}
          />
        )}
        <input
          type="password"
          placeholder="新しいパスワード"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClass}
        />
        <button
          type="button"
          disabled={savingPassword}
          onClick={handlePasswordSave}
          className="h-12 rounded-lg bg-accent-500 font-medium text-white disabled:opacity-50"
        >
          {profile.hasPassword ? "パスワードを変更する" : "パスワードを設定する"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 型チェックとLintを実行する**

```bash
npx tsc --noEmit
npx eslint .
```

- [ ] **Step 3: 全テストスイートを実行する**

```bash
npx vitest run
```

Expected: 既存136テスト＋新規テスト（Task2: 5, Task3: 9, Task4: 2, Task5: 8）＝160テストがパスする

- [ ] **Step 4: 変更ファイルを報告する（コミットしない）**

---

## 完了確認チェックリスト

- [ ] `npx vitest run` の全テストがパスする（`lib/auth/`のbcryptタイムアウトによる既知のフラーキーさを除く）
- [ ] `npx tsc --noEmit` がエラーなく通る
- [ ] `npx eslint .` がエラーなく通る
- [ ] ユーザーのターミナルで`npx prisma migrate dev`を実行し、`email_notification_enabled`・`line_notification_enabled`カラムが追加されることを確認する
- [ ] `/login`でメール＋パスワードログインができることをユーザーがブラウザで確認する
- [ ] `/mypage`・`/mypage/reservation`・`/mypage/history`・`/mypage/profile`の各画面をユーザーがブラウザで確認する
