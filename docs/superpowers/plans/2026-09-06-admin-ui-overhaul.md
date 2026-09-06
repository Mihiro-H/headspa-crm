# 管理画面UI改修 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** フォレスパ管理画面のナビゲーション（ロゴ・アイコン）、顧客/メニュー/スタッフ/店舗の新規登録、顧客一覧の編集・削除・並び替え・絞り込み、顧客ステータスの金額条件、キャンペーン・配信管理・テンプレート管理の一覧中心のUIへの再構成を実装する。

**Architecture:** 既存のNext.js App Router + Server Actions + Prisma構成を踏襲する。共通モーダルコンポーネント（radix-uiのDialogをラップ）を1つ作り、以降の「新規登録」「編集」「配信設定」画面はすべてそれを再利用する。削除は物理削除ではなく真偽値フィールドによる論理削除（`Member.isActive` / `Campaign.isPublished`）。

**Tech Stack:** Next.js (App Router) / TypeScript / Prisma (PostgreSQL) / Tailwind CSS v4 / radix-ui / lucide-react / Vitest

**関連ドキュメント:** `docs/superpowers/specs/2026-09-06-admin-ui-overhaul-design.md`（設計書）

**スコープ外:** 管理画面Googleログイン（保留）

---

## 進め方の注意

- 各タスクの「Test」ファイルがあるタスクはTDDで進める：失敗するテストを書く→実行して失敗確認→実装→実行して成功確認→コミット。
- UIページ（`app/admin/(dashboard)/**/page.tsx`）やプレゼンテーション専用コンポーネント（`components/ui/modal.tsx`）は、既存コードベースの慣習（例：`components/ui/button.tsx`にテストがない）に倣いユニットテスト対象外とする。代わりに `npx tsc --noEmit` で型エラーがないことを確認する。
- 各タスクの最後で `git add` → `git commit` する（このリポジトリでは `git commit` はagentが実行してよいが、`git push` はユーザーに任せる）。
- スキーマ変更（Task 4）の後、`npx prisma generate` は実行するが、`npx prisma migrate dev`（実データベースへの反映）は環境上の制約でユーザーに依頼する。Task 4の最後に明記する。

---

### Task 1: サイドバーのロゴ画像化とナビゲーションアイコン追加

**Files:**
- Create: `public/logo/foresupa_logo_transparent.png`
- Modify: `app/admin/(dashboard)/layout.tsx`

- [ ] **Step 1: ロゴ画像を `public/` にコピーする**

Run:
```bash
mkdir -p public/logo
cp logo/foresupa_logo_transparent.png public/logo/foresupa_logo_transparent.png
```

- [ ] **Step 2: `layout.tsx` を書き換える**

`app/admin/(dashboard)/layout.tsx` の内容を以下に置き換える：

```tsx
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Tag,
  PhoneCall,
  ListChecks,
  Percent,
  UserCog,
  Store,
  ChartColumn,
  Send,
  Repeat,
  FileText,
  Terminal,
} from "lucide-react";
import { NotificationBell } from "@/components/admin/notification-bell";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/admin/calendar", label: "予約カレンダー", icon: CalendarDays },
  { href: "/admin/customers", label: "顧客管理", icon: Users },
  { href: "/admin/customer-statuses", label: "ステータス設定", icon: Tag },
  { href: "/admin/reservations/new", label: "電話予約登録", icon: PhoneCall },
  { href: "/admin/menu", label: "メニュー・料金管理", icon: ListChecks },
  { href: "/admin/campaigns", label: "キャンペーン管理", icon: Percent },
  { href: "/admin/staff", label: "スタッフ管理", icon: UserCog },
  { href: "/admin/stores", label: "店舗管理", icon: Store },
  { href: "/admin/reports", label: "売上・月報レポート", icon: ChartColumn },
  { href: "/admin/segment-campaigns", label: "メール／LINE配信管理", icon: Send },
  { href: "/admin/auto-delivery", label: "自動配信設定", icon: Repeat },
  { href: "/admin/templates", label: "配信テンプレート管理", icon: FileText },
  { href: "/admin/cron-logs", label: "Cronジョブ実行ログ", icon: Terminal },
] as const;

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-neutral-200 bg-neutral-0 p-4">
        <Image
          src="/logo/foresupa_logo_transparent.png"
          alt="フォレスパ"
          width={160}
          height={57}
          className="h-auto w-40"
          priority
        />
        <nav className="mt-6 flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
            >
              <Icon size={16} className="shrink-0 text-neutral-500" />
              {label}
            </Link>
          ))}
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

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit`
Expected: `app/admin/(dashboard)/layout.tsx` に関するエラーなし

- [ ] **Step 4: Commit**

```bash
git add public/logo/foresupa_logo_transparent.png "app/admin/(dashboard)/layout.tsx"
git commit -m "feat: replace sidebar text logo with brand image and add nav icons

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 2: ヘッダー通知ベルアイコンの差し替え

**Files:**
- Modify: `components/admin/notification-bell.tsx`

- [ ] **Step 1: 絵文字をlucide-reactの`Bell`アイコンに置き換える**

`components/admin/notification-bell.tsx` の先頭のimportに以下を追加：

```tsx
import { Bell } from "lucide-react";
```

そして以下の行：

```tsx
        🔔
```

を以下に置き換える：

```tsx
        <Bell size={20} strokeWidth={1.75} />
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: `components/admin/notification-bell.tsx` に関するエラーなし

- [ ] **Step 3: Commit**

```bash
git add components/admin/notification-bell.tsx
git commit -m "feat: replace emoji notification bell with lucide icon

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 3: 共通モーダルコンポーネント

**Files:**
- Create: `components/ui/modal.tsx`

- [ ] **Step 1: `components/ui/modal.tsx` を作成する**

```tsx
"use client";

import { Dialog } from "radix-ui";
import { X } from "lucide-react";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ open, onOpenChange, title, children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[90vw] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-0 p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="font-heading text-lg text-primary-700">{title}</Dialog.Title>
            <Dialog.Close
              className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
              aria-label="閉じる"
            >
              <X size={18} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

（プレゼンテーション専用コンポーネントのため、既存の`components/ui/button.tsx`と同様にユニットテストは書かない。以降のタスクのUIページで実際に使用されることで動作確認する。）

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: `components/ui/modal.tsx` に関するエラーなし

- [ ] **Step 3: Commit**

```bash
git add components/ui/modal.tsx
git commit -m "feat: add reusable Modal component wrapping radix-ui Dialog

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 4: Prismaスキーマ更新（`Member.isActive` / `CustomerStatus.minTotalSpent` / `conditionMode`）

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: `Member`モデルに`isActive`を追加する**

`prisma/schema.prisma` 内、`model Member` の `totalSpent` フィールドの行：

```prisma
  totalSpent     Int      @default(0) @map("total_spent")
```

を以下に置き換える：

```prisma
  totalSpent     Int      @default(0) @map("total_spent")
  isActive       Boolean  @default(true) @map("is_active")
```

- [ ] **Step 2: `CustomerStatus`モデルに`minTotalSpent`・`conditionMode`を追加し、新しいenumを定義する**

`model CustomerStatus` ブロック全体：

```prisma
model CustomerStatus {
  id            Int    @id @default(autoincrement()) @map("status_id")
  name          String @unique @db.VarChar(50)
  minVisitCount Int    @map("min_visit_count")
  colorCode     String @map("color_code") @db.VarChar(7)
  sortOrder     Int    @map("sort_order")

  members Member[]

  @@map("customer_statuses")
}
```

を以下に置き換える（`enum StatusConditionMode`は、このファイルの他のenumと同様に、それを使う`model CustomerStatus`より前に置く）：

```prisma
enum StatusConditionMode {
  or
  and

  @@map("status_condition_mode")
}

model CustomerStatus {
  id             Int                 @id @default(autoincrement()) @map("status_id")
  name           String              @unique @db.VarChar(50)
  minVisitCount  Int                 @map("min_visit_count")
  minTotalSpent  Int                 @default(0) @map("min_total_spent")
  conditionMode  StatusConditionMode @default(and) @map("condition_mode")
  colorCode      String              @map("color_code") @db.VarChar(7)
  sortOrder      Int                 @map("sort_order")

  members Member[]

  @@map("customer_statuses")
}
```

**⚠️ `conditionMode`の既定値は`and`にすること（`or`ではない）。** 理由：`minTotalSpent`の既定値は`0`であり、`Member.totalSpent`は常に0以上のため、`or`モードだと「回数条件 OR 金額条件（0円以上＝常にtrue）」＝常にtrueとなり、既存の全顧客が全ステータスの対象になってしまう（Task 8の`statusQualifies`ロジック参照）。`and`モードなら「回数条件 AND true」＝回数条件のみとなり、既存の来店回数ベースの判定結果がそのまま維持される。

- [ ] **Step 3: Prisma Clientを再生成する**

Run: `npx prisma generate`
Expected: `Generated Prisma Client` というメッセージが出力される（データベース接続は不要）

- [ ] **Step 4: 型チェック**

Run: `npx tsc --noEmit`
Expected: まだ`isActive`や`minTotalSpent`を参照するコードがないため、エラーなし

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): add Member.isActive and CustomerStatus spend/condition fields

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

**⚠️ ユーザーへの依頼事項:** このタスク完了後、実際のデータベースにスキーマを反映するため `npx prisma migrate dev --name add_member_active_and_status_condition` をユーザー自身の環境で実行してもらう必要がある（サンドボックス環境ではDBコマンドが不安定なため）。マイグレーション未実行の間は、後続タスクのサーバーアクションはビルド・型チェックは通るが、実データベースに対する実行時エラーになる点に注意。

---

### Task 5: `search-customers.ts` — 並び替え・ステータス複数絞り込み・無効顧客表示切替

**Files:**
- Modify: `app/actions/search-customers.ts`
- Test: `app/actions/search-customers.test.ts`

- [ ] **Step 1: 失敗するテストを書く（既存テストファイルを全面書き換え）**

`app/actions/search-customers.test.ts` を以下の内容に置き換える：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchCustomers } from "./search-customers";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    member: { findMany: vi.fn() },
  },
}));

describe("searchCustomers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps members to customer list items with status, store, and contact info", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      {
        id: 1,
        name: "佐藤 太郎",
        phone: "090-1111-2222",
        visitCount: 5,
        totalSpent: 40000,
        isActive: true,
        createdAt: new Date("2026-01-15T00:00:00Z"),
        status: { name: "レギュラー", colorCode: "#8AAB78" },
        primaryStore: { id: 2, name: "フォレスパ 渋谷店" },
        reservations: [{ reservationDate: new Date("2026-08-20T00:00:00Z") }],
      },
    ] as never);

    const result = await searchCustomers({});

    expect(result).toEqual([
      {
        id: 1,
        name: "佐藤 太郎",
        phone: "090-1111-2222",
        statusName: "レギュラー",
        statusColor: "#8AAB78",
        visitCount: 5,
        totalSpent: 40000,
        lastVisitDate: "2026-08-20",
        primaryStoreId: 2,
        primaryStoreName: "フォレスパ 渋谷店",
        createdAt: "2026-01-15",
        isActive: true,
      },
    ]);
  });

  it("returns null lastVisitDate and primaryStore fields when absent", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      {
        id: 2,
        name: "鈴木 花子",
        phone: "090-3333-4444",
        visitCount: 0,
        totalSpent: 0,
        isActive: true,
        createdAt: new Date("2026-02-01T00:00:00Z"),
        status: { name: "ビジター", colorCode: "#A9A08D" },
        primaryStore: null,
        reservations: [],
      },
    ] as never);

    const result = await searchCustomers({});

    expect(result[0].lastVisitDate).toBeNull();
    expect(result[0].primaryStoreId).toBeNull();
    expect(result[0].primaryStoreName).toBeNull();
  });

  it("filters to active customers by default, and includes inactive when requested", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([] as never);

    await searchCustomers({});
    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
    );

    vi.mocked(prisma.member.findMany).mockClear();
    await searchCustomers({ includeInactive: true });
    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ isActive: true }) }),
    );
  });

  it("passes name/phone/statusIds/store filters through to the query", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([] as never);

    await searchCustomers({ name: "田中", phone: "090", statusIds: [2, 3], storeId: 3 });

    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: "田中", mode: "insensitive" },
          phone: { contains: "090" },
          statusId: { in: [2, 3] },
          primaryStoreId: 3,
        }),
      }),
    );
  });

  it("orders by the requested field and direction for plain columns", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([] as never);

    await searchCustomers({ sortBy: "totalSpent", sortDirection: "asc" });

    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { totalSpent: "asc" } }),
    );
  });

  it("sorts by last visit date in memory, placing customers with no visits last", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      {
        id: 1,
        name: "来店なし",
        phone: "090-0000-0000",
        visitCount: 0,
        totalSpent: 0,
        isActive: true,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        status: { name: "ビジター", colorCode: "#A9A08D" },
        primaryStore: null,
        reservations: [],
      },
      {
        id: 2,
        name: "直近来店",
        phone: "090-0000-0001",
        visitCount: 3,
        totalSpent: 10000,
        isActive: true,
        createdAt: new Date("2026-01-02T00:00:00Z"),
        status: { name: "レギュラー", colorCode: "#8AAB78" },
        primaryStore: null,
        reservations: [{ reservationDate: new Date("2026-08-01T00:00:00Z") }],
      },
    ] as never);

    const result = await searchCustomers({ sortBy: "lastVisitDate", sortDirection: "desc" });

    expect(result.map((c) => c.id)).toEqual([2, 1]);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run app/actions/search-customers.test.ts`
Expected: FAIL（`statusIds`/`includeInactive`/`sortBy`未対応、`phone`/`primaryStoreId`/`isActive`が結果に含まれない、等の理由で複数件失敗）

- [ ] **Step 3: 実装する**

`app/actions/search-customers.ts` を以下の内容に置き換える：

```ts
"use server";

import { prisma } from "@/lib/db";

export type CustomerSortField = "id" | "visitCount" | "totalSpent" | "lastVisitDate";
export type SortDirection = "asc" | "desc";

export interface CustomerListItem {
  id: number;
  name: string;
  phone: string;
  statusName: string;
  statusColor: string;
  visitCount: number;
  totalSpent: number;
  lastVisitDate: string | null;
  primaryStoreId: number | null;
  primaryStoreName: string | null;
  createdAt: string;
  isActive: boolean;
}

export interface CustomerSearchParams {
  name?: string;
  phone?: string;
  statusIds?: number[];
  storeId?: number;
  includeInactive?: boolean;
  sortBy?: CustomerSortField;
  sortDirection?: SortDirection;
}

// Prismaのorderby型は動的キー（[sortBy]: ...）だと型が合わないため、
// 分岐で明示的にリテラルキーのオブジェクトを組み立てる。
function buildMemberOrderBy(sortBy: CustomerSortField, sortDirection: SortDirection) {
  switch (sortBy) {
    case "visitCount":
      return { visitCount: sortDirection };
    case "totalSpent":
      return { totalSpent: sortDirection };
    case "lastVisitDate":
      // lastVisitDateはreservationsリレーションからの派生値のため、
      // DBクエリでは仮の順序を渡し、実際の並び替えは取得後にメモリ上で行う。
      return { id: "desc" as const };
    case "id":
    default:
      return { id: sortDirection };
  }
}

export async function searchCustomers(
  params: CustomerSearchParams,
): Promise<CustomerListItem[]> {
  const sortBy = params.sortBy ?? "id";
  const sortDirection = params.sortDirection ?? "desc";

  const members = await prisma.member.findMany({
    where: {
      ...(params.name ? { name: { contains: params.name, mode: "insensitive" } } : {}),
      ...(params.phone ? { phone: { contains: params.phone } } : {}),
      ...(params.statusIds && params.statusIds.length > 0
        ? { statusId: { in: params.statusIds } }
        : {}),
      ...(params.storeId ? { primaryStoreId: params.storeId } : {}),
      ...(params.includeInactive ? {} : { isActive: true }),
    },
    include: {
      status: true,
      primaryStore: true,
      reservations: {
        where: { status: "completed" },
        orderBy: { reservationDate: "desc" },
        take: 1,
      },
    },
    orderBy: buildMemberOrderBy(sortBy, sortDirection),
  });

  const mapped: CustomerListItem[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    phone: m.phone,
    statusName: m.status.name,
    statusColor: m.status.colorCode,
    visitCount: m.visitCount,
    totalSpent: m.totalSpent,
    lastVisitDate: m.reservations[0]?.reservationDate.toISOString().slice(0, 10) ?? null,
    primaryStoreId: m.primaryStore?.id ?? null,
    primaryStoreName: m.primaryStore?.name ?? null,
    createdAt: m.createdAt.toISOString().slice(0, 10),
    isActive: m.isActive,
  }));

  if (sortBy === "lastVisitDate") {
    mapped.sort((a, b) => {
      if (a.lastVisitDate === b.lastVisitDate) return 0;
      if (a.lastVisitDate === null) return 1;
      if (b.lastVisitDate === null) return -1;
      return sortDirection === "asc"
        ? a.lastVisitDate.localeCompare(b.lastVisitDate)
        : b.lastVisitDate.localeCompare(a.lastVisitDate);
    });
  }

  return mapped;
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run app/actions/search-customers.test.ts`
Expected: PASS（6件）

- [ ] **Step 5: `reservations/new/page.tsx`が壊れていないか型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし（`reservations/new/page.tsx`は`name`のみ渡しているため後方互換）

- [ ] **Step 6: Commit**

```bash
git add app/actions/search-customers.ts app/actions/search-customers.test.ts
git commit -m "feat: add sorting, multi-status filter, and inactive toggle to searchCustomers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 6: `manage-customers.ts`（新規） — 顧客の作成・編集・無効化・復元

**Files:**
- Create: `app/actions/manage-customers.ts`
- Test: `app/actions/manage-customers.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/manage-customers.test.ts` を新規作成：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createCustomerByAdmin,
  updateCustomerByAdmin,
  deactivateCustomer,
  reactivateCustomer,
} from "./manage-customers";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    member: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    customerStatus: { findFirstOrThrow: vi.fn() },
  },
}));

describe("createCustomerByAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a member with the lowest-ranked status when the email is unused", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.customerStatus.findFirstOrThrow).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.member.create).mockResolvedValue({ id: 42 } as never);

    const result = await createCustomerByAdmin({
      name: "山田 太郎",
      email: "yamada@example.com",
      phone: "090-1234-5678",
      gender: "male",
      birthMonth: 4,
      primaryStoreId: 2,
    });

    expect(result).toEqual({ status: "created", memberId: 42 });
    expect(prisma.member.create).toHaveBeenCalledWith({
      data: {
        name: "山田 太郎",
        email: "yamada@example.com",
        phone: "090-1234-5678",
        gender: "male",
        birthMonth: 4,
        primaryStoreId: 2,
        statusId: 1,
      },
    });
  });

  it("returns email_taken without creating a member when the email already exists", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue({ id: 1 } as never);

    const result = await createCustomerByAdmin({
      name: "山田 太郎",
      email: "taken@example.com",
      phone: "090-1234-5678",
      gender: "male",
      birthMonth: 4,
      primaryStoreId: null,
    });

    expect(result).toEqual({ status: "email_taken" });
    expect(prisma.member.create).not.toHaveBeenCalled();
  });
});

describe("updateCustomerByAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates name, phone, and primary store", async () => {
    vi.mocked(prisma.member.update).mockResolvedValue({} as never);

    await updateCustomerByAdmin({
      memberId: 1,
      name: "新氏名",
      phone: "090-0000-0000",
      primaryStoreId: 3,
    });

    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: "新氏名", phone: "090-0000-0000", primaryStoreId: 3 },
    });
  });
});

describe("deactivateCustomer / reactivateCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deactivateCustomer sets isActive to false", async () => {
    vi.mocked(prisma.member.update).mockResolvedValue({} as never);

    await deactivateCustomer(1);

    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isActive: false },
    });
  });

  it("reactivateCustomer sets isActive to true", async () => {
    vi.mocked(prisma.member.update).mockResolvedValue({} as never);

    await reactivateCustomer(1);

    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isActive: true },
    });
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run app/actions/manage-customers.test.ts`
Expected: FAIL（`./manage-customers`が存在しない）

- [ ] **Step 3: 実装する**

`app/actions/manage-customers.ts` を新規作成：

```ts
"use server";

import { prisma } from "@/lib/db";
import type { MemberGender } from "@/lib/reservation/gender-restriction";

export interface CreateCustomerByAdminParams {
  name: string;
  email: string;
  phone: string;
  gender: MemberGender;
  birthMonth: number;
  primaryStoreId: number | null;
}

export type CreateCustomerByAdminResult =
  | { status: "created"; memberId: number }
  | { status: "email_taken" };

export async function createCustomerByAdmin(
  params: CreateCustomerByAdminParams,
): Promise<CreateCustomerByAdminResult> {
  const existing = await prisma.member.findUnique({ where: { email: params.email } });
  if (existing) {
    return { status: "email_taken" };
  }

  const defaultStatus = await prisma.customerStatus.findFirstOrThrow({
    orderBy: { sortOrder: "asc" },
  });

  const member = await prisma.member.create({
    data: {
      name: params.name,
      email: params.email,
      phone: params.phone,
      gender: params.gender,
      birthMonth: params.birthMonth,
      primaryStoreId: params.primaryStoreId,
      statusId: defaultStatus.id,
    },
  });

  return { status: "created", memberId: member.id };
}

export interface UpdateCustomerByAdminParams {
  memberId: number;
  name: string;
  phone: string;
  primaryStoreId: number | null;
}

export async function updateCustomerByAdmin(params: UpdateCustomerByAdminParams): Promise<void> {
  await prisma.member.update({
    where: { id: params.memberId },
    data: {
      name: params.name,
      phone: params.phone,
      primaryStoreId: params.primaryStoreId,
    },
  });
}

export async function deactivateCustomer(memberId: number): Promise<void> {
  await prisma.member.update({ where: { id: memberId }, data: { isActive: false } });
}

export async function reactivateCustomer(memberId: number): Promise<void> {
  await prisma.member.update({ where: { id: memberId }, data: { isActive: true } });
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run app/actions/manage-customers.test.ts`
Expected: PASS（5件）

- [ ] **Step 5: Commit**

```bash
git add app/actions/manage-customers.ts app/actions/manage-customers.test.ts
git commit -m "feat: add admin customer create/update/deactivate/reactivate actions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 7: `customer-statuses.ts` — 最低利用金額とOR/AND条件

**Files:**
- Modify: `app/actions/customer-statuses.ts`
- Test: `app/actions/customer-statuses.test.ts`

- [ ] **Step 1: 失敗するテストを書く（既存テストファイルを全面書き換え）**

`app/actions/customer-statuses.test.ts` を以下の内容に置き換える：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listCustomerStatuses, updateStatusCondition } from "./customer-statuses";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    customerStatus: { findMany: vi.fn(), update: vi.fn() },
  },
}));

describe("listCustomerStatuses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all statuses ordered by sortOrder, including spend threshold and condition mode", async () => {
    vi.mocked(prisma.customerStatus.findMany).mockResolvedValue([
      {
        id: 1,
        name: "ビジター",
        minVisitCount: 1,
        minTotalSpent: 0,
        conditionMode: "or",
        colorCode: "#A9A08D",
        sortOrder: 1,
      },
    ] as never);

    const result = await listCustomerStatuses();

    expect(result).toEqual([
      {
        id: 1,
        name: "ビジター",
        minVisitCount: 1,
        minTotalSpent: 0,
        conditionMode: "or",
        colorCode: "#A9A08D",
        sortOrder: 1,
      },
    ]);
    expect(prisma.customerStatus.findMany).toHaveBeenCalledWith({
      orderBy: { sortOrder: "asc" },
    });
  });
});

describe("updateStatusCondition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates minVisitCount, minTotalSpent, and conditionMode for the given status", async () => {
    vi.mocked(prisma.customerStatus.update).mockResolvedValue({} as never);

    await updateStatusCondition({
      statusId: 2,
      minVisitCount: 3,
      minTotalSpent: 30000,
      conditionMode: "and",
    });

    expect(prisma.customerStatus.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { minVisitCount: 3, minTotalSpent: 30000, conditionMode: "and" },
    });
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run app/actions/customer-statuses.test.ts`
Expected: FAIL（`updateStatusCondition`が存在しない、`minTotalSpent`/`conditionMode`が結果に含まれない）

- [ ] **Step 3: 実装する**

`app/actions/customer-statuses.ts` を以下の内容に置き換える：

```ts
"use server";

import { prisma } from "@/lib/db";
import type { StatusConditionMode } from "@prisma/client";

export interface CustomerStatusItem {
  id: number;
  name: string;
  minVisitCount: number;
  minTotalSpent: number;
  conditionMode: StatusConditionMode;
  colorCode: string;
  sortOrder: number;
}

export async function listCustomerStatuses(): Promise<CustomerStatusItem[]> {
  const statuses = await prisma.customerStatus.findMany({ orderBy: { sortOrder: "asc" } });
  return statuses.map((s) => ({
    id: s.id,
    name: s.name,
    minVisitCount: s.minVisitCount,
    minTotalSpent: s.minTotalSpent,
    conditionMode: s.conditionMode,
    colorCode: s.colorCode,
    sortOrder: s.sortOrder,
  }));
}

export interface UpdateStatusConditionParams {
  statusId: number;
  minVisitCount?: number;
  minTotalSpent?: number;
  conditionMode?: StatusConditionMode;
}

export async function updateStatusCondition(params: UpdateStatusConditionParams): Promise<void> {
  await prisma.customerStatus.update({
    where: { id: params.statusId },
    data: {
      ...(params.minVisitCount !== undefined ? { minVisitCount: params.minVisitCount } : {}),
      ...(params.minTotalSpent !== undefined ? { minTotalSpent: params.minTotalSpent } : {}),
      ...(params.conditionMode !== undefined ? { conditionMode: params.conditionMode } : {}),
    },
  });
}
```

**⚠️ フィールドは全て省略可能（Partial）にすること。** Task 14のUIで最低来店回数・最低利用金額・条件を行ごとに別々の`onBlur`/`onChange`で個別保存する設計のため、常に3項目全部を送る実装だと、あるフィールドの保存リクエストがまだ返ってくる前に別フィールドを編集・保存すると、古い（編集前の）値で上書きしてしまう競合状態が発生する（コード品質レビューで発覚）。各呼び出しが実際に変更したフィールドだけを送るようにすることで、この問題を構造的に防ぐ。

- [ ] **Step 4: テストを実行して成功を確認する**

`app/actions/customer-statuses.test.ts`の`describe("updateStatusCondition", ...)`ブロックを以下に置き換える（既存の1件に加え、部分更新の2件を追加）：

```ts
describe("updateStatusCondition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates minVisitCount, minTotalSpent, and conditionMode when all are provided", async () => {
    vi.mocked(prisma.customerStatus.update).mockResolvedValue({} as never);

    await updateStatusCondition({
      statusId: 2,
      minVisitCount: 3,
      minTotalSpent: 30000,
      conditionMode: "and",
    });

    expect(prisma.customerStatus.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { minVisitCount: 3, minTotalSpent: 30000, conditionMode: "and" },
    });
  });

  it("updates only minVisitCount when only that field is provided", async () => {
    vi.mocked(prisma.customerStatus.update).mockResolvedValue({} as never);

    await updateStatusCondition({ statusId: 2, minVisitCount: 5 });

    expect(prisma.customerStatus.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { minVisitCount: 5 },
    });
  });

  it("updates only conditionMode when only that field is provided", async () => {
    vi.mocked(prisma.customerStatus.update).mockResolvedValue({} as never);

    await updateStatusCondition({ statusId: 2, conditionMode: "or" });

    expect(prisma.customerStatus.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { conditionMode: "or" },
    });
  });
});
```

Run: `npx vitest run app/actions/customer-statuses.test.ts`
Expected: PASS（4件）

- [ ] **Step 5: Commit**

```bash
git add app/actions/customer-statuses.ts app/actions/customer-statuses.test.ts
git commit -m "feat: extend customer status settings with spend threshold and OR/AND condition

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 8: `reporting-jobs.ts` — ステータス自動判定のOR/AND対応

**Files:**
- Modify: `lib/cron/reporting-jobs.ts`
- Test: `lib/cron/reporting-jobs.test.ts`

- [ ] **Step 1: 失敗するテストを書く（既存テストファイルを全面書き換え）**

`lib/cron/reporting-jobs.test.ts` を以下の内容に置き換える：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runStatusUpdateJob, runMonthlyReportJob, statusQualifies } from "./reporting-jobs";
import { prisma } from "@/lib/db";
import { getSalesReport } from "@/app/actions/sales-report";

vi.mock("@/lib/db", () => ({
  prisma: {
    customerStatus: { findMany: vi.fn() },
    member: { findMany: vi.fn(), update: vi.fn() },
    cronJobLog: { create: vi.fn() },
  },
}));

vi.mock("@/app/actions/sales-report", () => ({
  getSalesReport: vi.fn(),
}));

const now = new Date("2026-10-01T03:00:00.000Z");

describe("statusQualifies", () => {
  it("qualifies when either condition is met in OR mode", () => {
    const status = { minVisitCount: 5, minTotalSpent: 50000, conditionMode: "or" as const };
    expect(statusQualifies(status, { visitCount: 6, totalSpent: 0 })).toBe(true);
    expect(statusQualifies(status, { visitCount: 0, totalSpent: 60000 })).toBe(true);
    expect(statusQualifies(status, { visitCount: 0, totalSpent: 0 })).toBe(false);
  });

  it("requires both conditions in AND mode", () => {
    const status = { minVisitCount: 5, minTotalSpent: 50000, conditionMode: "and" as const };
    expect(statusQualifies(status, { visitCount: 6, totalSpent: 0 })).toBe(false);
    expect(statusQualifies(status, { visitCount: 6, totalSpent: 60000 })).toBe(true);
  });
});

describe("runStatusUpdateJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.cronJobLog.create).mockResolvedValue({} as never);
  });

  it("promotes a member whose visit count now qualifies for a higher status", async () => {
    vi.mocked(prisma.customerStatus.findMany).mockResolvedValue([
      { id: 1, minVisitCount: 0, minTotalSpent: 0, conditionMode: "or" },
      { id: 2, minVisitCount: 5, minTotalSpent: 0, conditionMode: "or" },
      { id: 3, minVisitCount: 10, minTotalSpent: 0, conditionMode: "or" },
    ] as never);
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      { id: 100, visitCount: 6, totalSpent: 0, statusId: 1 },
      { id: 101, visitCount: 3, totalSpent: 0, statusId: 1 },
    ] as never);
    vi.mocked(prisma.member.update).mockResolvedValue({} as never);

    await runStatusUpdateJob(now);

    expect(prisma.member.update).toHaveBeenCalledTimes(1);
    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: 100 },
      data: { statusId: 2 },
    });
    expect(prisma.cronJobLog.create).toHaveBeenCalledWith({
      data: { jobName: "status_update", executedAt: now, status: "success", targetCount: 1 },
    });
  });

  it("does not update a member who is already at the correct status", async () => {
    vi.mocked(prisma.customerStatus.findMany).mockResolvedValue([
      { id: 1, minVisitCount: 0, minTotalSpent: 0, conditionMode: "or" },
      { id: 2, minVisitCount: 5, minTotalSpent: 0, conditionMode: "or" },
    ] as never);
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      { id: 100, visitCount: 6, totalSpent: 0, statusId: 2 },
    ] as never);

    await runStatusUpdateJob(now);

    expect(prisma.member.update).not.toHaveBeenCalled();
    expect(prisma.cronJobLog.create).toHaveBeenCalledWith({
      data: { jobName: "status_update", executedAt: now, status: "success", targetCount: 0 },
    });
  });

  it("promotes a member who qualifies by total spend alone under OR mode", async () => {
    vi.mocked(prisma.customerStatus.findMany).mockResolvedValue([
      { id: 1, minVisitCount: 0, minTotalSpent: 0, conditionMode: "or" },
      { id: 2, minVisitCount: 10, minTotalSpent: 50000, conditionMode: "or" },
    ] as never);
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      { id: 100, visitCount: 1, totalSpent: 60000, statusId: 1 },
    ] as never);
    vi.mocked(prisma.member.update).mockResolvedValue({} as never);

    await runStatusUpdateJob(now);

    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: 100 },
      data: { statusId: 2 },
    });
  });

  it("does not promote a member who meets only one condition under AND mode", async () => {
    vi.mocked(prisma.customerStatus.findMany).mockResolvedValue([
      { id: 1, minVisitCount: 0, minTotalSpent: 0, conditionMode: "or" },
      { id: 2, minVisitCount: 10, minTotalSpent: 50000, conditionMode: "and" },
    ] as never);
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      { id: 100, visitCount: 12, totalSpent: 1000, statusId: 1 },
    ] as never);

    await runStatusUpdateJob(now);

    expect(prisma.member.update).not.toHaveBeenCalled();
  });
});

describe("runMonthlyReportJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.cronJobLog.create).mockResolvedValue({} as never);
  });

  it("aggregates the previous month's sales report and logs the customer count", async () => {
    vi.mocked(getSalesReport).mockResolvedValue({
      summary: {
        salesTotal: 500000,
        customerCount: 42,
        averageSpend: 11904,
        newCustomerCount: 10,
        repeatCustomerCount: 32,
        nominationSalesRatio: 60,
      },
      dailySales: [],
      courseSales: [],
      staffSales: [],
      details: [],
    } as never);

    await runMonthlyReportJob(now);

    expect(getSalesReport).toHaveBeenCalledWith({
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      storeId: null,
    });
    expect(prisma.cronJobLog.create).toHaveBeenCalledWith({
      data: { jobName: "monthly_report", executedAt: now, status: "success", targetCount: 42 },
    });
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run lib/cron/reporting-jobs.test.ts`
Expected: FAIL（`statusQualifies`が存在しない、既存2件も`totalSpent`未考慮で失敗）

- [ ] **Step 3: 実装する**

`lib/cron/reporting-jobs.ts` を以下の内容に置き換える：

```ts
import { prisma } from "@/lib/db";
import { runCronJob } from "./run-job";
import { getSalesReport } from "@/app/actions/sales-report";

export interface StatusCondition {
  minVisitCount: number;
  minTotalSpent: number;
  conditionMode: "or" | "and";
}

export interface MemberActivity {
  visitCount: number;
  totalSpent: number;
}

// ORなら回数・金額いずれかを満たせば昇格対象、ANDなら両方を満たす必要がある。
export function statusQualifies(status: StatusCondition, member: MemberActivity): boolean {
  const visitOk = member.visitCount >= status.minVisitCount;
  const spentOk = member.totalSpent >= status.minTotalSpent;

  if (status.conditionMode === "and") {
    // ANDでは閾値0（未設定）の条件は member.xxx >= 0 で常に満たされるため、
    // 実質的にもう一方の条件だけで判定される（意図した挙動なので特別扱い不要）。
    return visitOk && spentOk;
  }

  // ORで閾値0（未設定）の条件をそのまま使うと、その条件だけで常にtrueになり
  // もう一方の条件を無視してしまう。閾値が実際に設定されている（0より大きい）
  // 条件のみをOR判定の対象にし、両方とも未設定なら無条件クリアの基本ステータスとして扱う。
  const visitApplies = status.minVisitCount > 0;
  const spentApplies = status.minTotalSpent > 0;
  if (!visitApplies && !spentApplies) return true;
  return (visitApplies && visitOk) || (spentApplies && spentOk);
}
```

**⚠️ 実装時の追加修正（TDDのStep2で発覚）：** 上記の単純な`visitOk && spentOk`／`visitOk || spentOk`のままだと、OR条件で片方の閾値が`0`（未設定）の場合に「0以上」が常にtrueとなり、設定していないはずの条件で常に昇格してしまう不具合がある（Task 4で発見した`conditionMode`既定値の問題と同根）。上記の通り、OR判定では実際に閾値が設定されている（`0`より大きい）条件のみを対象にし、両方とも未設定なら無条件で該当する「基本ステータス」として扱うよう修正済みの実装を正としている。ANDモードは元のロジックのままで問題ない（閾値0の条件は「常に満たす」側に倒れるため、結果的にもう一方の条件だけで判定される）。

```ts
export async function runStatusUpdateJob(now: Date = new Date()): Promise<void> {
  await runCronJob(
    "status_update",
    async () => {
      const statuses = await prisma.customerStatus.findMany({
        orderBy: { sortOrder: "asc" },
      });
      const members = await prisma.member.findMany();

      let count = 0;
      for (const member of members) {
        const qualifying = statuses.filter((s) => statusQualifies(s, member));
        const best = qualifying[qualifying.length - 1];
        if (best && best.id !== member.statusId) {
          await prisma.member.update({ where: { id: member.id }, data: { statusId: best.id } });
          count++;
        }
      }
      return { targetCount: count };
    },
    now,
  );
}

export async function runMonthlyReportJob(now: Date = new Date()): Promise<void> {
  await runCronJob(
    "monthly_report",
    async () => {
      const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const lastMonthEnd = new Date(firstOfThisMonth.getTime() - 1);
      const lastMonthStart = new Date(
        Date.UTC(lastMonthEnd.getUTCFullYear(), lastMonthEnd.getUTCMonth(), 1),
      );

      const report = await getSalesReport({
        startDate: lastMonthStart.toISOString().slice(0, 10),
        endDate: lastMonthEnd.toISOString().slice(0, 10),
        storeId: null,
      });

      return { targetCount: report.summary.customerCount };
    },
    now,
  );
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run lib/cron/reporting-jobs.test.ts`
Expected: PASS（7件）

- [ ] **Step 5: Commit**

```bash
git add lib/cron/reporting-jobs.ts lib/cron/reporting-jobs.test.ts
git commit -m "feat: support OR/AND condition in automatic status promotion

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 9: `manage-courses.ts` — `createCourse`

**Files:**
- Modify: `app/actions/manage-courses.ts`
- Test: `app/actions/manage-courses.test.ts`

- [ ] **Step 1: 失敗するテストを追記する**

`app/actions/manage-courses.test.ts` の `vi.mock("@/lib/db", ...)` を以下に置き換える：

```ts
vi.mock("@/lib/db", () => ({
  prisma: {
    course: { findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}));
```

ファイル末尾（`updateCoursePrice`の`describe`ブロックの後）に以下を追加：

```ts

describe("createCourse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a course under the given category", async () => {
    vi.mocked(prisma.course.create).mockResolvedValue({ id: 7 } as never);

    const result = await createCourse({
      categoryId: 3,
      name: "プレミアム",
      durationEstimateMin: 90,
      treatmentTimeMin: 75,
      price: 15000,
      genderRestriction: "none",
      sortOrder: 1,
    });

    expect(result).toEqual({ courseId: 7 });
    expect(prisma.course.create).toHaveBeenCalledWith({
      data: {
        categoryId: 3,
        name: "プレミアム",
        durationEstimateMin: 90,
        treatmentTimeMin: 75,
        price: 15000,
        genderRestriction: "none",
        sortOrder: 1,
      },
    });
  });
});
```

ファイル冒頭のimportを以下に更新する：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listAllCoursesForManagement, updateCoursePrice, createCourse } from "./manage-courses";
import { prisma } from "@/lib/db";
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run app/actions/manage-courses.test.ts`
Expected: FAIL（`createCourse`が存在しない）

- [ ] **Step 3: 実装する**

`app/actions/manage-courses.ts` の末尾に以下を追加：

```ts

export interface CreateCourseParams {
  categoryId: number;
  name: string;
  durationEstimateMin: number;
  treatmentTimeMin: number;
  price: number;
  genderRestriction: GenderRestriction;
  sortOrder: number;
}

export async function createCourse(params: CreateCourseParams): Promise<{ courseId: number }> {
  const course = await prisma.course.create({
    data: {
      categoryId: params.categoryId,
      name: params.name,
      durationEstimateMin: params.durationEstimateMin,
      treatmentTimeMin: params.treatmentTimeMin,
      price: params.price,
      genderRestriction: params.genderRestriction,
      sortOrder: params.sortOrder,
    },
  });
  return { courseId: course.id };
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run app/actions/manage-courses.test.ts`
Expected: PASS（2件）

- [ ] **Step 5: Commit**

```bash
git add app/actions/manage-courses.ts app/actions/manage-courses.test.ts
git commit -m "feat: add createCourse admin action

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 10: `manage-staff.ts` — `createStaff`

**Files:**
- Modify: `app/actions/manage-staff.ts`
- Test: `app/actions/manage-staff.test.ts`

- [ ] **Step 1: 失敗するテストを追記する**

`app/actions/manage-staff.test.ts` の `vi.mock("@/lib/db", ...)` を以下に置き換える：

```ts
vi.mock("@/lib/db", () => ({
  prisma: {
    staff: { findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}));
```

ファイル冒頭のimportを以下に更新する：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listAllStaff, updateStaff, createStaff } from "./manage-staff";
import { prisma } from "@/lib/db";
```

ファイル末尾に以下を追加：

```ts

describe("createStaff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a staff member at the given store", async () => {
    vi.mocked(prisma.staff.create).mockResolvedValue({ id: 9 } as never);

    const result = await createStaff({
      storeId: 2,
      name: "高橋 一郎",
      bio: "得意メニュー：アロマ",
      nominationFee: 1200,
    });

    expect(result).toEqual({ staffId: 9 });
    expect(prisma.staff.create).toHaveBeenCalledWith({
      data: {
        storeId: 2,
        name: "高橋 一郎",
        bio: "得意メニュー：アロマ",
        nominationFee: 1200,
      },
    });
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run app/actions/manage-staff.test.ts`
Expected: FAIL（`createStaff`が存在しない）

- [ ] **Step 3: 実装する**

`app/actions/manage-staff.ts` の末尾に以下を追加：

```ts

export interface CreateStaffParams {
  storeId: number;
  name: string;
  bio: string | null;
  nominationFee: number;
}

export async function createStaff(params: CreateStaffParams): Promise<{ staffId: number }> {
  const staff = await prisma.staff.create({
    data: {
      storeId: params.storeId,
      name: params.name,
      bio: params.bio,
      nominationFee: params.nominationFee,
    },
  });
  return { staffId: staff.id };
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run app/actions/manage-staff.test.ts`
Expected: PASS（2件）

- [ ] **Step 5: Commit**

```bash
git add app/actions/manage-staff.ts app/actions/manage-staff.test.ts
git commit -m "feat: add createStaff admin action

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 11: `manage-stores.ts` — `createStore`

**Files:**
- Modify: `app/actions/manage-stores.ts`
- Test: `app/actions/manage-stores.test.ts`

- [ ] **Step 1: 失敗するテストを追記する**

`app/actions/manage-stores.test.ts` の `vi.mock("@/lib/db", ...)` を以下に置き換える：

```ts
vi.mock("@/lib/db", () => ({
  prisma: {
    store: { findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}));
```

ファイル冒頭のimportを以下に更新する：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listAllStoresForManagement, updateStoreDetails, createStore } from "./manage-stores";
import { prisma } from "@/lib/db";
```

ファイル末尾に以下を追加：

```ts

describe("createStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a store, converting HH:mm time strings to Date values", async () => {
    vi.mocked(prisma.store.create).mockResolvedValue({ id: 5 } as never);

    const result = await createStore({
      name: "フォレスパ 新宿店",
      address: "東京都新宿区...",
      phone: "03-2222-2222",
      nearestStation: "新宿駅 徒歩3分",
      weekdayOpen: "11:00",
      weekdayClose: "20:00",
      weekendOpen: "10:00",
      weekendClose: "18:00",
      luxuryLastOrderWeekday: "19:30",
      luxuryLastOrderWeekend: "17:30",
    });

    expect(result).toEqual({ storeId: 5 });
    expect(prisma.store.create).toHaveBeenCalledWith({
      data: {
        name: "フォレスパ 新宿店",
        address: "東京都新宿区...",
        phone: "03-2222-2222",
        nearestStation: "新宿駅 徒歩3分",
        weekdayOpen: new Date("1970-01-01T11:00:00Z"),
        weekdayClose: new Date("1970-01-01T20:00:00Z"),
        weekendOpen: new Date("1970-01-01T10:00:00Z"),
        weekendClose: new Date("1970-01-01T18:00:00Z"),
        luxuryLastOrderWeekday: new Date("1970-01-01T19:30:00Z"),
        luxuryLastOrderWeekend: new Date("1970-01-01T17:30:00Z"),
      },
    });
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run app/actions/manage-stores.test.ts`
Expected: FAIL（`createStore`が存在しない）

- [ ] **Step 3: 実装する**

`app/actions/manage-stores.ts` の末尾に以下を追加：

```ts

export interface CreateStoreParams {
  name: string;
  address: string | null;
  phone: string;
  nearestStation: string | null;
  weekdayOpen: string;
  weekdayClose: string;
  weekendOpen: string;
  weekendClose: string;
  luxuryLastOrderWeekday: string;
  luxuryLastOrderWeekend: string;
}

// 営業時間はPrisma上で日付なしの@db.Time()型のため、1970-01-01を基準日として扱う。
function toTimeDate(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00Z`);
}

export async function createStore(params: CreateStoreParams): Promise<{ storeId: number }> {
  const store = await prisma.store.create({
    data: {
      name: params.name,
      address: params.address,
      phone: params.phone,
      nearestStation: params.nearestStation,
      weekdayOpen: toTimeDate(params.weekdayOpen),
      weekdayClose: toTimeDate(params.weekdayClose),
      weekendOpen: toTimeDate(params.weekendOpen),
      weekendClose: toTimeDate(params.weekendClose),
      luxuryLastOrderWeekday: toTimeDate(params.luxuryLastOrderWeekday),
      luxuryLastOrderWeekend: toTimeDate(params.luxuryLastOrderWeekend),
    },
  });
  return { storeId: store.id };
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run app/actions/manage-stores.test.ts`
Expected: PASS（2件）

- [ ] **Step 5: Commit**

```bash
git add app/actions/manage-stores.ts app/actions/manage-stores.test.ts
git commit -m "feat: add createStore admin action

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 12: `manage-campaigns.ts` — 編集・論理削除・対象ID返却・includeUnpublished

**Files:**
- Modify: `app/actions/manage-campaigns.ts`
- Test: `app/actions/manage-campaigns.test.ts`

- [ ] **Step 1: 失敗するテストを書く（既存テストファイルを全面書き換え）**

`app/actions/manage-campaigns.test.ts` を以下の内容に置き換える：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
} from "./manage-campaigns";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    campaign: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

describe("listCampaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns published campaigns with target ids and names by default", async () => {
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
        targetStoreId: null,
        targetStore: null,
        courseTargets: [{ courseId: 5, course: { name: "スタンダード" } }],
        categoryTargets: [{ categoryId: 9, category: { name: "頭皮ケア重点" } }],
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
        targetStoreId: null,
        targetStoreName: "全店舗",
        targetNames: ["スタンダード", "頭皮ケア重点"],
        courseIds: [5],
        categoryIds: [9],
      },
    ]);
    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isPublished: true } }),
    );
  });

  it("includes unpublished campaigns when requested", async () => {
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([] as never);

    await listCampaigns({ includeUnpublished: true });

    expect(prisma.campaign.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
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

describe("updateCampaign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replaces campaign fields and targets", async () => {
    vi.mocked(prisma.campaign.update).mockResolvedValue({} as never);

    await updateCampaign({
      campaignId: 1,
      name: "更新後キャンペーン",
      discountType: "fixed_amount",
      discountValue: 1000,
      startDate: "2026-10-01",
      endDate: "2026-10-31",
      priority: 1,
      targetStoreId: 2,
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
        targetStoreId: 2,
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
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run app/actions/manage-campaigns.test.ts`
Expected: FAIL（`updateCampaign`/`deleteCampaign`が存在しない、`listCampaigns`の戻り値に`courseIds`等が含まれない）

- [ ] **Step 3: 実装する**

`app/actions/manage-campaigns.ts` を以下の内容に置き換える：

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
  targetStoreId: number | null;
  targetStoreName: string;
  targetNames: string[];
  courseIds: number[];
  categoryIds: number[];
}

export interface ListCampaignsParams {
  includeUnpublished?: boolean;
}

export async function listCampaigns(params?: ListCampaignsParams): Promise<CampaignListItem[]> {
  const campaigns = await prisma.campaign.findMany({
    where: params?.includeUnpublished ? {} : { isPublished: true },
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
    targetStoreId: c.targetStoreId,
    targetStoreName: c.targetStore?.name ?? "全店舗",
    targetNames: [
      ...c.courseTargets.map((t) => t.course.name),
      ...c.categoryTargets.map((t) => t.category.name),
    ],
    courseIds: c.courseTargets.map((t) => t.courseId),
    categoryIds: c.categoryTargets.map((t) => t.categoryId),
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

export interface UpdateCampaignParams {
  campaignId: number;
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
      targetStoreId: params.targetStoreId,
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
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run app/actions/manage-campaigns.test.ts`
Expected: PASS（5件）

- [ ] **Step 5: Commit**

```bash
git add app/actions/manage-campaigns.ts app/actions/manage-campaigns.test.ts
git commit -m "feat: add campaign update/delete actions and includeUnpublished listing

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

**⚠️ 実装後の追加修正（コード品質レビューで発覚）：** `deleteCampaign`（論理削除）に対応する復元操作が存在しないと指摘された（Task 6の`deactivateCustomer`/`reactivateCustomer`の対と非対称）。以下を追加する。

- [ ] **Step 6: `republishCampaign`を追加する（失敗するテスト→実装→成功確認→commit）**

`app/actions/manage-campaigns.test.ts`の末尾（`describe("deleteCampaign", ...)`の後）に追加：

```ts

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

importに`republishCampaign`を追加：

```ts
import {
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  republishCampaign,
} from "./manage-campaigns";
```

`app/actions/manage-campaigns.ts`の末尾（`deleteCampaign`の後）に追加：

```ts

// deleteCampaignで無効化したキャンペーンを再度有効化する（deactivateCustomer/reactivateCustomerと対になる操作）。
export async function republishCampaign(campaignId: number): Promise<void> {
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { isPublished: true },
  });
}
```

Run: `npx vitest run app/actions/manage-campaigns.test.ts`
Expected: PASS（6件）

```bash
git add app/actions/manage-campaigns.ts app/actions/manage-campaigns.test.ts
git commit -m "feat: add republishCampaign to restore a soft-deleted campaign

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 13: 顧客管理一覧ページの拡張

**Files:**
- Modify: `app/admin/(dashboard)/customers/page.tsx`

- [ ] **Step 1: ページ全体を書き換える**

`app/admin/(dashboard)/customers/page.tsx` を以下の内容に置き換える：

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Trash2, RotateCcw, ArrowUp, ArrowDown, Plus } from "lucide-react";
import {
  searchCustomers,
  type CustomerListItem,
  type CustomerSortField,
  type SortDirection,
} from "@/app/actions/search-customers";
import {
  createCustomerByAdmin,
  updateCustomerByAdmin,
  deactivateCustomer,
  reactivateCustomer,
} from "@/app/actions/manage-customers";
import { listCustomerStatuses, type CustomerStatusItem } from "@/app/actions/customer-statuses";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { Modal } from "@/components/ui/modal";

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

const SORT_COLUMNS: { field: CustomerSortField; label: string }[] = [
  { field: "id", label: "会員ID" },
  { field: "visitCount", label: "来店回数" },
  { field: "totalSpent", label: "累計金額" },
  { field: "lastVisitDate", label: "最終来店日" },
];

const EMPTY_CREATE_FORM = {
  name: "",
  email: "",
  phone: "",
  gender: "female" as "female" | "male" | "other",
  birthMonth: 1,
  primaryStoreId: null as number | null,
};

export default function AdminCustomersPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [statusIds, setStatusIds] = useState<number[]>([]);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [sortBy, setSortBy] = useState<CustomerSortField>("id");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [statuses, setStatuses] = useState<CustomerStatusItem[]>([]);
  const [stores, setStores] = useState<StoreListItem[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState<CustomerListItem | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    primaryStoreId: null as number | null,
  });
  const [saving, setSaving] = useState(false);

  function reload() {
    searchCustomers({
      name: name || undefined,
      phone: phone || undefined,
      statusIds: statusIds.length > 0 ? statusIds : undefined,
      includeInactive,
      sortBy,
      sortDirection,
    }).then(setCustomers);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, phone, statusIds, includeInactive, sortBy, sortDirection]);

  useEffect(() => {
    listCustomerStatuses().then(setStatuses);
    listStores().then(setStores);
  }, []);

  function toggleStatus(statusId: number) {
    setStatusIds((prev) =>
      prev.includes(statusId) ? prev.filter((id) => id !== statusId) : [...prev, statusId],
    );
  }

  function toggleSort(field: CustomerSortField) {
    if (sortBy === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDirection("desc");
    }
  }

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);
    const result = await createCustomerByAdmin(createForm);
    setCreating(false);
    if (result.status === "email_taken") {
      setCreateError("このメールアドレスは既に登録されています。");
      return;
    }
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateOpen(false);
    reload();
  }

  function startEdit(customer: CustomerListItem) {
    setEditing(customer);
    setEditForm({
      name: customer.name,
      phone: customer.phone,
      primaryStoreId: customer.primaryStoreId,
    });
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setSaving(true);
    await updateCustomerByAdmin({ memberId: editing.id, ...editForm });
    setSaving(false);
    setEditing(null);
    reload();
  }

  async function handleDeactivate(customer: CustomerListItem) {
    if (!window.confirm(`${customer.name}様を無効化しますか？`)) return;
    await deactivateCustomer(customer.id);
    reload();
  }

  async function handleReactivate(customer: CustomerListItem) {
    await reactivateCustomer(customer.id);
    reload();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl text-primary-700">顧客管理</h1>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex h-10 items-center gap-1 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white"
        >
          <Plus size={16} />
          新規登録
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="氏名で検索"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        />
        <input
          type="text"
          placeholder="電話番号で検索"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          無効な顧客も表示
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => toggleStatus(s.id)}
            className="rounded-full px-3 py-1 text-xs text-white transition-opacity"
            style={{
              backgroundColor: s.colorCode,
              opacity: statusIds.length === 0 || statusIds.includes(s.id) ? 1 : 0.35,
            }}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              {SORT_COLUMNS.slice(0, 1).map(({ field, label }) => (
                <th key={field} className="p-3">
                  <button
                    type="button"
                    onClick={() => toggleSort(field)}
                    className="flex items-center gap-1"
                  >
                    {label}
                    {sortBy === field &&
                      (sortDirection === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </button>
                </th>
              ))}
              <th className="p-3">氏名</th>
              <th className="p-3">ステータス</th>
              {SORT_COLUMNS.slice(1).map(({ field, label }) => (
                <th key={field} className="p-3">
                  <button
                    type="button"
                    onClick={() => toggleSort(field)}
                    className="flex items-center gap-1"
                  >
                    {label}
                    {sortBy === field &&
                      (sortDirection === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </button>
                </th>
              ))}
              <th className="p-3">所属店舗</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr
                key={c.id}
                className={`border-b border-neutral-100 last:border-0 ${!c.isActive ? "opacity-50" : ""}`}
              >
                <td className="p-3">
                  <Link href={`/admin/customers/${c.id}`} className="text-primary-700 underline">
                    {c.id}
                  </Link>
                </td>
                <td className="p-3">{c.name}</td>
                <td className="p-3">
                  <span
                    className="rounded-full px-2 py-1 text-xs text-white"
                    style={{ backgroundColor: c.statusColor }}
                  >
                    {c.statusName}
                  </span>
                </td>
                <td className="p-3">{c.visitCount}</td>
                <td className="p-3">{formatYen(c.totalSpent)}</td>
                <td className="p-3">{c.lastVisitDate ?? "—"}</td>
                <td className="p-3">{c.primaryStoreName ?? "—"}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="text-neutral-500 hover:text-primary-600"
                      aria-label="編集"
                    >
                      <Pencil size={16} />
                    </button>
                    {c.isActive ? (
                      <button
                        type="button"
                        onClick={() => handleDeactivate(c)}
                        className="text-neutral-500 hover:text-error"
                        aria-label="削除"
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleReactivate(c)}
                        className="text-neutral-500 hover:text-primary-600"
                        aria-label="復元"
                      >
                        <RotateCcw size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && (
          <p className="p-6 text-center text-sm text-neutral-500">該当する顧客がいません。</p>
        )}
      </div>

      <Modal open={createOpen} onOpenChange={setCreateOpen} title="新規顧客登録">
        <div className="flex flex-col gap-3">
          {createError && (
            <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{createError}</p>
          )}
          <input
            type="text"
            placeholder="氏名"
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <input
            type="email"
            placeholder="メールアドレス"
            value={createForm.email}
            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <input
            type="text"
            placeholder="電話番号"
            value={createForm.phone}
            onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <div className="flex gap-3">
            <select
              value={createForm.gender}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  gender: e.target.value as "female" | "male" | "other",
                })
              }
              className="h-10 rounded-md border border-neutral-300 px-2"
            >
              <option value="female">女性</option>
              <option value="male">男性</option>
              <option value="other">その他</option>
            </select>
            <select
              value={createForm.birthMonth}
              onChange={(e) =>
                setCreateForm({ ...createForm, birthMonth: Number(e.target.value) })
              }
              className="h-10 rounded-md border border-neutral-300 px-2"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {month}月生まれ
                </option>
              ))}
            </select>
          </div>
          <select
            value={createForm.primaryStoreId ?? ""}
            onChange={(e) =>
              setCreateForm({
                ...createForm,
                primaryStoreId: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="h-10 rounded-md border border-neutral-300 px-2"
          >
            <option value="">所属店舗（任意）</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={creating || !createForm.name || !createForm.email || !createForm.phone}
            onClick={handleCreate}
            className="h-12 rounded-lg bg-primary-500 font-medium text-white disabled:opacity-50"
          >
            登録する
          </button>
        </div>
      </Modal>

      <Modal
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="顧客情報を編集"
      >
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="氏名"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <input
            type="text"
            placeholder="電話番号"
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <select
            value={editForm.primaryStoreId ?? ""}
            onChange={(e) =>
              setEditForm({
                ...editForm,
                primaryStoreId: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="h-10 rounded-md border border-neutral-300 px-2"
          >
            <option value="">所属店舗（任意）</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={saving || !editForm.name || !editForm.phone}
            onClick={handleSaveEdit}
            className="h-12 rounded-lg bg-primary-500 font-medium text-white disabled:opacity-50"
          >
            更新する
          </button>
        </div>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: 既存の関連テストが壊れていないことを確認する**

Run: `npx vitest run app/actions/search-customers.test.ts app/actions/manage-customers.test.ts`
Expected: 全件PASS

- [ ] **Step 4: Commit**

```bash
git add "app/admin/(dashboard)/customers/page.tsx"
git commit -m "feat: add create/edit/deactivate, sorting, and status chips to customer list

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 14: ステータス設定ページの拡張

**Files:**
- Modify: `app/admin/(dashboard)/customer-statuses/page.tsx`

- [ ] **Step 1: ページ全体を書き換える**

`app/admin/(dashboard)/customer-statuses/page.tsx` を以下の内容に置き換える：

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  listCustomerStatuses,
  updateStatusCondition,
  type CustomerStatusItem,
} from "@/app/actions/customer-statuses";
import type { StatusConditionMode } from "@prisma/client";

export default function AdminCustomerStatusesPage() {
  const [statuses, setStatuses] = useState<CustomerStatusItem[]>([]);
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    listCustomerStatuses().then(setStatuses);
  }, []);

  // 1フィールドずつ部分更新する。3項目まとめて送ると、他フィールドの保存が
  // 未完了のうちに別フィールドを編集した場合、古い値で上書きしてしまう競合状態が起きる。
  async function handleSave(
    statusId: number,
    patch: Partial<{
      minVisitCount: number;
      minTotalSpent: number;
      conditionMode: StatusConditionMode;
    }>,
  ) {
    setSaving(statusId);
    await updateStatusCondition({ statusId, ...patch });
    setStatuses((prev) => prev.map((s) => (s.id === statusId ? { ...s, ...patch } : s)));
    setSaving(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl text-primary-700">顧客ステータス設定</h1>
      <p className="text-sm text-neutral-500">
        4店舗共通の設定です。来店回数・利用金額は4店舗合算でカウントされます。
      </p>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="p-3">ステータス</th>
              <th className="p-3">最低来店回数</th>
              <th className="p-3">最低利用金額</th>
              <th className="p-3">条件</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {statuses.map((s) => (
              <tr key={s.id} className="border-b border-neutral-100 last:border-0">
                <td className="p-3">
                  <span
                    className="rounded-full px-2 py-1 text-xs text-white"
                    style={{ backgroundColor: s.colorCode }}
                  >
                    {s.name}
                  </span>
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    min={0}
                    defaultValue={s.minVisitCount}
                    onBlur={(e) => handleSave(s.id, { minVisitCount: Number(e.target.value) })}
                    className="h-9 w-24 rounded-md border border-neutral-300 px-2"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    min={0}
                    defaultValue={s.minTotalSpent}
                    onBlur={(e) => handleSave(s.id, { minTotalSpent: Number(e.target.value) })}
                    className="h-9 w-28 rounded-md border border-neutral-300 px-2"
                  />
                </td>
                <td className="p-3">
                  <select
                    defaultValue={s.conditionMode}
                    onChange={(e) =>
                      handleSave(s.id, { conditionMode: e.target.value as StatusConditionMode })
                    }
                    className="h-9 rounded-md border border-neutral-300 px-2"
                  >
                    <option value="or">OR（いずれか）</option>
                    <option value="and">AND（両方）</option>
                  </select>
                </td>
                <td className="p-3 text-xs text-neutral-500">
                  {saving === s.id ? "保存中..." : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
git add "app/admin/(dashboard)/customer-statuses/page.tsx"
git commit -m "feat: add spend threshold and OR/AND condition controls to status settings page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 15: キャンペーン管理ページの再構成

**Files:**
- Modify: `app/admin/(dashboard)/campaigns/page.tsx`

- [ ] **Step 1: ページ全体を書き換える**

`app/admin/(dashboard)/campaigns/page.tsx` を以下の内容に置き換える：

```tsx
"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2, RotateCcw, Plus } from "lucide-react";
import {
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  republishCampaign,
  type CampaignListItem,
} from "@/app/actions/manage-campaigns";
import { listAllCoursesForManagement, type ManagedCourse } from "@/app/actions/manage-courses";
import { listCourseCategories, type CourseCategoryListItem } from "@/app/actions/course-categories";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { Modal } from "@/components/ui/modal";

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

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

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [courses, setCourses] = useState<ManagedCourse[]>([]);
  const [categories, setCategories] = useState<CourseCategoryListItem[]>([]);
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [includeUnpublished, setIncludeUnpublished] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  function reload() {
    listCampaigns({ includeUnpublished }).then(setCampaigns);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeUnpublished]);

  useEffect(() => {
    listAllCoursesForManagement().then(setCourses);
    listCourseCategories().then(setCategories);
    listStores().then(setStores);
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(c: CampaignListItem) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      discountType: c.discountType,
      discountValue: c.discountValue,
      startDate: c.startDate,
      endDate: c.endDate,
      priority: c.priority,
      targetStoreId: c.targetStoreId,
      courseIds: c.courseIds,
      categoryIds: c.categoryIds,
    });
    setModalOpen(true);
  }

  async function handleSubmit() {
    setSubmitting(true);
    if (editingId) {
      await updateCampaign({ campaignId: editingId, ...form });
    } else {
      await createCampaign(form);
    }
    setSubmitting(false);
    setModalOpen(false);
    reload();
  }

  async function handleDelete(c: CampaignListItem) {
    if (!window.confirm(`「${c.name}」を無効化しますか？`)) return;
    await deleteCampaign(c.id);
    reload();
  }

  async function handleRestore(c: CampaignListItem) {
    await republishCampaign(c.id);
    reload();
  }

  function toggleCourse(id: number) {
    setForm((f) => ({
      ...f,
      courseIds: f.courseIds.includes(id)
        ? f.courseIds.filter((c) => c !== id)
        : [...f.courseIds, id],
    }));
  }

  function toggleCategory(id: number) {
    setForm((f) => ({
      ...f,
      categoryIds: f.categoryIds.includes(id)
        ? f.categoryIds.filter((c) => c !== id)
        : [...f.categoryIds, id],
    }));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl text-primary-700">キャンペーン管理</h1>
        <button
          type="button"
          onClick={openCreate}
          className="flex h-10 items-center gap-1 rounded-lg bg-accent-500 px-4 text-sm font-medium text-white"
        >
          <Plus size={16} />
          新規作成
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-600">
        <input
          type="checkbox"
          checked={includeUnpublished}
          onChange={(e) => setIncludeUnpublished(e.target.checked)}
        />
        無効なキャンペーンも表示
      </label>

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
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr
                key={c.id}
                className={`border-b border-neutral-100 last:border-0 ${!c.isPublished ? "opacity-50" : ""}`}
              >
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
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="text-neutral-500 hover:text-primary-600"
                      aria-label="編集"
                    >
                      <Pencil size={16} />
                    </button>
                    {c.isPublished ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(c)}
                        className="text-neutral-500 hover:text-error"
                        aria-label="削除"
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRestore(c)}
                        className="text-neutral-500 hover:text-primary-600"
                        aria-label="復元"
                      >
                        <RotateCcw size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {campaigns.length === 0 && (
          <p className="p-6 text-center text-sm text-neutral-500">キャンペーンがありません。</p>
        )}
      </div>

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingId ? "キャンペーンを編集" : "新規キャンペーン作成"}
      >
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="キャンペーン名"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
          />

          <div className="flex gap-3">
            <select
              value={form.discountType}
              onChange={(e) =>
                setForm({ ...form, discountType: e.target.value as "percentage" | "fixed_amount" })
              }
              className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
            >
              <option value="percentage">定率（%）</option>
              <option value="fixed_amount">定額（円）</option>
            </select>
            <input
              type="number"
              min={0}
              value={form.discountValue}
              onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
              className="h-10 w-32 rounded-md border border-neutral-300 px-3 text-sm"
            />
          </div>

          <div className="flex gap-3">
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
            />
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm text-neutral-600">優先度</label>
            <input
              type="number"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
              className="h-10 w-24 rounded-md border border-neutral-300 px-3 text-sm"
            />
          </div>

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

          <button
            type="button"
            disabled={submitting || !form.name || !form.startDate || !form.endDate}
            onClick={handleSubmit}
            className="h-12 rounded-lg bg-accent-500 font-medium text-white disabled:opacity-50"
          >
            {editingId ? "更新する" : "キャンペーンを作成する"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: 既存の関連テストが壊れていないことを確認する**

Run: `npx vitest run app/actions/manage-campaigns.test.ts`
Expected: 全件PASS

- [ ] **Step 4: Commit**

```bash
git add "app/admin/(dashboard)/campaigns/page.tsx"
git commit -m "feat: restructure campaign management as list-first with modal create/edit

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 16: メニュー・料金管理ページに新規登録モーダルを追加

**Files:**
- Modify: `app/admin/(dashboard)/menu/page.tsx`

- [ ] **Step 1: ページ全体を書き換える**

`app/admin/(dashboard)/menu/page.tsx` を以下の内容に置き換える：

```tsx
"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import {
  listAllCoursesForManagement,
  updateCoursePrice,
  createCourse,
  type ManagedCourse,
} from "@/app/actions/manage-courses";
import { listCourseCategories, type CourseCategoryListItem } from "@/app/actions/course-categories";
import type { GenderRestriction } from "@/lib/reservation/gender-restriction";
import { Modal } from "@/components/ui/modal";

const EMPTY_FORM = {
  categoryId: null as number | null,
  name: "",
  durationEstimateMin: 60,
  treatmentTimeMin: 50,
  price: 0,
  genderRestriction: "none" as GenderRestriction,
  sortOrder: 0,
};

export default function AdminMenuPage() {
  const [courses, setCourses] = useState<ManagedCourse[]>([]);
  const [categories, setCategories] = useState<CourseCategoryListItem[]>([]);
  const [saving, setSaving] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  function reload() {
    listAllCoursesForManagement().then(setCourses);
  }

  useEffect(() => {
    reload();
    listCourseCategories().then(setCategories);
  }, []);

  async function handleSave(courseId: number, price: number) {
    setSaving(courseId);
    await updateCoursePrice({ courseId, price });
    setSaving(null);
  }

  async function handleCreate() {
    if (!form.categoryId) return;
    setCreating(true);
    // 未設定のままだと新規コースが常にsortOrder:0となり、既存コースより前に
    // 表示されてしまうため、同カテゴリ内の最大sortOrder+1を計算して渡す。
    const coursesInCategory = courses.filter((c) => c.categoryId === form.categoryId);
    const nextSortOrder =
      coursesInCategory.length > 0
        ? Math.max(...coursesInCategory.map((c) => c.sortOrder)) + 1
        : 0;
    await createCourse({ ...form, categoryId: form.categoryId, sortOrder: nextSortOrder });
    setCreating(false);
    setForm(EMPTY_FORM);
    setModalOpen(false);
    reload();
  }

  const grouped = courses.reduce<Record<string, ManagedCourse[]>>((acc, c) => {
    acc[c.categoryName] = acc[c.categoryName] ?? [];
    acc[c.categoryName].push(c);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl text-primary-700">メニュー・料金管理</h1>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex h-10 items-center gap-1 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white"
        >
          <Plus size={16} />
          新規登録
        </button>
      </div>

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

      <Modal open={modalOpen} onOpenChange={setModalOpen} title="新規コース登録">
        <div className="flex flex-col gap-3">
          <select
            value={form.categoryId ?? ""}
            onChange={(e) =>
              setForm({ ...form, categoryId: e.target.value ? Number(e.target.value) : null })
            }
            className="h-10 rounded-md border border-neutral-300 px-2"
          >
            <option value="">カテゴリを選択</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="コース名"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <div className="flex gap-3">
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              所要時間（分）
              <input
                type="number"
                min={0}
                value={form.durationEstimateMin}
                onChange={(e) =>
                  setForm({ ...form, durationEstimateMin: Number(e.target.value) })
                }
                className="h-10 w-28 rounded-md border border-neutral-300 px-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              施術時間（分）
              <input
                type="number"
                min={0}
                value={form.treatmentTimeMin}
                onChange={(e) => setForm({ ...form, treatmentTimeMin: Number(e.target.value) })}
                className="h-10 w-28 rounded-md border border-neutral-300 px-2"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            料金（税込）
            <input
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              className="h-10 w-32 rounded-md border border-neutral-300 px-2"
            />
          </label>
          <select
            value={form.genderRestriction}
            onChange={(e) =>
              setForm({ ...form, genderRestriction: e.target.value as GenderRestriction })
            }
            className="h-10 rounded-md border border-neutral-300 px-2"
          >
            <option value="none">性別制限なし</option>
            <option value="female">女性限定</option>
            <option value="male">男性限定</option>
          </select>
          <button
            type="button"
            disabled={creating || !form.categoryId || !form.name}
            onClick={handleCreate}
            className="h-12 rounded-lg bg-primary-500 font-medium text-white disabled:opacity-50"
          >
            登録する
          </button>
        </div>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
git add "app/admin/(dashboard)/menu/page.tsx"
git commit -m "feat: add new-course modal to menu management page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

**⚠️ 実装後の追加修正（コード品質レビューで発覚）：** `EMPTY_FORM.sortOrder`が常に`0`のまま送信されるため、新規コースが同カテゴリ内の既存コースより前に表示されてしまう不具合がある。以下2点を追加で修正する。

1. `app/actions/manage-courses.ts`の`ManagedCourse`インターフェースに`sortOrder: number;`を追加し、`listAllCoursesForManagement`のマッピングに`sortOrder: c.sortOrder,`を追加する（Prismaクエリ自体は既に`course.sortOrder`を取得済みなので、DTOへの露出のみ）。対応するテストのモック・期待値にも`sortOrder`を追加する。

2. `app/admin/(dashboard)/menu/page.tsx`の`handleCreate`を以下に置き換える：

```tsx
  async function handleCreate() {
    if (!form.categoryId) return;
    setCreating(true);
    // 未設定のままだと新規コースが常にsortOrder:0となり、既存コースより前に
    // 表示されてしまうため、同カテゴリ内の最大sortOrder+1を計算して渡す。
    const coursesInCategory = courses.filter((c) => c.categoryId === form.categoryId);
    const nextSortOrder =
      coursesInCategory.length > 0
        ? Math.max(...coursesInCategory.map((c) => c.sortOrder)) + 1
        : 0;
    await createCourse({ ...form, categoryId: form.categoryId, sortOrder: nextSortOrder });
    setCreating(false);
    setForm(EMPTY_FORM);
    setModalOpen(false);
    reload();
  }
```

Commit（1と2はそれぞれ別コミットでよい）:

```bash
git add app/actions/manage-courses.ts app/actions/manage-courses.test.ts
git commit -m "feat: expose sortOrder on ManagedCourse

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"

git add "app/admin/(dashboard)/menu/page.tsx"
git commit -m "fix: compute correct sortOrder for newly created courses (Task 16)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 17: スタッフ管理ページに新規登録モーダルを追加

**Files:**
- Modify: `app/admin/(dashboard)/staff/page.tsx`

- [ ] **Step 1: ページ全体を書き換える**

`app/admin/(dashboard)/staff/page.tsx` を以下の内容に置き換える：

```tsx
"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { listAllStaff, updateStaff, createStaff, type ManagedStaff } from "@/app/actions/manage-staff";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { Modal } from "@/components/ui/modal";

const EMPTY_FORM = { storeId: null as number | null, name: "", bio: "", nominationFee: 0 };

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<ManagedStaff[]>([]);
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [saving, setSaving] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  function reload() {
    listAllStaff().then(setStaff);
  }

  useEffect(() => {
    reload();
    listStores().then(setStores);
  }, []);

  async function handleFeeBlur(member: ManagedStaff, nominationFee: number) {
    setSaving(member.id);
    await updateStaff({ staffId: member.id, nominationFee, isActive: member.isActive });
    setStaff((prev) => prev.map((s) => (s.id === member.id ? { ...s, nominationFee } : s)));
    setSaving(null);
  }

  async function handleToggleActive(member: ManagedStaff) {
    const isActive = !member.isActive;
    setSaving(member.id);
    await updateStaff({ staffId: member.id, nominationFee: member.nominationFee, isActive });
    setStaff((prev) => prev.map((s) => (s.id === member.id ? { ...s, isActive } : s)));
    setSaving(null);
  }

  async function handleCreate() {
    if (!form.storeId) return;
    setCreating(true);
    await createStaff({ ...form, storeId: form.storeId, bio: form.bio || null });
    setCreating(false);
    setForm(EMPTY_FORM);
    setModalOpen(false);
    reload();
  }

  const grouped = staff.reduce<Record<string, ManagedStaff[]>>((acc, s) => {
    acc[s.storeName] = acc[s.storeName] ?? [];
    acc[s.storeName].push(s);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl text-primary-700">スタッフ管理</h1>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex h-10 items-center gap-1 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white"
        >
          <Plus size={16} />
          新規登録
        </button>
      </div>

      {Object.entries(grouped).map(([storeName, members]) => (
        <div key={storeName} className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-neutral-600">{storeName}</h2>
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500">
                  <th className="p-3">氏名</th>
                  <th className="p-3">紹介文</th>
                  <th className="p-3">指名料金</th>
                  <th className="p-3">在籍</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {members.map((s) => (
                  <tr key={s.id} className="border-b border-neutral-100 last:border-0">
                    <td className="p-3">{s.name}</td>
                    <td className="p-3 text-neutral-500">{s.bio ?? "—"}</td>
                    <td className="p-3">
                      <input
                        type="number"
                        min={0}
                        defaultValue={s.nominationFee}
                        onBlur={(e) => handleFeeBlur(s, Number(e.target.value))}
                        className="h-9 w-24 rounded-md border border-neutral-300 px-2"
                      />
                    </td>
                    <td className="p-3">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={s.isActive}
                          onChange={() => handleToggleActive(s)}
                        />
                        {s.isActive ? "在籍中" : "退職"}
                      </label>
                    </td>
                    <td className="p-3 text-xs text-neutral-500">
                      {saving === s.id ? "保存中..." : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <Modal open={modalOpen} onOpenChange={setModalOpen} title="新規スタッフ登録">
        <div className="flex flex-col gap-3">
          <select
            value={form.storeId ?? ""}
            onChange={(e) =>
              setForm({ ...form, storeId: e.target.value ? Number(e.target.value) : null })
            }
            className="h-10 rounded-md border border-neutral-300 px-2"
          >
            <option value="">所属店舗を選択</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="氏名"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <textarea
            placeholder="紹介文（任意）"
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            rows={3}
            className="rounded-md border border-neutral-300 px-2 py-2"
          />
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            指名料金
            <input
              type="number"
              min={0}
              value={form.nominationFee}
              onChange={(e) => setForm({ ...form, nominationFee: Number(e.target.value) })}
              className="h-10 w-32 rounded-md border border-neutral-300 px-2"
            />
          </label>
          <button
            type="button"
            disabled={creating || !form.storeId || !form.name}
            onClick={handleCreate}
            className="h-12 rounded-lg bg-primary-500 font-medium text-white disabled:opacity-50"
          >
            登録する
          </button>
        </div>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
git add "app/admin/(dashboard)/staff/page.tsx"
git commit -m "feat: add new-staff modal to staff management page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 18: 店舗管理ページに新規登録モーダルを追加

**Files:**
- Modify: `app/admin/(dashboard)/stores/page.tsx`

- [ ] **Step 1: ページ全体を書き換える**

`app/admin/(dashboard)/stores/page.tsx` を以下の内容に置き換える：

```tsx
"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import {
  listAllStoresForManagement,
  updateStoreDetails,
  createStore,
  type ManagedStore,
} from "@/app/actions/manage-stores";
import { Modal } from "@/components/ui/modal";

const EMPTY_FORM = {
  name: "",
  address: "",
  phone: "",
  nearestStation: "",
  weekdayOpen: "11:00",
  weekdayClose: "20:00",
  weekendOpen: "10:00",
  weekendClose: "18:00",
  luxuryLastOrderWeekday: "19:30",
  luxuryLastOrderWeekend: "17:30",
};

export default function AdminStoresPage() {
  const [stores, setStores] = useState<ManagedStore[]>([]);
  const [saving, setSaving] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  function reload() {
    listAllStoresForManagement().then(setStores);
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleSave(storeId: number, address: string, phone: string) {
    setSaving(storeId);
    await updateStoreDetails({ storeId, address, phone });
    setSaving(null);
  }

  async function handleCreate() {
    setCreating(true);
    await createStore({
      ...form,
      address: form.address || null,
      nearestStation: form.nearestStation || null,
    });
    setCreating(false);
    setForm(EMPTY_FORM);
    setModalOpen(false);
    reload();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl text-primary-700">店舗管理</h1>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex h-10 items-center gap-1 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white"
        >
          <Plus size={16} />
          新規登録
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {stores.map((s) => (
          <div
            key={s.id}
            className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-sm"
          >
            <p className="font-medium text-neutral-800">{s.name}</p>
            {s.nearestStation && (
              <p className="text-xs text-neutral-500">{s.nearestStation}</p>
            )}
            <label className="text-sm text-neutral-600">住所</label>
            <input
              type="text"
              defaultValue={s.address ?? ""}
              onBlur={(e) => handleSave(s.id, e.target.value, s.phone)}
              className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
            />
            <label className="text-sm text-neutral-600">電話番号</label>
            <input
              type="text"
              defaultValue={s.phone}
              onBlur={(e) => handleSave(s.id, s.address ?? "", e.target.value)}
              className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
            />
            {saving === s.id && <p className="text-xs text-neutral-500">保存中...</p>}
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onOpenChange={setModalOpen} title="新規店舗登録">
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="店舗名"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <input
            type="text"
            placeholder="住所"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <input
            type="text"
            placeholder="電話番号"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <input
            type="text"
            placeholder="最寄駅（任意）"
            value={form.nearestStation}
            onChange={(e) => setForm({ ...form, nearestStation: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              平日 開店
              <input
                type="time"
                value={form.weekdayOpen}
                onChange={(e) => setForm({ ...form, weekdayOpen: e.target.value })}
                className="h-10 rounded-md border border-neutral-300 px-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              平日 閉店
              <input
                type="time"
                value={form.weekdayClose}
                onChange={(e) => setForm({ ...form, weekdayClose: e.target.value })}
                className="h-10 rounded-md border border-neutral-300 px-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              週末 開店
              <input
                type="time"
                value={form.weekendOpen}
                onChange={(e) => setForm({ ...form, weekendOpen: e.target.value })}
                className="h-10 rounded-md border border-neutral-300 px-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              週末 閉店
              <input
                type="time"
                value={form.weekendClose}
                onChange={(e) => setForm({ ...form, weekendClose: e.target.value })}
                className="h-10 rounded-md border border-neutral-300 px-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              ラグジュアリー最終受付（平日）
              <input
                type="time"
                value={form.luxuryLastOrderWeekday}
                onChange={(e) => setForm({ ...form, luxuryLastOrderWeekday: e.target.value })}
                className="h-10 rounded-md border border-neutral-300 px-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              ラグジュアリー最終受付（週末）
              <input
                type="time"
                value={form.luxuryLastOrderWeekend}
                onChange={(e) => setForm({ ...form, luxuryLastOrderWeekend: e.target.value })}
                className="h-10 rounded-md border border-neutral-300 px-2"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={
              creating ||
              !form.name ||
              !form.phone ||
              !form.weekdayOpen ||
              !form.weekdayClose ||
              !form.weekendOpen ||
              !form.weekendClose ||
              !form.luxuryLastOrderWeekday ||
              !form.luxuryLastOrderWeekend
            }
            onClick={handleCreate}
            className="h-12 rounded-lg bg-primary-500 font-medium text-white disabled:opacity-50"
          >
            登録する
          </button>
        </div>
      </Modal>
    </div>
  );
}
```

**⚠️ この`disabled`条件は必須。** `<input type="time">`はユーザーが空欄に消せてしまうため、営業時間6項目も`disabled`チェックに含めないと、空文字が`toTimeDate`に渡ってInvalid Dateとなり、Prisma書き込み時に例外が発生。`handleCreate`にtry/catchがないため、`setCreating(true)`のまま`creating`が戻らずボタンが恒久的に無効化されたままになる（コード品質レビューで発覚）。

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
git add "app/admin/(dashboard)/stores/page.tsx"
git commit -m "feat: add new-store modal to store management page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

（実際の実装では、上記コミットの直後にコード品質レビューで営業時間6項目の`disabled`チェック漏れが発覚し、以下のフォローアップコミットを追加した）

```bash
git add "app/admin/(dashboard)/stores/page.tsx"
git commit -m "fix: require all store hours fields before allowing store creation (Task 18)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 19: メール／LINE配信管理ページの再構成

**Files:**
- Modify: `app/admin/(dashboard)/segment-campaigns/page.tsx`

- [ ] **Step 1: ページ全体を書き換える**

`app/admin/(dashboard)/segment-campaigns/page.tsx` を以下の内容に置き換える：

```tsx
"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import {
  previewSegmentAudience,
  type SegmentChannelMode,
  type AudiencePreview,
} from "@/app/actions/segment-audience";
import {
  createSegmentCampaign,
  listSegmentCampaigns,
  type SegmentCampaignListItem,
} from "@/app/actions/segment-campaigns";
import { listTemplates, type TemplateListItem } from "@/app/actions/manage-templates";
import { listCustomerStatuses, type CustomerStatusItem } from "@/app/actions/customer-statuses";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { Modal } from "@/components/ui/modal";

const CHANNEL_LABEL: Record<SegmentChannelMode, string> = {
  email: "メール",
  line: "LINE",
  auto: "両方（自動振り分け）",
};

export default function SegmentCampaignsPage() {
  const [statuses, setStatuses] = useState<CustomerStatusItem[]>([]);
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [history, setHistory] = useState<SegmentCampaignListItem[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [statusId, setStatusId] = useState<number | null>(null);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [channelMode, setChannelMode] = useState<SegmentChannelMode>("auto");
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  function refreshHistory() {
    listSegmentCampaigns().then(setHistory);
  }

  useEffect(() => {
    listCustomerStatuses().then(setStatuses);
    listStores().then(setStores);
    listTemplates().then((all) => setTemplates(all.filter((t) => t.type === "segment")));
    refreshHistory();
  }, []);

  async function handlePreview() {
    setPreviewing(true);
    const result = await previewSegmentAudience(
      { name: name || undefined, statusId: statusId ?? undefined, storeId: storeId ?? undefined },
      channelMode,
    );
    setPreview(result);
    setPreviewing(false);
  }

  async function handleSend() {
    if (!templateId) return;
    setSending(true);
    setResultMessage(null);
    const result = await createSegmentCampaign({
      name: campaignName,
      condition: {
        name: name || undefined,
        statusId: statusId ?? undefined,
        storeId: storeId ?? undefined,
      },
      channelMode,
      templateId,
      scheduledAt: scheduledAt || null,
    });
    setSending(false);

    if (result.status === "unauthorized") {
      setResultMessage("権限がありません。");
    } else if (result.status === "scheduled") {
      setResultMessage(`${result.targetCount}名への配信を予約しました。`);
      setModalOpen(false);
    } else {
      setResultMessage(
        `配信完了：成功${result.sentCount}件／失敗${result.failedCount}件（対象${result.targetCount}件）`,
      );
      setModalOpen(false);
    }
    refreshHistory();
  }

  function openModal() {
    setName("");
    setStatusId(null);
    setStoreId(null);
    setChannelMode("auto");
    setTemplateId(null);
    setCampaignName("");
    setScheduledAt("");
    setPreview(null);
    setResultMessage(null);
    setModalOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl text-primary-700">メール／LINE配信管理</h1>
        <button
          type="button"
          onClick={openModal}
          className="flex h-10 items-center gap-1 rounded-lg bg-accent-500 px-4 text-sm font-medium text-white"
        >
          <Plus size={16} />
          配信設定
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-neutral-600">配信履歴</h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="p-3">配信名</th>
                <th className="p-3">チャネル</th>
                <th className="p-3">テンプレート</th>
                <th className="p-3">対象人数</th>
                <th className="p-3">予約日時</th>
                <th className="p-3">送信日時</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-b border-neutral-100 last:border-0">
                  <td className="p-3">{h.name}</td>
                  <td className="p-3">{CHANNEL_LABEL[h.channelMode]}</td>
                  <td className="p-3">{h.templateName}</td>
                  <td className="p-3">{h.targetCount}名</td>
                  <td className="p-3">{h.scheduledAt ?? "—"}</td>
                  <td className="p-3">{h.sentAt ?? "未送信"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {history.length === 0 && (
            <p className="p-6 text-center text-sm text-neutral-500">配信履歴がありません。</p>
          )}
        </div>
      </div>

      <Modal open={modalOpen} onOpenChange={setModalOpen} title="配信設定">
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-medium text-neutral-600">配信対象の条件</h3>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="氏名で絞り込み"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 rounded-md border border-neutral-300 px-2"
            />
            <select
              value={statusId ?? ""}
              onChange={(e) => setStatusId(e.target.value ? Number(e.target.value) : null)}
              className="h-10 rounded-md border border-neutral-300 px-2"
            >
              <option value="">すべてのステータス</option>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={storeId ?? ""}
              onChange={(e) => setStoreId(e.target.value ? Number(e.target.value) : null)}
              className="h-10 rounded-md border border-neutral-300 px-2"
            >
              <option value="">全店舗</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <h3 className="text-sm font-medium text-neutral-600">配信チャネル</h3>
          <select
            value={channelMode}
            onChange={(e) => setChannelMode(e.target.value as SegmentChannelMode)}
            className="h-10 w-60 rounded-md border border-neutral-300 px-2"
          >
            <option value="auto">両方（自動振り分け）</option>
            <option value="email">メール</option>
            <option value="line">LINE</option>
          </select>

          <button
            type="button"
            onClick={handlePreview}
            disabled={previewing}
            className="h-10 w-40 rounded-lg border border-primary-500 text-primary-600 disabled:opacity-50"
          >
            対象人数を確認
          </button>
          {preview && (
            <p className="text-sm text-neutral-700">
              {preview.totalCount}名に配信されます（うちLINE {preview.lineCount}名／メール{" "}
              {preview.emailCount}名）
            </p>
          )}

          <h3 className="text-sm font-medium text-neutral-600">配信内容</h3>
          <select
            value={templateId ?? ""}
            onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : null)}
            className="h-10 rounded-md border border-neutral-300 px-2"
          >
            <option value="">テンプレートを選択</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <a href="/admin/templates" className="text-sm text-primary-600 underline">
            ＋新しいテンプレートを作成する
          </a>
          <input
            type="text"
            placeholder="配信名（管理用）"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">配信日時（空欄の場合は即時配信）</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="h-10 w-64 rounded-md border border-neutral-300 px-2"
            />
          </div>

          {resultMessage && <p className="text-sm text-neutral-700">{resultMessage}</p>}

          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !templateId || !campaignName}
            className="h-12 rounded-lg bg-accent-500 px-4 font-medium text-white disabled:opacity-50"
          >
            {scheduledAt ? "配信を予約する" : "今すぐ配信する"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
git add "app/admin/(dashboard)/segment-campaigns/page.tsx"
git commit -m "feat: restructure segment delivery page as history-first with modal settings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 20: 配信テンプレート管理ページの再構成

**Files:**
- Modify: `app/admin/(dashboard)/templates/page.tsx`

- [ ] **Step 1: ページ全体を書き換える**

`app/admin/(dashboard)/templates/page.tsx` を以下の内容に置き換える：

```tsx
"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil } from "lucide-react";
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  type TemplateListItem,
  type DeliveryTemplateType,
} from "@/app/actions/manage-templates";
import { Modal } from "@/components/ui/modal";

const TYPE_LABEL: Record<DeliveryTemplateType, string> = {
  birthday: "誕生月メール",
  reminder: "前日リマインド",
  segment: "セグメント配信",
};

const EMPTY_FORM = { type: "segment" as DeliveryTemplateType, name: "", subject: "", bodyText: "" };

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function refresh() {
    listTemplates().then(setTemplates);
  }

  useEffect(() => {
    refresh();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(t: TemplateListItem) {
    setEditingId(t.id);
    setForm({ type: t.type, name: t.name, subject: t.subject ?? "", bodyText: t.bodyText });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    if (editingId) {
      await updateTemplate({
        templateId: editingId,
        name: form.name,
        subject: form.subject || null,
        bodyText: form.bodyText,
      });
    } else {
      await createTemplate({
        type: form.type,
        name: form.name,
        subject: form.subject || null,
        bodyText: form.bodyText,
      });
    }
    setSaving(false);
    setModalOpen(false);
    refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl text-primary-700">配信テンプレート管理</h1>
        <button
          type="button"
          onClick={openCreate}
          className="flex h-10 items-center gap-1 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white"
        >
          <Plus size={16} />
          新規テンプレート作成
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="p-3">種別</th>
              <th className="p-3">名称</th>
              <th className="p-3">件名</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} className="border-b border-neutral-100 last:border-0">
                <td className="p-3">{TYPE_LABEL[t.type]}</td>
                <td className="p-3">{t.name}</td>
                <td className="p-3 text-neutral-500">{t.subject ?? "—"}</td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => openEdit(t)}
                    className="text-neutral-500 hover:text-primary-600"
                    aria-label="編集"
                  >
                    <Pencil size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {templates.length === 0 && (
          <p className="p-6 text-center text-sm text-neutral-500">テンプレートがありません。</p>
        )}
      </div>

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingId ? "テンプレートを編集" : "新規テンプレートを作成"}
      >
        <div className="flex flex-col gap-3">
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as DeliveryTemplateType })}
            disabled={editingId !== null}
            className="h-10 rounded-md border border-neutral-300 px-2"
          >
            <option value="segment">セグメント配信</option>
            <option value="birthday">誕生月メール</option>
            <option value="reminder">前日リマインド</option>
          </select>
          <input
            type="text"
            placeholder="テンプレート名"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <input
            type="text"
            placeholder="件名（メール用。LINEのみの場合は空欄可）"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <textarea
            placeholder="本文（差し込みタグ：{{氏名}} が利用できます）"
            value={form.bodyText}
            onChange={(e) => setForm({ ...form, bodyText: e.target.value })}
            rows={5}
            className="rounded-md border border-neutral-300 px-2 py-2"
          />
          <button
            type="button"
            disabled={saving || !form.name || !form.bodyText}
            onClick={handleSave}
            className="h-10 rounded-lg bg-primary-500 px-4 font-medium text-white disabled:opacity-50"
          >
            {editingId ? "更新する" : "作成する"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
git add "app/admin/(dashboard)/templates/page.tsx"
git commit -m "feat: restructure template management as list-first with modal create/edit

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 21: 最終検証

**Files:** なし（検証のみ）

- [ ] **Step 1: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 2: Lint**

Run: `npx eslint .`
Expected: エラーなし（`react-hooks/exhaustive-deps`は各ページの`// eslint-disable-next-line`で明示的に許容済み）

- [ ] **Step 3: 全テスト実行**

Run: `npx vitest run`
Expected: 既存テストを含め全件PASS

- [ ] **Step 4: 最終確認事項をユーザーに伝える**

以下をユーザーに報告する：
1. `npx prisma migrate dev --name add_member_active_and_status_condition` をユーザー自身の環境で実行し、データベースにスキーマ変更を反映してもらう必要がある
2. マイグレーション後、開発サーバーを完全に再起動する必要がある
3. Googleログインは今回のスコープ外（保留）
4. `git push` はユーザー自身に任せる

---

## 完了条件

- Task 1〜20のコミットがすべて完了している
- `npx tsc --noEmit` / `npx eslint .` / `npx vitest run` がすべてエラーなしで通る
- ユーザーが `prisma migrate dev` を実行し、実機で全画面の動作確認を行う
