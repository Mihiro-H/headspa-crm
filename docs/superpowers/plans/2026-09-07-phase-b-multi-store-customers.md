# Phase B: 顧客の利用店舗の多店舗化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 顧客の「所属店舗」（単一）を「利用店舗」（複数選択・対等）に変更し、予約確定のたびに予約店舗が自動的に利用店舗へ追加されるようにする。

**Architecture:** `Member.primaryStoreId`（単一FK）を廃止し、多対多の中間テーブル`MemberStore`を新設する。`search-customers.ts`・`manage-customers.ts`をそのデータ形状に合わせて書き換え、予約確定の2箇所（会員セルフ予約・電話予約）に自動追加ロジックを差し込む。

**Tech Stack:** Next.js (App Router) / TypeScript / Prisma (PostgreSQL) / Tailwind CSS v4 / Vitest

**関連ドキュメント:** `docs/superpowers/specs/2026-09-07-phase-b-multi-store-customers-design.md`

**前提:** Phase A（`docs/superpowers/plans/2026-09-07-admin-header-pagination.md`）が完了していること。本Planの`search-customers.ts`・`customers/page.tsx`への変更は、Phase Aで追加されたページネーション機能の上に積み重なる。

---

### Task 1: Prisma schema — `MemberStore`中間テーブルを追加し`primaryStoreId`を廃止

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: `model Member`から`primaryStoreId`・`primaryStore`リレーションを削除し、`usedStores`を追加する**

`prisma/schema.prisma`の`model Member`ブロック内、以下の行：
```prisma
  primaryStoreId Int?     @map("primary_store_id")
```
を削除する。

同モデル内、以下の行：
```prisma
  primaryStore  Store?         @relation("MemberPrimaryStore", fields: [primaryStoreId], references: [id])
```
を以下に置き換える：
```prisma
  usedStores    MemberStore[]
```

- [ ] **Step 2: `model Store`から`primaryMembers`を削除し、`memberStores`を追加する**

`model Store`ブロック内、以下の行：
```prisma
  primaryMembers Member[]       @relation("MemberPrimaryStore")
```
を以下に置き換える：
```prisma
  memberStores   MemberStore[]
```

- [ ] **Step 3: `MemberStore`モデルを新設する**

`model Member`ブロックの直後に以下を追加する：

```prisma
model MemberStore {
  id       Int    @id @default(autoincrement())
  memberId Int    @map("member_id")
  storeId  Int    @map("store_id")

  member Member @relation(fields: [memberId], references: [id])
  store  Store  @relation(fields: [storeId], references: [id])

  @@unique([memberId, storeId])
  @@map("member_stores")
}
```

- [ ] **Step 4: Prisma Clientを再生成する**

Run: `npx prisma generate`
Expected: `Generated Prisma Client`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): replace Member.primaryStoreId with many-to-many MemberStore

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

**⚠️ ユーザーへの依頼事項:** マイグレーション適用前に、既存の`primaryStoreId`を新しい`MemberStore`に移し替えるSQLをマイグレーションファイルに追加する必要がある。`npx prisma migrate dev --name replace_primary_store_with_used_stores --create-only`でマイグレーションファイルだけ生成し、生成された`migration.sql`の`ALTER TABLE "members" DROP COLUMN "primary_store_id";`より前に以下のSQLを挿入してからユーザー自身の環境でマイグレーションを適用してもらう：
```sql
INSERT INTO "member_stores" ("member_id", "store_id")
SELECT "member_id", "primary_store_id" FROM "members" WHERE "primary_store_id" IS NOT NULL;
```

---

### Task 2: `lib/customer/add-used-store.ts`（新規）

**Files:**
- Create: `lib/customer/add-used-store.ts`
- Test: `lib/customer/add-used-store.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`lib/customer/add-used-store.test.ts`を新規作成する：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { addUsedStore } from "./add-used-store";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    memberStore: { upsert: vi.fn() },
  },
}));

describe("addUsedStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts a MemberStore row for the given member and store", async () => {
    vi.mocked(prisma.memberStore.upsert).mockResolvedValue({} as never);

    await addUsedStore(5, 2);

    expect(prisma.memberStore.upsert).toHaveBeenCalledWith({
      where: { memberId_storeId: { memberId: 5, storeId: 2 } },
      create: { memberId: 5, storeId: 2 },
      update: {},
    });
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run lib/customer/add-used-store.test.ts`
Expected: FAIL（`./add-used-store`が存在しない）

- [ ] **Step 3: 実装する**

`lib/customer/add-used-store.ts`を新規作成する：

```ts
import { prisma } from "@/lib/db";

// 予約が確定するたびに呼び出し、その予約店舗を顧客の「利用店舗」に追加する。
// 既に登録済みの店舗であれば何もしない（upsertのupdate部分は空）。
export async function addUsedStore(memberId: number, storeId: number): Promise<void> {
  await prisma.memberStore.upsert({
    where: { memberId_storeId: { memberId, storeId } },
    create: { memberId, storeId },
    update: {},
  });
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run lib/customer/add-used-store.test.ts`
Expected: PASS（1件）

- [ ] **Step 5: Commit**

```bash
git add lib/customer/add-used-store.ts lib/customer/add-used-store.test.ts
git commit -m "feat: add addUsedStore helper to record a member's store usage

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 3: `search-customers.ts` — `storeIds`/`storeNames`（複数）に対応

**Files:**
- Modify: `app/actions/search-customers.ts`
- Test: `app/actions/search-customers.test.ts`

**前提:** Phase A（Task 4）でこのファイルは既に`page`引数とページング済み結果`{items, totalCount}`に対応済み。本タスクはその上に、単一の`primaryStoreId`/`primaryStoreName`を複数の`storeIds`/`storeNames`に置き換える。

- [ ] **Step 1: 失敗するテストを書く（既存テストファイルを全面書き換え）**

`app/actions/search-customers.test.ts`を以下の内容に置き換える：

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

  it("maps members to customer list items with status, used stores, and contact info", async () => {
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
        usedStores: [
          { store: { id: 2, name: "フォレスパ 渋谷店" } },
          { store: { id: 3, name: "フォレスパ 新宿店" } },
        ],
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
          storeIds: [2, 3],
          storeNames: ["フォレスパ 渋谷店", "フォレスパ 新宿店"],
          createdAt: "2026-01-15",
          isActive: true,
        },
      ],
      totalCount: 1,
    });
  });

  it("returns empty arrays for storeIds/storeNames and null lastVisitDate when absent", async () => {
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
        usedStores: [],
        reservations: [],
      },
    ] as never);

    const result = await searchCustomers({});

    expect(result.items[0].lastVisitDate).toBeNull();
    expect(result.items[0].storeIds).toEqual([]);
    expect(result.items[0].storeNames).toEqual([]);
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

  it("passes name/phone/statusIds/storeIds filters through to the query", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([] as never);

    await searchCustomers({ name: "田中", phone: "090", statusIds: [2, 3], storeIds: [1, 4] });

    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: "田中", mode: "insensitive" },
          phone: { contains: "090" },
          statusId: { in: [2, 3] },
          usedStores: { some: { storeId: { in: [1, 4] } } },
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

  it("sorts by last visit date in memory, places customers with no visits last, and reports totalCount", async () => {
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
        usedStores: [],
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
        usedStores: [],
        reservations: [{ reservationDate: new Date("2026-08-01T00:00:00Z") }],
      },
    ] as never);

    const result = await searchCustomers({ sortBy: "lastVisitDate", sortDirection: "desc" });

    expect(result.items.map((c) => c.id)).toEqual([2, 1]);
    expect(result.totalCount).toBe(2);
    expect(prisma.member.count).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run app/actions/search-customers.test.ts`
Expected: FAIL（`storeIds`/`storeNames`がまだ返っていない、`usedStores`のincludeがない）

- [ ] **Step 3: 実装する**

`app/actions/search-customers.ts`を以下の内容に置き換える：

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
  storeIds: number[];
  storeNames: string[];
  createdAt: string;
  isActive: boolean;
}

export interface CustomerSearchParams {
  name?: string;
  phone?: string;
  statusIds?: number[];
  storeIds?: number[];
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
  usedStores: { store: { id: number; name: string } }[];
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
    storeIds: m.usedStores.map((u) => u.store.id),
    storeNames: m.usedStores.map((u) => u.store.name),
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
    ...(params.storeIds && params.storeIds.length > 0
      ? { usedStores: { some: { storeId: { in: params.storeIds } } } }
      : {}),
    ...(params.includeInactive ? {} : { isActive: true }),
  };

  const include = {
    status: true,
    usedStores: { include: { store: true } },
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

- [ ] **Step 5: Commit**

```bash
git add app/actions/search-customers.ts app/actions/search-customers.test.ts
git commit -m "feat: replace single primaryStoreId with multi-store storeIds/storeNames in searchCustomers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 4: `manage-customers.ts` — `storeIds`対応と`updateCustomerStores`追加

**Files:**
- Modify: `app/actions/manage-customers.ts`
- Test: `app/actions/manage-customers.test.ts`

- [ ] **Step 1: 失敗するテストを書く（既存テストファイルを全面書き換え）**

`app/actions/manage-customers.test.ts`を以下の内容に置き換える：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createCustomerByAdmin,
  updateCustomerByAdmin,
  updateCustomerStores,
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

  it("creates a member with the lowest-ranked status and given used stores", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.customerStatus.findFirstOrThrow).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.member.create).mockResolvedValue({ id: 42 } as never);

    const result = await createCustomerByAdmin({
      name: "山田 太郎",
      email: "yamada@example.com",
      phone: "090-1234-5678",
      gender: "male",
      birthMonth: 4,
      storeIds: [2, 3],
    });

    expect(result).toEqual({ status: "created", memberId: 42 });
    expect(prisma.member.create).toHaveBeenCalledWith({
      data: {
        name: "山田 太郎",
        email: "yamada@example.com",
        phone: "090-1234-5678",
        gender: "male",
        birthMonth: 4,
        statusId: 1,
        usedStores: { create: [{ storeId: 2 }, { storeId: 3 }] },
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
      storeIds: [],
    });

    expect(result).toEqual({ status: "email_taken" });
    expect(prisma.member.create).not.toHaveBeenCalled();
  });
});

describe("updateCustomerByAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates name and phone only", async () => {
    vi.mocked(prisma.member.update).mockResolvedValue({} as never);

    await updateCustomerByAdmin({ memberId: 1, name: "新氏名", phone: "090-0000-0000" });

    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: "新氏名", phone: "090-0000-0000" },
    });
  });
});

describe("updateCustomerStores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replaces the member's used stores", async () => {
    vi.mocked(prisma.member.update).mockResolvedValue({} as never);

    await updateCustomerStores(1, [2, 4]);

    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        usedStores: { deleteMany: {}, create: [{ storeId: 2 }, { storeId: 4 }] },
      },
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
Expected: FAIL（`storeIds`パラメータが存在しない、`updateCustomerStores`が存在しない）

- [ ] **Step 3: 実装する**

`app/actions/manage-customers.ts`を以下の内容に置き換える：

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
  storeIds: number[];
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
      statusId: defaultStatus.id,
      usedStores: { create: params.storeIds.map((storeId) => ({ storeId })) },
    },
  });

  return { status: "created", memberId: member.id };
}

export interface UpdateCustomerByAdminParams {
  memberId: number;
  name: string;
  phone: string;
}

export async function updateCustomerByAdmin(params: UpdateCustomerByAdminParams): Promise<void> {
  await prisma.member.update({
    where: { id: params.memberId },
    data: {
      name: params.name,
      phone: params.phone,
    },
  });
}

// 利用店舗を丸ごと置き換える（deleteMany + createのreplace-allパターン）。
export async function updateCustomerStores(memberId: number, storeIds: number[]): Promise<void> {
  await prisma.member.update({
    where: { id: memberId },
    data: {
      usedStores: { deleteMany: {}, create: storeIds.map((storeId) => ({ storeId })) },
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
Expected: PASS（6件）

- [ ] **Step 5: Commit**

```bash
git add app/actions/manage-customers.ts app/actions/manage-customers.test.ts
git commit -m "feat: switch admin customer create/update actions to multi-store usedStores

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 5: 予約確定時に利用店舗を自動追加する

**Files:**
- Modify: `app/actions/confirm-reservation.ts`
- Modify: `app/actions/create-phone-reservation.ts`

- [ ] **Step 1: `confirm-reservation.ts`に追加する**

`app/actions/confirm-reservation.ts`の以下のimport行：
```ts
import { createNotification } from "@/lib/notifications/create-notification";
```
の直後に以下を追加する：
```ts
import { addUsedStore } from "@/lib/customer/add-used-store";
```

以下のブロック：
```ts
  await createNotification({
    storeId: updated.storeId,
    type: "new_reservation",
    message: `新規WEB予約：${updated.reservationDate.toISOString().slice(0, 10)} ${minutesToLabel(dbTimeToMinutes(updated.startTime))}〜`,
    reservationId: updated.id,
  });

  return { status: "confirmed" };
```
を以下に置き換える：
```ts
  await createNotification({
    storeId: updated.storeId,
    type: "new_reservation",
    message: `新規WEB予約：${updated.reservationDate.toISOString().slice(0, 10)} ${minutesToLabel(dbTimeToMinutes(updated.startTime))}〜`,
    reservationId: updated.id,
  });

  await addUsedStore(memberId, updated.storeId);

  return { status: "confirmed" };
```

- [ ] **Step 2: `create-phone-reservation.ts`に追加する**

`app/actions/create-phone-reservation.ts`の以下のimport行：
```ts
import { resolveCourseCampaigns } from "./course-campaigns";
```
の直後に以下を追加する：
```ts
import { addUsedStore } from "@/lib/customer/add-used-store";
```

ファイル末尾の以下の行：
```ts
  return { status: "created", reservationId: reservation.id };
}
```
を以下に置き換える：
```ts
  await addUsedStore(params.memberId, params.storeId);

  return { status: "created", reservationId: reservation.id };
}
```

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: 既存テストが`prisma.memberStore`をモックしていないため、追加する**

`app/actions/confirm-reservation.test.ts`の以下のブロック：
```ts
vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));
```
を以下に置き換える：
```ts
vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    memberStore: { upsert: vi.fn() },
  },
}));
```
同ファイルの`beforeEach(() => { ... });`ブロック（`vi.clearAllMocks();`と`vi.mocked(prisma.reservation.update).mockResolvedValue(...)`が並んでいる箇所）に、`vi.mocked(prisma.reservation.update).mockResolvedValue(...)`の行の直後として以下を追加する：
```ts
    vi.mocked(prisma.memberStore.upsert).mockResolvedValue({} as never);
```

`app/actions/create-phone-reservation.test.ts`の以下のブロック：
```ts
vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: { findMany: vi.fn(), create: vi.fn() },
    course: { findUniqueOrThrow: vi.fn() },
    option: { findMany: vi.fn() },
    staff: { findUniqueOrThrow: vi.fn() },
  },
}));
```
を以下に置き換える：
```ts
vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: { findMany: vi.fn(), create: vi.fn() },
    course: { findUniqueOrThrow: vi.fn() },
    option: { findMany: vi.fn() },
    staff: { findUniqueOrThrow: vi.fn() },
    memberStore: { upsert: vi.fn() },
  },
}));
```
このファイルの各`it(...)`ブロック内、`prisma.reservation.create`をモックしている箇所の近くに`vi.mocked(prisma.memberStore.upsert).mockResolvedValue({} as never);`を追加する必要があるかどうかは、実際にテストを実行して失敗したケースにのみ追加する（`vi.fn()`はデフォルトで`undefined`を返し、`await undefined`はエラーにならないため、多くの場合は追加不要な可能性が高い——`confirm-reservation.test.ts`側とは異なり、こちらは`beforeEach`で共通のモック解決値を設定していないため、テストごとに個別確認する）。

- [ ] **Step 5: 既存の関連テストが壊れていないことを確認する**

Run: `npx vitest run app/actions/confirm-reservation.test.ts app/actions/create-phone-reservation.test.ts`
Expected: 全件PASS

- [ ] **Step 6: Commit**

```bash
git add app/actions/confirm-reservation.ts app/actions/create-phone-reservation.ts app/actions/confirm-reservation.test.ts app/actions/create-phone-reservation.test.ts
git commit -m "feat: automatically record used store when a reservation is confirmed

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 6: `customers/page.tsx` — 利用店舗の複数選択UIに変更

**Files:**
- Modify: `app/admin/(dashboard)/customers/page.tsx`

**前提:** Phase A（Task 8）でこのページは既にページネーション対応済み。本タスクはその最終版の上に、「所属店舗」単一選択を「利用店舗」複数選択に置き換える。

- [ ] **Step 1: importと定数を更新する**

以下の行：
```tsx
import {
  createCustomerByAdmin,
  updateCustomerByAdmin,
  deactivateCustomer,
  reactivateCustomer,
} from "@/app/actions/manage-customers";
```
を以下に置き換える：
```tsx
import {
  createCustomerByAdmin,
  updateCustomerByAdmin,
  updateCustomerStores,
  deactivateCustomer,
  reactivateCustomer,
} from "@/app/actions/manage-customers";
```

以下の行：
```tsx
const EMPTY_CREATE_FORM = {
  name: "",
  email: "",
  phone: "",
  gender: "female" as "female" | "male" | "other",
  birthMonth: 1,
  primaryStoreId: null as number | null,
};
```
を以下に置き換える：
```tsx
const EMPTY_CREATE_FORM = {
  name: "",
  email: "",
  phone: "",
  gender: "female" as "female" | "male" | "other",
  birthMonth: 1,
  storeIds: [] as number[],
};
```

- [ ] **Step 2: 編集フォームの状態を更新する**

以下の行：
```tsx
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    primaryStoreId: null as number | null,
  });
```
を以下に置き換える：
```tsx
  const [editForm, setEditForm] = useState({ name: "", phone: "", storeIds: [] as number[] });
```

- [ ] **Step 3: `startEdit`・`handleSaveEdit`を更新する**

以下のブロック：
```tsx
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
```
を以下に置き換える：
```tsx
  function startEdit(customer: CustomerListItem) {
    setEditing(customer);
    setEditForm({ name: customer.name, phone: customer.phone, storeIds: customer.storeIds });
  }

  function toggleEditStore(storeId: number) {
    setEditForm((f) => ({
      ...f,
      storeIds: f.storeIds.includes(storeId)
        ? f.storeIds.filter((id) => id !== storeId)
        : [...f.storeIds, storeId],
    }));
  }

  function toggleCreateStore(storeId: number) {
    setCreateForm((f) => ({
      ...f,
      storeIds: f.storeIds.includes(storeId)
        ? f.storeIds.filter((id) => id !== storeId)
        : [...f.storeIds, storeId],
    }));
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setSaving(true);
    await updateCustomerByAdmin({ memberId: editing.id, name: editForm.name, phone: editForm.phone });
    await updateCustomerStores(editing.id, editForm.storeIds);
    setSaving(false);
    setEditing(null);
    reload();
  }
```

- [ ] **Step 4: テーブルの「所属店舗」列を「利用店舗」に変更する**

以下の行：
```tsx
              <th className="p-3">所属店舗</th>
```
を以下に置き換える：
```tsx
              <th className="p-3">利用店舗</th>
```

以下の行：
```tsx
                <td className="p-3">{c.primaryStoreName ?? "—"}</td>
```
を以下に置き換える：
```tsx
                <td className="p-3">{c.storeNames.join("、") || "—"}</td>
```

- [ ] **Step 5: 新規登録モーダルの店舗選択を複数選択に変更する**

以下のブロック：
```tsx
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
```
を以下に置き換える：
```tsx
          <div>
            <p className="mb-1 text-sm text-neutral-600">利用店舗</p>
            <div className="flex flex-wrap gap-3">
              {stores.map((s) => (
                <label key={s.id} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={createForm.storeIds.includes(s.id)}
                    onChange={() => toggleCreateStore(s.id)}
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
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
```

- [ ] **Step 6: 編集モーダルの店舗選択を複数選択に変更する**

以下のブロック：
```tsx
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
を以下に置き換える：
```tsx
          <div>
            <p className="mb-1 text-sm text-neutral-600">利用店舗</p>
            <div className="flex flex-wrap gap-3">
              {stores.map((s) => (
                <label key={s.id} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.storeIds.includes(s.id)}
                    onChange={() => toggleEditStore(s.id)}
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
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

- [ ] **Step 7: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 8: 既存の関連テストが壊れていないことを確認する**

Run: `npx vitest run app/actions/search-customers.test.ts app/actions/manage-customers.test.ts`
Expected: 全件PASS

- [ ] **Step 9: Commit**

```bash
git add "app/admin/(dashboard)/customers/page.tsx"
git commit -m "feat: switch customer list to multi-select used stores

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 7: 最終検証

- [ ] **Step 1: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 2: Lint**

Run: `npx eslint .`
Expected: エラーなし

- [ ] **Step 3: 全テスト実行**

Run: `npx vitest run`
Expected: 既存テストを含め全件PASS

- [ ] **Step 4: ユーザーへの確認事項**

1. Task 1で案内した通り、マイグレーションファイルへのデータ移行SQL追加とマイグレーション適用が必要
2. `app/admin/(dashboard)/reservations/new/page.tsx`の顧客検索結果表示に店舗情報が含まれていないか実装時に再確認する（現状は氏名のみ表示のため影響なしの見込み）

## 完了条件

- Task 1〜6のコミットが完了している
- `npx tsc --noEmit` / `npx eslint .` / `npx vitest run` がすべてエラーなしで通る
- ユーザーがマイグレーションを適用し、実機で利用店舗の複数選択・予約時の自動追加を確認する
