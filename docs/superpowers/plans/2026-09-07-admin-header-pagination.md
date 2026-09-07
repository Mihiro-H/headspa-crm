# 管理画面：ヘッダー統合・ページネーション（Phase A） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理画面のページ名表示をヘッダーに一元化し、顧客・キャンペーン・配信履歴・テンプレート管理の4一覧に20件ページネーションと固定ヘッダー付きスクロールを導入する。

**Architecture:** 既存のNext.js App Router + Server Actions + Prisma構成を踃襲。`usePathname()`を使うクライアントコンポーネント`AdminHeader`を新設し、サーバーアクション4本に`page`引数とページング済み結果`{ items, totalCount }`を追加する。UI側は共通`Pagination`コンポーネントとテーブルラッパーのスクロール指定で対応する。

**Tech Stack:** Next.js (App Router) / TypeScript / Prisma (PostgreSQL) / Tailwind CSS v4 / lucide-react / Vitest

**関連ドキュメント:** `docs/superpowers/specs/2026-09-07-admin-header-pagination-design.md`

**スコープ外（今回）:** サイドバーロゴの拡大（別途対応済み・別コミット）。B〜Iの他8サブプロジェクトは別サイクルで扱う。

---

## 進め方の注意

- TDD対象タスク（4〜7）は失敗するテスト→実装→成功確認→commitの順で進める。
- UIページ・プレゼンテーション専用コンポーネント（`pagination.tsx`、`admin-header.tsx`）は既存踏襲でユニットテスト対象外とする。
- 各タスクの最後で`git commit`する。`git push`はユーザーに任せる。

---

### Task 1: `components/ui/pagination.tsx`（新規）

**Files:**
- Create: `components/ui/pagination.tsx`

- [ ] **Step 1: 作成する**

```tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  return (
    <div className="flex items-center justify-center gap-3 text-sm text-neutral-600">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="flex h-9 items-center gap-1 rounded-md border border-neutral-300 px-3 disabled:opacity-40"
      >
        <ChevronLeft size={16} />
        前へ
      </button>
      <span>
        {page} / {Math.max(totalPages, 1)} ページ
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="flex h-9 items-center gap-1 rounded-md border border-neutral-300 px-3 disabled:opacity-40"
      >
        次へ
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
```

（プレゼンテーション専用コンポーネントのため、`components/ui/button.tsx`・`components/ui/modal.tsx`と同様にユニットテストは書かない。）

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
git add components/ui/pagination.tsx
git commit -m "feat: add reusable Pagination component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 2: ヘッダーへのページ名集約（`components/admin/admin-header.tsx`新設 + `layout.tsx`更新）

**Files:**
- Create: `components/admin/admin-header.tsx`
- Modify: `app/admin/(dashboard)/layout.tsx`

- [ ] **Step 1: `components/admin/admin-header.tsx`を作成する**

```tsx
"use client";

import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/admin/notification-bell";

const PAGE_TITLES: Record<string, string> = {
  "/admin/dashboard": "ダッシュボード",
  "/admin/calendar": "予約カレンダー",
  "/admin/customers": "顧客管理",
  "/admin/customer-statuses": "ステータス設定",
  "/admin/reservations/new": "電話予約登録",
  "/admin/menu": "メニュー・料金管理",
  "/admin/campaigns": "キャンペーン管理",
  "/admin/staff": "スタッフ管理",
  "/admin/stores": "店舗管理",
  "/admin/reports": "売上・月報レポート",
  "/admin/segment-campaigns": "メール／LINE配信管理",
  "/admin/auto-delivery": "自動配信設定",
  "/admin/templates": "配信テンプレート管理",
  "/admin/cron-logs": "Cronジョブ実行ログ",
};

function resolvePageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) {
    return PAGE_TITLES[pathname];
  }
  if (pathname.startsWith("/admin/customers/")) {
    return "顧客詳細";
  }
  if (pathname.startsWith("/admin/reservations/")) {
    return "予約詳細";
  }
  return "";
}

export function AdminHeader() {
  const pathname = usePathname();
  const title = resolvePageTitle(pathname);

  return (
    <header className="flex items-center justify-between border-b border-neutral-200 bg-neutral-0 px-6 py-3">
      <h1 className="font-heading text-lg text-primary-700">{title}</h1>
      <NotificationBell />
    </header>
  );
}
```

- [ ] **Step 2: `app/admin/(dashboard)/layout.tsx`を更新する**

現在のファイルから`import { NotificationBell } from "@/components/admin/notification-bell";`の行を削除し、代わりに`import { AdminHeader } from "@/components/admin/admin-header";`を追加する。

以下の`<header>`ブロック：

```tsx
        <header className="flex items-center justify-end border-b border-neutral-200 bg-neutral-0 px-6 py-3">
          <NotificationBell />
        </header>
```

を以下に置き換える：

```tsx
        <AdminHeader />
```

（それ以外の`layout.tsx`の内容——サイドバー・ロゴ・ナビゲーション部分——は一切変更しない。）

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: Commit**

```bash
git add components/admin/admin-header.tsx "app/admin/(dashboard)/layout.tsx"
git commit -m "feat: consolidate page titles into a shared admin header

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 3: 12ページの本文見出し（`<h1>`）を削除する

**Files（12ファイルすべてを1タスクでまとめて修正）:**
- Modify: `app/admin/(dashboard)/cron-logs/page.tsx`
- Modify: `app/admin/(dashboard)/customer-statuses/page.tsx`
- Modify: `app/admin/(dashboard)/reservations/new/page.tsx`
- Modify: `app/admin/(dashboard)/auto-delivery/page.tsx`
- Modify: `app/admin/(dashboard)/reports/page.tsx`
- Modify: `app/admin/(dashboard)/customers/[id]/page.tsx`
- Modify: `app/admin/(dashboard)/calendar/page.tsx`
- Modify: `app/admin/(dashboard)/reservations/[id]/page.tsx`
- Modify: `app/admin/(dashboard)/stores/page.tsx`
- Modify: `app/admin/(dashboard)/dashboard/page.tsx`
- Modify: `app/admin/(dashboard)/menu/page.tsx`
- Modify: `app/admin/(dashboard)/staff/page.tsx`

（`customers/page.tsx`・`campaigns/page.tsx`・`segment-campaigns/page.tsx`・`templates/page.tsx`の4つはTask 8〜11で全文書き換えの一部として`<h1>`を削除するため、このTaskでは対象外。）

- [ ] **Step 1: 単独の`<h1>`をそのまま削除する（5ファイル）**

`app/admin/(dashboard)/cron-logs/page.tsx` の以下の2行：
```tsx
      <h1 className="font-heading text-2xl text-primary-700">Cronジョブ実行ログ</h1>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
```
を以下に置き換える（h1行を削除するだけ）：
```tsx
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
```

`app/admin/(dashboard)/customer-statuses/page.tsx` の以下の2行：
```tsx
      <h1 className="font-heading text-2xl text-primary-700">顧客ステータス設定</h1>
      <p className="text-sm text-neutral-500">
```
を以下に置き換える：
```tsx
      <p className="text-sm text-neutral-500">
```

`app/admin/(dashboard)/reservations/new/page.tsx` の以下のブロック（h1・空行・次のdiv）：
```tsx
      <h1 className="font-heading text-2xl text-primary-700">電話予約の新規登録</h1>

      <div className="flex flex-col gap-2">
```
を以下に置き換える：
```tsx
      <div className="flex flex-col gap-2">
```

`app/admin/(dashboard)/auto-delivery/page.tsx` の以下の2行：
```tsx
      <h1 className="font-heading text-2xl text-primary-700">自動配信設定</h1>
      <p className="text-sm text-neutral-500">
```
を以下に置き換える：
```tsx
      <p className="text-sm text-neutral-500">
```

`app/admin/(dashboard)/reports/page.tsx` の以下のブロック（h1・空行・次のdiv）：
```tsx
      <h1 className="font-heading text-2xl text-primary-700">売上・月報レポート</h1>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-neutral-0 p-4">
```
を以下に置き換える：
```tsx
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-neutral-0 p-4">
```

- [ ] **Step 2: 兄弟要素が残るケースの`<h1>`を削除する（3ファイル）**

`app/admin/(dashboard)/customers/[id]/page.tsx` の以下のブロック：
```tsx
      <div className="flex items-center gap-3">
        <h1 className="font-heading text-2xl text-primary-700">{customer.name}</h1>
        <span
```
を以下に置き換える（外側の`<div>`と`<span>`はそのまま維持し、`<h1>`行だけ削除）：
```tsx
      <div className="flex items-center gap-3">
        <span
```

`app/admin/(dashboard)/calendar/page.tsx` の以下のブロック：
```tsx
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="font-heading text-2xl text-primary-700">予約カレンダー</h1>
        <select
```
を以下に置き換える：
```tsx
      <div className="flex flex-wrap items-center gap-4">
        <select
```

`app/admin/(dashboard)/reservations/[id]/page.tsx` の以下のブロック：
```tsx
      <div className="flex items-center gap-3">
        <h1 className="font-heading text-2xl text-primary-700">予約詳細 #{reservation.id}</h1>
        <span className="rounded-full bg-primary-50 px-2 py-1 text-xs text-primary-700">
```
を以下に置き換える：
```tsx
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-primary-50 px-2 py-1 text-xs text-primary-700">
```

- [ ] **Step 3: `justify-between`で右側要素と並んでいた`<h1>`を削除し、`justify-end`に変更する（4ファイル）**

`app/admin/(dashboard)/stores/page.tsx` の以下のブロック：
```tsx
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl text-primary-700">店舗管理</h1>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex h-10 items-center gap-1 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white"
        >
```
を以下に置き換える：
```tsx
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex h-10 items-center gap-1 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white"
        >
```

`app/admin/(dashboard)/dashboard/page.tsx` の以下のブロック：
```tsx
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl text-primary-700">ダッシュボード</h1>
        <select
```
を以下に置き換える：
```tsx
      <div className="flex items-center justify-end">
        <select
```

`app/admin/(dashboard)/menu/page.tsx` の以下のブロック：
```tsx
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl text-primary-700">メニュー・料金管理</h1>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex h-10 items-center gap-1 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white"
        >
```
を以下に置き換える：
```tsx
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex h-10 items-center gap-1 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white"
        >
```

`app/admin/(dashboard)/staff/page.tsx` の以下のブロック：
```tsx
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl text-primary-700">スタッフ管理</h1>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex h-10 items-center gap-1 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white"
        >
```
を以下に置き換える：
```tsx
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex h-10 items-center gap-1 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white"
        >
```

- [ ] **Step 4: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 5: Commit**

```bash
git add "app/admin/(dashboard)/cron-logs/page.tsx" "app/admin/(dashboard)/customer-statuses/page.tsx" "app/admin/(dashboard)/reservations/new/page.tsx" "app/admin/(dashboard)/auto-delivery/page.tsx" "app/admin/(dashboard)/reports/page.tsx" "app/admin/(dashboard)/customers/[id]/page.tsx" "app/admin/(dashboard)/calendar/page.tsx" "app/admin/(dashboard)/reservations/[id]/page.tsx" "app/admin/(dashboard)/stores/page.tsx" "app/admin/(dashboard)/dashboard/page.tsx" "app/admin/(dashboard)/menu/page.tsx" "app/admin/(dashboard)/staff/page.tsx"
git commit -m "feat: remove per-page headings now that the admin header shows the page title

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 4: `search-customers.ts` — ページネーション追加

**Files:**
- Modify: `app/actions/search-customers.ts`
- Test: `app/actions/search-customers.test.ts`
- Modify: `app/admin/(dashboard)/reservations/new/page.tsx`（呼び出し元の戻り値の形が変わるため更新が必要）

- [ ] **Step 1: 失敗するテストを書く（既存テストファイルを全面書き換え）**

`app/actions/search-customers.test.ts` を以下の内容に置き換える：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchCustomers } from "./search-customers";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    member: { findMany: vi.fn(), count: vi.fn() },
  },
}));

describe("searchCustomers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.member.count).mockResolvedValue(0);
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
    vi.mocked(prisma.member.count).mockResolvedValue(1);

    const result = await searchCustomers({});

    expect(result).toEqual({
      items: [
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
      ],
      totalCount: 1,
    });
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

    expect(result.items[0].lastVisitDate).toBeNull();
    expect(result.items[0].primaryStoreId).toBeNull();
    expect(result.items[0].primaryStoreName).toBeNull();
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

  it("paginates via skip/take for plain-column sorts, and returns totalCount from a separate count query", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.member.count).mockResolvedValue(45);

    const result = await searchCustomers({ page: 2 });

    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20 }),
    );
    expect(result.totalCount).toBe(45);
  });

  it("sorts by last visit date in memory, places customers with no visits last, and reports totalCount", () => {
    return (async () => {
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

      expect(result.items.map((c) => c.id)).toEqual([2, 1]);
      expect(result.totalCount).toBe(2);
      expect(prisma.member.count).not.toHaveBeenCalled();
    })();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run app/actions/search-customers.test.ts`
Expected: FAIL（戻り値が`CustomerListItem[]`のままで`{items, totalCount}`の形になっていない、`prisma.member.count`が呼ばれない等）

- [ ] **Step 3: 実装する**

`app/actions/search-customers.ts` を以下の内容に置き換える：

```ts
"use server";

import { prisma } from "@/lib/db";

export const CUSTOMER_PAGE_SIZE = 20;

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
  page?: number;
}

export interface CustomerSearchResult {
  items: CustomerListItem[];
  totalCount: number;
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

function mapMember(m: {
  id: number;
  name: string;
  phone: string;
  visitCount: number;
  totalSpent: number;
  isActive: boolean;
  createdAt: Date;
  status: { name: string; colorCode: string };
  primaryStore: { id: number; name: string } | null;
  reservations: { reservationDate: Date }[];
}): CustomerListItem {
  return {
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
  };
}

export async function searchCustomers(
  params: CustomerSearchParams,
): Promise<CustomerSearchResult> {
  const sortBy = params.sortBy ?? "id";
  const sortDirection = params.sortDirection ?? "desc";
  const page = params.page ?? 1;

  const where = {
    ...(params.name ? { name: { contains: params.name, mode: "insensitive" as const } } : {}),
    ...(params.phone ? { phone: { contains: params.phone } } : {}),
    ...(params.statusIds && params.statusIds.length > 0
      ? { statusId: { in: params.statusIds } }
      : {}),
    ...(params.storeId ? { primaryStoreId: params.storeId } : {}),
    ...(params.includeInactive ? {} : { isActive: true }),
  };

  const include = {
    status: true,
    primaryStore: true,
    reservations: {
      where: { status: "completed" as const },
      orderBy: { reservationDate: "desc" as const },
      take: 1,
    },
  };

  // lastVisitDateはDB上でソートできない派生値のため、この場合のみ全件取得して
  // メモリ上でソート・ページ切り出しを行う。それ以外は通常通りDB側でページングする。
  if (sortBy === "lastVisitDate") {
    const members = await prisma.member.findMany({ where, include });
    const mapped = members.map(mapMember);

    mapped.sort((a, b) => {
      if (a.lastVisitDate === b.lastVisitDate) return 0;
      if (a.lastVisitDate === null) return 1;
      if (b.lastVisitDate === null) return -1;
      return sortDirection === "asc"
        ? a.lastVisitDate.localeCompare(b.lastVisitDate)
        : b.lastVisitDate.localeCompare(a.lastVisitDate);
    });

    const totalCount = mapped.length;
    const start = (page - 1) * CUSTOMER_PAGE_SIZE;
    return { items: mapped.slice(start, start + CUSTOMER_PAGE_SIZE), totalCount };
  }

  const [members, totalCount] = await Promise.all([
    prisma.member.findMany({
      where,
      include,
      orderBy: buildMemberOrderBy(sortBy, sortDirection),
      skip: (page - 1) * CUSTOMER_PAGE_SIZE,
      take: CUSTOMER_PAGE_SIZE,
    }),
    prisma.member.count({ where }),
  ]);

  return { items: members.map(mapMember), totalCount };
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run app/actions/search-customers.test.ts`
Expected: PASS（7件）

- [ ] **Step 5: 呼び出し元`reservations/new/page.tsx`を更新する**

`app/admin/(dashboard)/reservations/new/page.tsx` の以下の行：
```tsx
    searchCustomers({ name: memberQuery }).then(setCustomers);
```
を以下に置き換える：
```tsx
    searchCustomers({ name: memberQuery }).then((result) => setCustomers(result.items));
```

- [ ] **Step 6: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし（`customers/page.tsx`はまだ古い戻り値の形を前提にしているため、Task 8が終わるまで一時的に型エラーが出る。これは想定内。`reservations/new/page.tsx`にはエラーが出ないことを確認する）

- [ ] **Step 7: Commit**

```bash
git add app/actions/search-customers.ts app/actions/search-customers.test.ts "app/admin/(dashboard)/reservations/new/page.tsx"
git commit -m "feat: add pagination to searchCustomers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 5: `manage-campaigns.ts` — `listCampaigns`にページネーション追加

**Files:**
- Modify: `app/actions/manage-campaigns.ts`
- Test: `app/actions/manage-campaigns.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/manage-campaigns.test.ts` の`vi.mock("@/lib/db", ...)`を以下に置き換える：

```ts
vi.mock("@/lib/db", () => ({
  prisma: {
    campaign: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));
```

`describe("listCampaigns", ...)`ブロック全体を以下に置き換える：

```ts
describe("listCampaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.campaign.count).mockResolvedValue(0);
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
          targetStoreId: null,
          targetStoreName: "全店舗",
          targetNames: ["スタンダード", "頭皮ケア重点"],
          courseIds: [5],
          categoryIds: [9],
        },
      ],
      totalCount: 1,
    });
    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isPublished: true }, skip: 0, take: 20 }),
    );
    expect(prisma.campaign.count).toHaveBeenCalledWith({ where: { isPublished: true } });
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
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run app/actions/manage-campaigns.test.ts`
Expected: FAIL（`listCampaigns`が`CampaignListItem[]`のまま返している、`prisma.campaign.count`が呼ばれない）

- [ ] **Step 3: 実装する**

`app/actions/manage-campaigns.ts` の以下のブロック：

```ts
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
```

を以下に置き換える：

```ts
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
        targetStore: true,
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
    targetStoreId: c.targetStoreId,
    targetStoreName: c.targetStore?.name ?? "全店舗",
    targetNames: [
      ...c.courseTargets.map((t) => t.course.name),
      ...c.categoryTargets.map((t) => t.category.name),
    ],
    courseIds: c.courseTargets.map((t) => t.courseId),
    categoryIds: c.categoryTargets.map((t) => t.categoryId),
  }));

  return { items, totalCount };
}
```

（`createCampaign`・`updateCampaign`・`deleteCampaign`・`republishCampaign`はこのタスクでは一切変更しない。）

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run app/actions/manage-campaigns.test.ts`
Expected: PASS（7件）

- [ ] **Step 5: 型チェック**

Run: `npx tsc --noEmit`
Expected: `campaigns/page.tsx`にまだ古い戻り値の形を前提にしたエラーが出るのは想定内（Task 9で解消）。それ以外に新規エラーがないことを確認する。

- [ ] **Step 6: Commit**

```bash
git add app/actions/manage-campaigns.ts app/actions/manage-campaigns.test.ts
git commit -m "feat: add pagination to listCampaigns

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 6: `segment-campaigns.ts` — `listSegmentCampaigns`にページネーション追加

**Files:**
- Modify: `app/actions/segment-campaigns.ts`
- Test: `app/actions/segment-campaigns.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/segment-campaigns.test.ts` の`vi.mock("@/lib/db", ...)`を以下に置き換える：

```ts
vi.mock("@/lib/db", () => ({
  prisma: {
    member: { findMany: vi.fn() },
    segmentCampaign: { create: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    deliveryTemplate: { findUniqueOrThrow: vi.fn() },
    emailLineLog: { create: vi.fn() },
  },
}));
```

`describe("listSegmentCampaigns", ...)`ブロック全体を以下に置き換える：

```ts
describe("listSegmentCampaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.segmentCampaign.count).mockResolvedValue(0);
  });

  it("rejects a non-admin session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "member" } } as never);

    await expect(listSegmentCampaigns()).rejects.toThrow("unauthorized");
    expect(prisma.segmentCampaign.findMany).not.toHaveBeenCalled();
  });

  it("returns campaign history with the template name", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.segmentCampaign.findMany).mockResolvedValue([
      {
        id: 1,
        name: "夏季キャンペーン",
        channelMode: "auto",
        targetCount: 50,
        scheduledAt: null,
        sentAt: new Date("2026-09-01T09:00:00.000Z"),
        template: { name: "夏の特別クーポン" },
      },
    ] as never);
    vi.mocked(prisma.segmentCampaign.count).mockResolvedValue(1);

    const result = await listSegmentCampaigns();

    expect(result).toEqual({
      items: [
        {
          id: 1,
          name: "夏季キャンペーン",
          channelMode: "auto",
          templateName: "夏の特別クーポン",
          targetCount: 50,
          scheduledAt: null,
          sentAt: "2026-09-01T09:00:00.000Z",
        },
      ],
      totalCount: 1,
    });
    expect(prisma.segmentCampaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });

  it("applies skip/take based on the requested page", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.segmentCampaign.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.segmentCampaign.count).mockResolvedValue(25);

    const result = await listSegmentCampaigns(2);

    expect(prisma.segmentCampaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20 }),
    );
    expect(result.totalCount).toBe(25);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run app/actions/segment-campaigns.test.ts`
Expected: FAIL（`listSegmentCampaigns`が`SegmentCampaignListItem[]`のまま返している）

- [ ] **Step 3: 実装する**

`app/actions/segment-campaigns.ts` の以下のブロック：

```ts
export async function listSegmentCampaigns(): Promise<SegmentCampaignListItem[]> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  const campaigns = await prisma.segmentCampaign.findMany({
    include: { template: true },
    orderBy: { createdAt: "desc" },
  });

  return campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    channelMode: c.channelMode,
    templateName: c.template.name,
    targetCount: c.targetCount,
    scheduledAt: c.scheduledAt ? c.scheduledAt.toISOString() : null,
    sentAt: c.sentAt ? c.sentAt.toISOString() : null,
  }));
}
```

を以下に置き換える：

```ts
export const SEGMENT_CAMPAIGN_PAGE_SIZE = 20;

export interface ListSegmentCampaignsResult {
  items: SegmentCampaignListItem[];
  totalCount: number;
}

export async function listSegmentCampaigns(page = 1): Promise<ListSegmentCampaignsResult> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  const [campaigns, totalCount] = await Promise.all([
    prisma.segmentCampaign.findMany({
      include: { template: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * SEGMENT_CAMPAIGN_PAGE_SIZE,
      take: SEGMENT_CAMPAIGN_PAGE_SIZE,
    }),
    prisma.segmentCampaign.count(),
  ]);

  const items = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    channelMode: c.channelMode,
    templateName: c.template.name,
    targetCount: c.targetCount,
    scheduledAt: c.scheduledAt ? c.scheduledAt.toISOString() : null,
    sentAt: c.sentAt ? c.sentAt.toISOString() : null,
  }));

  return { items, totalCount };
}
```

（`createSegmentCampaign`はこのタスクでは一切変更しない。）

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run app/actions/segment-campaigns.test.ts`
Expected: PASS（6件）

- [ ] **Step 5: 型チェック**

Run: `npx tsc --noEmit`
Expected: `segment-campaigns/page.tsx`にまだ古い戻り値の形を前提にしたエラーが出るのは想定内（Task 10で解消）。それ以外に新規エラーがないことを確認する。

- [ ] **Step 6: Commit**

```bash
git add app/actions/segment-campaigns.ts app/actions/segment-campaigns.test.ts
git commit -m "feat: add pagination to listSegmentCampaigns

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 7: `manage-templates.ts` — ページング済み一覧`listTemplatesPage`を追加

**Files:**
- Modify: `app/actions/manage-templates.ts`
- Test: `app/actions/manage-templates.test.ts`

**重要:** 既存の`listTemplates()`（引数なし・全件取得）は`app/admin/(dashboard)/auto-delivery/page.tsx`と`app/admin/(dashboard)/segment-campaigns/page.tsx`のテンプレート選択ドロップダウンから使われており、これらはページングされていない全件リストを必要とする。したがって`listTemplates()`自体は変更せず、新しい別関数`listTemplatesPage(page)`を追加する。`templates/page.tsx`（管理一覧ページ）だけがTask 11で`listTemplatesPage`に切り替わる。

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/manage-templates.test.ts` の`vi.mock("@/lib/db", ...)`を以下に置き換える：

```ts
vi.mock("@/lib/db", () => ({
  prisma: {
    deliveryTemplate: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));
```

ファイル冒頭のimportを以下に更新する：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listTemplates, listTemplatesPage, createTemplate, updateTemplate } from "./manage-templates";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
```

ファイル末尾（`describe("updateTemplate", ...)`ブロックの後）に以下を追加する：

```ts

describe("listTemplatesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.deliveryTemplate.count).mockResolvedValue(0);
  });

  it("rejects a non-admin session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "member" } } as never);

    await expect(listTemplatesPage()).rejects.toThrow("unauthorized");
    expect(prisma.deliveryTemplate.findMany).not.toHaveBeenCalled();
  });

  it("returns a page of templates with totalCount", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.deliveryTemplate.findMany).mockResolvedValue([
      {
        id: 2,
        type: "segment",
        name: "夏季キャンペーン",
        subject: "夏の特別クーポン",
        bodyText: "{{氏名}}様へ",
      },
    ] as never);
    vi.mocked(prisma.deliveryTemplate.count).mockResolvedValue(1);

    const result = await listTemplatesPage();

    expect(result).toEqual({
      items: [
        {
          id: 2,
          type: "segment",
          name: "夏季キャンペーン",
          subject: "夏の特別クーポン",
          bodyText: "{{氏名}}様へ",
        },
      ],
      totalCount: 1,
    });
    expect(prisma.deliveryTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { id: "desc" }, skip: 0, take: 20 }),
    );
  });

  it("applies skip/take based on the requested page", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.deliveryTemplate.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.deliveryTemplate.count).mockResolvedValue(25);

    const result = await listTemplatesPage(2);

    expect(prisma.deliveryTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20 }),
    );
    expect(result.totalCount).toBe(25);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run app/actions/manage-templates.test.ts`
Expected: FAIL（`listTemplatesPage`が存在しない）

- [ ] **Step 3: 実装する**

`app/actions/manage-templates.ts` の末尾に以下を追加する：

```ts

export const TEMPLATE_PAGE_SIZE = 20;

export interface ListTemplatesPageResult {
  items: TemplateListItem[];
  totalCount: number;
}

export async function listTemplatesPage(page = 1): Promise<ListTemplatesPageResult> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  const [templates, totalCount] = await Promise.all([
    prisma.deliveryTemplate.findMany({
      orderBy: { id: "desc" },
      skip: (page - 1) * TEMPLATE_PAGE_SIZE,
      take: TEMPLATE_PAGE_SIZE,
    }),
    prisma.deliveryTemplate.count(),
  ]);

  const items = templates.map((t) => ({
    id: t.id,
    type: t.type,
    name: t.name,
    subject: t.subject,
    bodyText: t.bodyText,
  }));

  return { items, totalCount };
}
```

（既存の`listTemplates`・`createTemplate`・`updateTemplate`は一切変更しない。）

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run app/actions/manage-templates.test.ts`
Expected: PASS（8件）

- [ ] **Step 5: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし（`listTemplates`は変更していないため`auto-delivery/page.tsx`・`segment-campaigns/page.tsx`への影響はない）

- [ ] **Step 6: Commit**

```bash
git add app/actions/manage-templates.ts app/actions/manage-templates.test.ts
git commit -m "feat: add listTemplatesPage for the paginated template management list

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 8: `customers/page.tsx` — 見出し削除・ページネーション・スクロール固定

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
import { Pagination } from "@/components/ui/pagination";

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

const PAGE_SIZE = 20;

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
  const [page, setPage] = useState(1);

  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
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
      page,
    }).then((result) => {
      setCustomers(result.items);
      setTotalCount(result.totalCount);
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, phone, statusIds, includeInactive, sortBy, sortDirection, page]);

  useEffect(() => {
    listCustomerStatuses().then(setStatuses);
    listStores().then(setStores);
  }, []);

  function toggleStatus(statusId: number) {
    setPage(1);
    setStatusIds((prev) =>
      prev.includes(statusId) ? prev.filter((id) => id !== statusId) : [...prev, statusId],
    );
  }

  function toggleSort(field: CustomerSortField) {
    setPage(1);
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

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
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
          onChange={(e) => {
            setPage(1);
            setName(e.target.value);
          }}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        />
        <input
          type="text"
          placeholder="電話番号で検索"
          value={phone}
          onChange={(e) => {
            setPage(1);
            setPhone(e.target.value);
          }}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => {
              setPage(1);
              setIncludeInactive(e.target.checked);
            }}
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
            aria-pressed={statusIds.includes(s.id)}
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

      <div className="max-h-[60vh] overflow-y-auto overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-0 text-left text-neutral-500 sticky top-0 z-10">
              {SORT_COLUMNS.slice(0, 1).map(({ field, label }) => (
                <th
                  key={field}
                  className="p-3"
                  aria-sort={sortBy === field ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                >
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
                <th
                  key={field}
                  className="p-3"
                  aria-sort={sortBy === field ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                >
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

      <p className="text-center text-xs text-neutral-500">{totalCount}件中 {customers.length}件を表示</p>
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

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
git commit -m "feat: add pagination and sticky-header scrolling to customer list

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 9: `campaigns/page.tsx` — 見出し削除・ページネーション・スクロール固定

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
import { Pagination } from "@/components/ui/pagination";

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

const PAGE_SIZE = 20;

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
  const [totalCount, setTotalCount] = useState(0);
  const [courses, setCourses] = useState<ManagedCourse[]>([]);
  const [categories, setCategories] = useState<CourseCategoryListItem[]>([]);
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [includeUnpublished, setIncludeUnpublished] = useState(false);
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  function reload() {
    listCampaigns({ includeUnpublished, page }).then((result) => {
      setCampaigns(result.items);
      setTotalCount(result.totalCount);
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeUnpublished, page]);

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

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
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
          onChange={(e) => {
            setPage(1);
            setIncludeUnpublished(e.target.checked);
          }}
        />
        無効なキャンペーンも表示
      </label>

      <div className="max-h-[60vh] overflow-y-auto overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-0 text-left text-neutral-500 sticky top-0 z-10">
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

      <p className="text-center text-xs text-neutral-500">{totalCount}件中 {campaigns.length}件を表示</p>
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

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
git commit -m "feat: add pagination and sticky-header scrolling to campaign list

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 10: `segment-campaigns/page.tsx` — 見出し削除・配信履歴のページネーション・スクロール固定

**Files:**
- Modify: `app/admin/(dashboard)/segment-campaigns/page.tsx`

- [ ] **Step 1: ページ全体を書き換える**

`app/admin/(dashboard)/segment-campaigns/page.tsx` を以下の内容に置き換える（配信設定モーダルの中身・ロジックは一切変更しない。変更は見出し削除・履歴テーブルのページネーションとスクロール固定のみ）：

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
import { Pagination } from "@/components/ui/pagination";

const CHANNEL_LABEL: Record<SegmentChannelMode, string> = {
  email: "メール",
  line: "LINE",
  auto: "両方（自動振り分け）",
};

const PAGE_SIZE = 20;

export default function SegmentCampaignsPage() {
  const [statuses, setStatuses] = useState<CustomerStatusItem[]>([]);
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [history, setHistory] = useState<SegmentCampaignListItem[]>([]);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);
  const [page, setPage] = useState(1);

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
    listSegmentCampaigns(page).then((result) => {
      setHistory(result.items);
      setHistoryTotalCount(result.totalCount);
    });
  }

  useEffect(() => {
    listCustomerStatuses().then(setStatuses);
    listStores().then(setStores);
    listTemplates().then((all) => setTemplates(all.filter((t) => t.type === "segment")));
  }, []);

  useEffect(() => {
    refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

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

  const totalPages = Math.max(1, Math.ceil(historyTotalCount / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
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
        <div className="max-h-[60vh] overflow-y-auto overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-0 text-left text-neutral-500 sticky top-0 z-10">
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
        <p className="text-center text-xs text-neutral-500">{historyTotalCount}件中 {history.length}件を表示</p>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
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

          {resultMessage && (
            <p role="status" aria-live="polite" className="text-sm text-neutral-700">
              {resultMessage}
            </p>
          )}

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

- [ ] **Step 3: 既存の関連テストが壊れていないことを確認する**

Run: `npx vitest run app/actions/segment-campaigns.test.ts app/actions/segment-audience.test.ts app/actions/manage-templates.test.ts`
Expected: 全件PASS

- [ ] **Step 4: Commit**

```bash
git add "app/admin/(dashboard)/segment-campaigns/page.tsx"
git commit -m "feat: add pagination and sticky-header scrolling to segment delivery history

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 11: `templates/page.tsx` — 見出し削除・ページネーション・スクロール固定

**Files:**
- Modify: `app/admin/(dashboard)/templates/page.tsx`

- [ ] **Step 1: ページ全体を書き換える**

`app/admin/(dashboard)/templates/page.tsx` を以下の内容に置き換える：

```tsx
"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil } from "lucide-react";
import {
  listTemplatesPage,
  createTemplate,
  updateTemplate,
  type TemplateListItem,
  type DeliveryTemplateType,
} from "@/app/actions/manage-templates";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";

const TYPE_LABEL: Record<DeliveryTemplateType, string> = {
  birthday: "誕生月メール",
  reminder: "前日リマインド",
  segment: "セグメント配信",
};

const PAGE_SIZE = 20;

const EMPTY_FORM = { type: "segment" as DeliveryTemplateType, name: "", subject: "", bodyText: "" };

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function refresh() {
    listTemplatesPage(page).then((result) => {
      setTemplates(result.items);
      setTotalCount(result.totalCount);
    });
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

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

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="flex h-10 items-center gap-1 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white"
        >
          <Plus size={16} />
          新規テンプレート作成
        </button>
      </div>

      <div className="max-h-[60vh] overflow-y-auto overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-0 text-left text-neutral-500 sticky top-0 z-10">
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

      <p className="text-center text-xs text-neutral-500">{totalCount}件中 {templates.length}件を表示</p>
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

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

- [ ] **Step 3: 既存の関連テストが壊れていないことを確認する**

Run: `npx vitest run app/actions/manage-templates.test.ts`
Expected: 全件PASS

- [ ] **Step 4: Commit**

```bash
git add "app/admin/(dashboard)/templates/page.tsx"
git commit -m "feat: add pagination and sticky-header scrolling to template list

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 12: 最終検証

**Files:** なし（検証のみ）

- [ ] **Step 1: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 2: Lint**

Run: `npx eslint .`
Expected: エラーなし

- [ ] **Step 3: 全テスト実行**

Run: `npx vitest run`
Expected: 既存テストを含め全件PASS

- [ ] **Step 4: 最終確認事項をユーザーに伝える**

以下をユーザーに報告する：
1. 開発サーバーを再起動して、ヘッダーのページ名表示とページネーション・スクロール固定を実機で確認してもらう
2. `git push` はユーザー自身に任せる
3. B〜Iの残り8サブプロジェクト（利用店舗の多店舗化、メニュー管理拡張、キャンペーン改善、スタッフ管理再設計、配信管理タブ統合、設定セクション新設、アカウント管理、権限設定＋店舗スコープ表示）は別サイクルで進める

---

## 完了条件

- Task 1〜11のコミットがすべて完了している
- `npx tsc --noEmit` / `npx eslint .` / `npx vitest run` がすべてエラーなしで通る
- ユーザーが実機で顧客・キャンペーン・配信履歴・テンプレートの4画面のページネーションとヘッダー表示を確認する
