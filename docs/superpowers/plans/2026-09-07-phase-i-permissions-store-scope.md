# Phase I: 権限設定＋店舗スコープ表示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ロール（本部／店長／一般）ごとにサイドバーの各ページ単位で「編集」「閲覧」「非表示」を設定できるようにする。また、店舗別データ（メール／LINE配信管理・メニュー管理・顧客ステータス設定・顧客の来店履歴を除く）を、閲覧している管理者の所属店舗分のみに絞り込む。

**Architecture:** 新規`RolePagePermission`テーブルで権限をロール×ページ単位に保存し、ログイン時のJWTコールバックで`hiddenPageKeys`/`viewOnlyPageKeys`をセッションに埋め込む。非表示ページは`middleware.ts`のリダイレクト判定とサイドバーの描画フィルタの両方で反映し、閲覧のみのページは共通コンポーネント`PermissionGate`でページ全体を一括して操作不可にする（ボタン単位の個別制御は行わない、設計上の意図的な簡略化）。店舗スコープは`getCurrentAdminStoreScope()`（hqロールは常に無制限）をクライアント側の8画面から呼び出し、店舗選択肢や一覧をフィルタする（Server Action自体には`auth()`ベースの強制はかけない——既存の許容済みトレードオフを踏襲）。

**Tech Stack:** Next.js (App Router) / TypeScript / Prisma (PostgreSQL) / NextAuth v5 (beta) / Tailwind CSS v4 / Vitest

**関連ドキュメント:** `docs/superpowers/specs/2026-09-07-phase-i-permissions-store-scope-design.md`

**前提:** Phase A〜H（実装順序上先に完了。本Planが依存する主な状態：`components/admin/admin-header.tsx`・`components/admin/settings-nav.tsx`・`app/admin/(dashboard)/permissions/page.tsx`（Phase Gのプレースホルダー）・`app/actions/manage-admins.ts`・`AdminStore`テーブル（Phase H）・`app/actions/search-customers.ts`の`storeIds`パラメータ（Phase B）・`app/actions/manage-campaigns.ts`の`storeIds`/`storeNames`（Phase D）・Phase Eのスタッフ管理ページ）。

---

### Task 1: Prisma schema — `RolePagePermission`テーブルを追加

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: `PermissionLevel`enumと`RolePagePermission`モデルを追加する**

`prisma/schema.prisma`の末尾に以下を追加する：

```prisma

model RolePagePermission {
  id      Int             @id @default(autoincrement())
  role    AdminRole
  pageKey String          @map("page_key") @db.VarChar(100)
  level   PermissionLevel @default(edit)

  @@unique([role, pageKey])
  @@map("role_page_permissions")
}

enum PermissionLevel {
  edit
  view
  hidden

  @@map("permission_level")
}
```

- [ ] **Step 2: Prisma Clientを再生成する**

Run: `npx prisma generate`
Expected: `Generated Prisma Client`

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): add RolePagePermission table for per-role page access control

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

**⚠️ ユーザーへの依頼事項:** `npx prisma migrate dev --name add_role_page_permissions`でマイグレーションを作成・適用する。行が存在しないロール×ページの組み合わせは「編集可能」として扱われる（Task 4で実装するJWTコールバックが`hidden`/`view`の行だけを検索するため）ので、初期シードは必須ではないが、`/admin/permissions`の一覧を全ロール×全ページ分の行が最初から揃った状態で見せたい場合は以下のようなSQLで`edit`のデフォルト行を作成しておくとよい（任意）：
```sql
INSERT INTO "role_page_permissions" ("role", "page_key", "level")
SELECT r.role, p.page_key, 'edit'
FROM (VALUES ('hq'), ('manager'), ('staff')) AS r(role)
CROSS JOIN (VALUES
  ('/admin/dashboard'), ('/admin/calendar'), ('/admin/customers'), ('/admin/customer-statuses'),
  ('/admin/reservations/new'), ('/admin/menu'), ('/admin/campaigns'), ('/admin/staff'),
  ('/admin/stores'), ('/admin/reports'), ('/admin/segment-campaigns'),
  ('/admin/cron-logs'), ('/admin/accounts'), ('/admin/permissions'), ('/admin/terms')
) AS p(page_key)
ON CONFLICT ("role", "page_key") DO NOTHING;
```

---

### Task 2: `app/actions/manage-permissions.ts`（新規）

**Files:**
- Create: `app/actions/manage-permissions.ts`
- Test: `app/actions/manage-permissions.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/manage-permissions.test.ts`を以下の内容で新規作成する：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listPermissions, setPermission } from "./manage-permissions";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    rolePagePermission: { findMany: vi.fn(), upsert: vi.fn() },
  },
}));

describe("listPermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all stored role/page permission rows", async () => {
    vi.mocked(prisma.rolePagePermission.findMany).mockResolvedValue([
      { role: "staff", pageKey: "/admin/campaigns", level: "hidden" },
      { role: "manager", pageKey: "/admin/reports", level: "view" },
    ] as never);

    const result = await listPermissions();

    expect(result).toEqual([
      { role: "staff", pageKey: "/admin/campaigns", level: "hidden" },
      { role: "manager", pageKey: "/admin/reports", level: "view" },
    ]);
  });
});

describe("setPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts the permission level for a role/page combination", async () => {
    vi.mocked(prisma.rolePagePermission.upsert).mockResolvedValue({} as never);

    await setPermission("staff", "/admin/campaigns", "hidden");

    expect(prisma.rolePagePermission.upsert).toHaveBeenCalledWith({
      where: { role_pageKey: { role: "staff", pageKey: "/admin/campaigns" } },
      create: { role: "staff", pageKey: "/admin/campaigns", level: "hidden" },
      update: { level: "hidden" },
    });
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run app/actions/manage-permissions.test.ts`
Expected: FAIL（`./manage-permissions`が存在しない）

- [ ] **Step 3: 実装する**

`app/actions/manage-permissions.ts`を以下の内容で新規作成する：

```ts
"use server";

import { prisma } from "@/lib/db";
import type { AdminRole, PermissionLevel } from "@prisma/client";

export interface PagePermissionItem {
  role: AdminRole;
  pageKey: string;
  level: PermissionLevel;
}

export async function listPermissions(): Promise<PagePermissionItem[]> {
  return prisma.rolePagePermission.findMany();
}

export async function setPermission(
  role: AdminRole,
  pageKey: string,
  level: PermissionLevel,
): Promise<void> {
  await prisma.rolePagePermission.upsert({
    where: { role_pageKey: { role, pageKey } },
    create: { role, pageKey, level },
    update: { level },
  });
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run app/actions/manage-permissions.test.ts`
Expected: PASS（2件）

- [ ] **Step 5: Commit**

```bash
git add app/actions/manage-permissions.ts app/actions/manage-permissions.test.ts
git commit -m "feat: add manage-permissions server actions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 3: `app/actions/current-admin-scope.ts`（新規）

**Files:**
- Create: `app/actions/current-admin-scope.ts`
- Test: `app/actions/current-admin-scope.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/current-admin-scope.test.ts`を以下の内容で新規作成する：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCurrentAdminStoreScope } from "./current-admin-scope";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/lib/db", () => ({
  prisma: {
    adminStore: { findMany: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

describe("getCurrentAdminStoreScope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unrestricted for an hq admin", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "hq" } } as never);

    const result = await getCurrentAdminStoreScope();

    expect(result).toEqual({ isUnrestricted: true, storeIds: [] });
    expect(prisma.adminStore.findMany).not.toHaveBeenCalled();
  });

  it("returns the admin's assigned store ids for a manager", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", role: "manager" } } as never);
    vi.mocked(prisma.adminStore.findMany).mockResolvedValue([
      { storeId: 2 },
      { storeId: 5 },
    ] as never);

    const result = await getCurrentAdminStoreScope();

    expect(result).toEqual({ isUnrestricted: false, storeIds: [2, 5] });
    expect(prisma.adminStore.findMany).toHaveBeenCalledWith({ where: { adminId: 3 } });
  });

  it("returns unrestricted when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const result = await getCurrentAdminStoreScope();

    expect(result).toEqual({ isUnrestricted: true, storeIds: [] });
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run app/actions/current-admin-scope.test.ts`
Expected: FAIL（`./current-admin-scope`が存在しない）

- [ ] **Step 3: 実装する**

`app/actions/current-admin-scope.ts`を以下の内容で新規作成する：

```ts
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export interface AdminStoreScope {
  isUnrestricted: boolean; // hqロールならtrue（常に全店舗）
  storeIds: number[];
}

export async function getCurrentAdminStoreScope(): Promise<AdminStoreScope> {
  const session = await auth();
  if (!session?.user) {
    return { isUnrestricted: true, storeIds: [] };
  }
  if (session.user.role === "hq") {
    return { isUnrestricted: true, storeIds: [] };
  }

  const adminId = Number(session.user.id);
  const stores = await prisma.adminStore.findMany({ where: { adminId } });
  return { isUnrestricted: false, storeIds: stores.map((s) => s.storeId) };
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run app/actions/current-admin-scope.test.ts`
Expected: PASS（3件）

- [ ] **Step 5: Commit**

```bash
git add app/actions/current-admin-scope.ts app/actions/current-admin-scope.test.ts
git commit -m "feat: add getCurrentAdminStoreScope server action

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 4: セッションへの`hiddenPageKeys`/`viewOnlyPageKeys`の反映

**Files:**
- Modify: `types/next-auth.d.ts`
- Modify: `lib/auth/config.ts`

- [ ] **Step 1: `types/next-auth.d.ts`に型を追加する**

`types/next-auth.d.ts`の以下のブロック：
```ts
declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: string;
    };
    needsProfileCompletion?: boolean;
    pendingLineUserId?: string;
    pendingLineName?: string;
  }
}
```
を以下に置き換える：
```ts
declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: string;
    };
    needsProfileCompletion?: boolean;
    pendingLineUserId?: string;
    pendingLineName?: string;
    hiddenPageKeys?: string[];
    viewOnlyPageKeys?: string[];
  }
}
```

同ファイルの以下のブロック：
```ts
declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    needsProfileCompletion?: boolean;
    pendingLineUserId?: string;
    pendingLineName?: string;
  }
}
```
を以下に置き換える：
```ts
declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    needsProfileCompletion?: boolean;
    pendingLineUserId?: string;
    pendingLineName?: string;
    hiddenPageKeys?: string[];
    viewOnlyPageKeys?: string[];
  }
}
```

- [ ] **Step 2: `lib/auth/config.ts`のJWTコールバックでロールの権限を読み込む**

`lib/auth/config.ts`冒頭のimportブロック：
```ts
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import LineProvider from "next-auth/providers/line";
import { authorizeMember } from "./member-credentials";
import { authorizeAdmin } from "./admin-credentials";
import { findOrFlagLineMember } from "./line-member";
```
を以下に置き換える：
```ts
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import LineProvider from "next-auth/providers/line";
import { authorizeMember } from "./member-credentials";
import { authorizeAdmin } from "./admin-credentials";
import { findOrFlagLineMember } from "./line-member";
import { prisma } from "@/lib/db";
import type { AdminRole } from "@prisma/client";

const ADMIN_ROLES = new Set<AdminRole>(["hq", "manager", "staff"]);

function isAdminRole(role: string): role is AdminRole {
  return ADMIN_ROLES.has(role as AdminRole);
}
```

同ファイルの以下のブロック：
```ts
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: string }).role;
      }
```
を以下に置き換える：
```ts
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: string }).role;

        if (isAdminRole(token.role)) {
          const permissions = await prisma.rolePagePermission.findMany({
            where: { role: token.role },
          });
          token.hiddenPageKeys = permissions
            .filter((p) => p.level === "hidden")
            .map((p) => p.pageKey);
          token.viewOnlyPageKeys = permissions
            .filter((p) => p.level === "view")
            .map((p) => p.pageKey);
        } else {
          token.hiddenPageKeys = [];
          token.viewOnlyPageKeys = [];
        }
      }
```

同ファイルの以下のブロック：
```ts
    async session({ session, token }) {
      session.user.id = (token.id as string) ?? "";
      session.user.role = (token.role as string) ?? "";
      session.needsProfileCompletion = token.needsProfileCompletion as boolean | undefined;
      session.pendingLineUserId = token.pendingLineUserId as string | undefined;
      session.pendingLineName = token.pendingLineName as string | undefined;
      return session;
    },
```
を以下に置き換える：
```ts
    async session({ session, token }) {
      session.user.id = (token.id as string) ?? "";
      session.user.role = (token.role as string) ?? "";
      session.needsProfileCompletion = token.needsProfileCompletion as boolean | undefined;
      session.pendingLineUserId = token.pendingLineUserId as string | undefined;
      session.pendingLineName = token.pendingLineName as string | undefined;
      session.hiddenPageKeys = (token.hiddenPageKeys as string[] | undefined) ?? [];
      session.viewOnlyPageKeys = (token.viewOnlyPageKeys as string[] | undefined) ?? [];
      return session;
    },
```

（既知の制約：権限設定を変更しても、既にログイン済みのセッションには次回ログインまで反映されない。`role`自体が既に同じ制約を持っているため、既存の設計と一貫性がある。）

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: 既存の関連テストが壊れていないことを確認する**

Run: `npx vitest run`
Expected: 全件PASS（`config.ts`自体にユニットテストは存在しないため、既存テストへの影響はないはず）

- [ ] **Step 5: Commit**

```bash
git add types/next-auth.d.ts lib/auth/config.ts
git commit -m "feat: propagate hidden/view-only page keys from role permissions into the session

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 5: 非表示ページへのアクセスをリダイレクトする（`access-control.ts`・`middleware.ts`）

**Files:**
- Modify: `lib/auth/access-control.ts`
- Test: `lib/auth/access-control.test.ts`
- Modify: `middleware.ts`

- [ ] **Step 1: 失敗するテストを追加する**

`lib/auth/access-control.test.ts`の末尾（最後の`});`の直前、`it("allows any other route through untouched", ...)`ブロックの直後）に以下を追加する：

```ts

  it("redirects away from a page hidden for the current role", () => {
    expect(
      resolveAccessDecision("/admin/campaigns", "staff", ["/admin/campaigns"]),
    ).toEqual({ type: "redirect", to: "/admin/dashboard" });
  });

  it("redirects away from a subpath of a hidden page", () => {
    expect(
      resolveAccessDecision("/admin/customers/5", "staff", ["/admin/customers"]),
    ).toEqual({ type: "redirect", to: "/admin/dashboard" });
  });

  it("allows a page that is not in the hidden list", () => {
    expect(
      resolveAccessDecision("/admin/dashboard", "staff", ["/admin/campaigns"]),
    ).toEqual({ type: "allow" });
  });

  it("never redirects away from the dashboard itself, even if listed as hidden", () => {
    expect(
      resolveAccessDecision("/admin/dashboard", "staff", ["/admin/dashboard"]),
    ).toEqual({ type: "allow" });
  });

  it("treats an omitted hiddenPageKeys as no restrictions", () => {
    expect(resolveAccessDecision("/admin/campaigns", "staff")).toEqual({ type: "allow" });
  });
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run lib/auth/access-control.test.ts`
Expected: FAIL（`resolveAccessDecision`はまだ3引数目を受け取らない）

- [ ] **Step 3: 実装する**

`lib/auth/access-control.ts`を以下の内容に置き換える：

```ts
export type AccessDecision = { type: "allow" } | { type: "redirect"; to: string };

const ADMIN_ROLES = new Set(["hq", "manager", "staff"]);

export function resolveAccessDecision(
  pathname: string,
  role: string | undefined,
  hiddenPageKeys: string[] = [],
): AccessDecision {
  const isAdminLoginPage = pathname.startsWith("/admin/login");
  const isAdminArea = pathname.startsWith("/admin") && !isAdminLoginPage;
  const isMemberArea = pathname.startsWith("/mypage");

  if (isAdminArea && !(role && ADMIN_ROLES.has(role))) {
    return { type: "redirect", to: "/admin/login" };
  }

  if (isMemberArea && role !== "member") {
    return { type: "redirect", to: "/login" };
  }

  const isHidden =
    isAdminArea &&
    pathname !== "/admin/dashboard" &&
    hiddenPageKeys.some((key) => pathname === key || pathname.startsWith(`${key}/`));

  if (isHidden) {
    return { type: "redirect", to: "/admin/dashboard" };
  }

  return { type: "allow" };
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run lib/auth/access-control.test.ts`
Expected: PASS（12件）

- [ ] **Step 5: `middleware.ts`から`hiddenPageKeys`を渡す**

`middleware.ts`の以下の行：
```ts
  const decision = resolveAccessDecision(req.nextUrl.pathname, req.auth?.user?.role);
```
を以下に置き換える：
```ts
  const decision = resolveAccessDecision(
    req.nextUrl.pathname,
    req.auth?.user?.role,
    req.auth?.hiddenPageKeys ?? [],
  );
```

- [ ] **Step 6: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 7: Commit**

```bash
git add lib/auth/access-control.ts lib/auth/access-control.test.ts middleware.ts
git commit -m "feat: redirect away from admin pages hidden for the current role

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 6: `components/admin/permission-gate.tsx`（新規）

**Files:**
- Create: `components/admin/permission-gate.tsx`

- [ ] **Step 1: コンポーネントを作成する**

`components/admin/permission-gate.tsx`を以下の内容で新規作成する（ページ全体を一括で操作不可にする簡易的な実装。ボタン単位の個別制御は行わない——設計上の意図的な簡略化）：

```tsx
"use client";

import { usePathname } from "next/navigation";

export interface PermissionGateProps {
  viewOnlyPageKeys: string[];
  children: React.ReactNode;
}

export function PermissionGate({ viewOnlyPageKeys, children }: PermissionGateProps) {
  const pathname = usePathname();
  const isViewOnly = viewOnlyPageKeys.some(
    (key) => pathname === key || pathname.startsWith(`${key}/`),
  );

  if (!isViewOnly) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p
        role="status"
        className="rounded-lg border border-neutral-200 bg-neutral-100 p-3 text-sm text-neutral-700"
      >
        このページは閲覧のみ許可されています。
      </p>
      <div className="pointer-events-none opacity-60">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし（まだどこからも使われていないため未使用警告は出ない）

- [ ] **Step 3: Commit**

```bash
git add components/admin/permission-gate.tsx
git commit -m "feat: add PermissionGate component for view-only page access

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 7: `layout.tsx`・`settings-nav.tsx` — 非表示ページのナビ除外＋`PermissionGate`の組み込み

**Files:**
- Modify: `app/admin/(dashboard)/layout.tsx`
- Modify: `components/admin/settings-nav.tsx`

- [ ] **Step 1: `layout.tsx`にセッション取得と非表示フィルタを追加する**

`app/admin/(dashboard)/layout.tsx`の以下の行：
```tsx
import { AdminHeader } from "@/components/admin/admin-header";
import { SettingsNav } from "@/components/admin/settings-nav";
```
を以下に置き換える：
```tsx
import { auth } from "@/auth";
import { AdminHeader } from "@/components/admin/admin-header";
import { SettingsNav } from "@/components/admin/settings-nav";
import { PermissionGate } from "@/components/admin/permission-gate";
```

同ファイルの以下の行：
```tsx
export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
```
を以下に置き換える：
```tsx
export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const hiddenPageKeys = session?.hiddenPageKeys ?? [];
  const viewOnlyPageKeys = session?.viewOnlyPageKeys ?? [];
  const visibleNavItems = NAV_ITEMS.filter((item) => !hiddenPageKeys.includes(item.href));

  return (
```

同ファイルの以下の行：
```tsx
        <nav className="mt-6 flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
```
を以下に置き換える：
```tsx
        <nav className="mt-6 flex flex-col gap-1">
          {visibleNavItems.map(({ href, label, icon: Icon }) => (
```

同ファイルの以下の行：
```tsx
          <SettingsNav />
        </nav>
```
を以下に置き換える：
```tsx
          <SettingsNav hiddenPageKeys={hiddenPageKeys} />
        </nav>
```

同ファイルの以下の行：
```tsx
        <AdminHeader />
        <main className="flex-1 bg-neutral-50 p-6">{children}</main>
```
を以下に置き換える：
```tsx
        <AdminHeader />
        <main className="flex-1 bg-neutral-50 p-6">
          <PermissionGate viewOnlyPageKeys={viewOnlyPageKeys}>{children}</PermissionGate>
        </main>
```

- [ ] **Step 2: `settings-nav.tsx`が`hiddenPageKeys`を受け取り、配下のリンクを絞り込むようにする**

`components/admin/settings-nav.tsx`の以下の行：
```tsx
export function SettingsNav() {
  const pathname = usePathname();
  const isInSettings = SETTINGS_NAV_ITEMS.some((item) => pathname.startsWith(item.href));
  const [open, setOpen] = useState(isInSettings);
```
を以下に置き換える：
```tsx
export interface SettingsNavProps {
  hiddenPageKeys?: string[];
}

export function SettingsNav({ hiddenPageKeys = [] }: SettingsNavProps) {
  const pathname = usePathname();
  const visibleItems = SETTINGS_NAV_ITEMS.filter((item) => !hiddenPageKeys.includes(item.href));
  const isInSettings = visibleItems.some((item) => pathname.startsWith(item.href));
  const [open, setOpen] = useState(isInSettings);

  if (visibleItems.length === 0) {
    return null;
  }
```

同ファイルの以下の行：
```tsx
      {open && (
        <div className="ml-4 flex flex-col gap-1 border-l border-neutral-200 pl-2">
          {SETTINGS_NAV_ITEMS.map(({ href, label, icon: Icon }) => (
```
を以下に置き換える：
```tsx
      {open && (
        <div className="ml-4 flex flex-col gap-1 border-l border-neutral-200 pl-2">
          {visibleItems.map(({ href, label, icon: Icon }) => (
```

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: Commit**

```bash
git add "app/admin/(dashboard)/layout.tsx" components/admin/settings-nav.tsx
git commit -m "feat: hide nav items for hidden pages and gate view-only pages in the layout

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 8: `permissions/page.tsx` — Phase Gのプレースホルダーを置き換える

**Files:**
- Modify: `app/admin/(dashboard)/permissions/page.tsx`

- [ ] **Step 1: ページ全体を書き換える**

`app/admin/(dashboard)/permissions/page.tsx` を以下の内容に置き換える（行＝ページ、列＝ロールのマトリクス表。各セルは`<select>`で`setPermission`を呼ぶ）：

```tsx
"use client";

import { useEffect, useState } from "react";
import { listPermissions, setPermission, type PagePermissionItem } from "@/app/actions/manage-permissions";
import type { AdminRole, PermissionLevel } from "@prisma/client";

const ROLES: AdminRole[] = ["hq", "manager", "staff"];
const ROLE_LABEL: Record<AdminRole, string> = { hq: "本部", manager: "店長", staff: "一般" };

const PAGE_KEYS: { key: string; label: string }[] = [
  { key: "/admin/dashboard", label: "ダッシュボード" },
  { key: "/admin/calendar", label: "予約カレンダー" },
  { key: "/admin/customers", label: "顧客管理" },
  { key: "/admin/customer-statuses", label: "ステータス設定" },
  { key: "/admin/reservations/new", label: "電話予約登録" },
  { key: "/admin/menu", label: "メニュー・料金管理" },
  { key: "/admin/campaigns", label: "キャンペーン管理" },
  { key: "/admin/staff", label: "スタッフ管理" },
  { key: "/admin/stores", label: "店舗管理" },
  { key: "/admin/reports", label: "売上・月報レポート" },
  { key: "/admin/segment-campaigns", label: "メール／LINE配信管理" },
  { key: "/admin/cron-logs", label: "Cronジョブ実行ログ" },
  { key: "/admin/accounts", label: "アカウント管理" },
  { key: "/admin/permissions", label: "権限設定" },
  { key: "/admin/terms", label: "利用規約設定" },
];

function levelFor(
  permissions: PagePermissionItem[],
  role: AdminRole,
  pageKey: string,
): PermissionLevel {
  return permissions.find((p) => p.role === role && p.pageKey === pageKey)?.level ?? "edit";
}

export default function AdminPermissionsPage() {
  const [permissions, setPermissions] = useState<PagePermissionItem[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  function reload() {
    listPermissions().then(setPermissions);
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleChange(role: AdminRole, pageKey: string, level: PermissionLevel) {
    const cellKey = `${role}:${pageKey}`;
    setSavingKey(cellKey);
    await setPermission(role, pageKey, level);
    setPermissions((prev) => {
      const rest = prev.filter((p) => !(p.role === role && p.pageKey === pageKey));
      return [...rest, { role, pageKey, level }];
    });
    setSavingKey(null);
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-neutral-500">
            <th className="p-3">ページ</th>
            {ROLES.map((role) => (
              <th key={role} className="p-3">
                {ROLE_LABEL[role]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PAGE_KEYS.map(({ key, label }) => (
            <tr key={key} className="border-b border-neutral-100 last:border-0">
              <td className="p-3">{label}</td>
              {ROLES.map((role) => {
                const cellKey = `${role}:${key}`;
                return (
                  <td key={role} className="p-3">
                    <select
                      value={levelFor(permissions, role, key)}
                      onChange={(e) => handleChange(role, key, e.target.value as PermissionLevel)}
                      disabled={savingKey === cellKey}
                      className="h-9 rounded-md border border-neutral-300 px-2 text-sm"
                    >
                      <option value="edit">編集</option>
                      <option value="view">閲覧</option>
                      <option value="hidden">非表示</option>
                    </select>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: 既存の関連テストが壊れていないことを確認する**

Run: `npx vitest run app/actions/manage-permissions.test.ts`
Expected: 全件PASS

- [ ] **Step 4: Commit**

```bash
git add "app/admin/(dashboard)/permissions/page.tsx"
git commit -m "feat: implement role x page permission matrix UI

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 9: 店舗スコープ — `dashboard/page.tsx`・`reports/page.tsx`（単一店舗選択の絞り込み）

**Files:**
- Modify: `app/admin/(dashboard)/dashboard/page.tsx`
- Modify: `app/admin/(dashboard)/reports/page.tsx`

両ページとも「全店舗」を含む単一`<select>`で店舗を絞り込む同じ構造のため、同じパターンを適用する。

- [ ] **Step 1: `dashboard/page.tsx`を更新する**

`app/admin/(dashboard)/dashboard/page.tsx`の以下の行：
```tsx
import { useEffect, useState } from "react";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { getDashboardSummary, type DashboardSummary } from "@/app/actions/dashboard-summary";
```
を以下に置き換える：
```tsx
import { useEffect, useState } from "react";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { getDashboardSummary, type DashboardSummary } from "@/app/actions/dashboard-summary";
import {
  getCurrentAdminStoreScope,
  type AdminStoreScope,
} from "@/app/actions/current-admin-scope";
```

同ファイルの以下の行：
```tsx
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    listStores().then(setStores);
  }, []);
```
を以下に置き換える：
```tsx
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [scope, setScope] = useState<AdminStoreScope>({ isUnrestricted: true, storeIds: [] });

  useEffect(() => {
    listStores().then(setStores);
    getCurrentAdminStoreScope().then((s) => {
      setScope(s);
      if (!s.isUnrestricted && s.storeIds.length === 1) {
        setStoreId(s.storeIds[0]);
      }
    });
  }, []);

  const visibleStores = scope.isUnrestricted
    ? stores
    : stores.filter((s) => scope.storeIds.includes(s.id));
```

同ファイルの以下の行：
```tsx
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
```
を以下に置き換える：
```tsx
          {visibleStores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
```

- [ ] **Step 2: `reports/page.tsx`を同じパターンで更新する**

`app/admin/(dashboard)/reports/page.tsx`のimportブロックに以下を追加する（`listStores`のimport行の直後）：
```tsx
import {
  getCurrentAdminStoreScope,
  type AdminStoreScope,
} from "@/app/actions/current-admin-scope";
```

同ファイルの以下の行：
```tsx
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [startDate, setStartDate] = useState(defaultStartDate());
  const [endDate, setEndDate] = useState(defaultEndDate());
  const [storeId, setStoreId] = useState<number | null>(null);
  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listStores().then(setStores);
  }, []);
```
を以下に置き換える：
```tsx
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [startDate, setStartDate] = useState(defaultStartDate());
  const [endDate, setEndDate] = useState(defaultEndDate());
  const [storeId, setStoreId] = useState<number | null>(null);
  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<AdminStoreScope>({ isUnrestricted: true, storeIds: [] });

  useEffect(() => {
    listStores().then(setStores);
    getCurrentAdminStoreScope().then((s) => {
      setScope(s);
      if (!s.isUnrestricted && s.storeIds.length === 1) {
        setStoreId(s.storeIds[0]);
      }
    });
  }, []);

  const visibleStores = scope.isUnrestricted
    ? stores
    : stores.filter((s) => scope.storeIds.includes(s.id));
```

`reports/page.tsx`内の店舗`<select>`の`{stores.map((s) => (...))}`を`{visibleStores.map((s) => (...))}`に置き換える（`dashboard/page.tsx`のStep 1と同じ変更をこのページの`<select>`内にも適用する）。

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: Commit**

```bash
git add "app/admin/(dashboard)/dashboard/page.tsx" "app/admin/(dashboard)/reports/page.tsx"
git commit -m "feat: scope dashboard and sales report store filters to the admin's stores

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 10: 店舗スコープ — `calendar/page.tsx`・`staff/page.tsx`（自動選択パターン）

**Files:**
- Modify: `app/admin/(dashboard)/calendar/page.tsx`
- Modify: `app/admin/(dashboard)/staff/page.tsx`

- [ ] **Step 1: `calendar/page.tsx`を更新する**

`app/admin/(dashboard)/calendar/page.tsx`の以下の行：
```tsx
import { listStores, type StoreListItem } from "@/app/actions/stores";
```
の直後に以下を追加する：
```tsx
import {
  getCurrentAdminStoreScope,
  type AdminStoreScope,
} from "@/app/actions/current-admin-scope";
```

同ファイルの以下の行：
```tsx
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [date, setDate] = useState(todayIso());
  const [reservations, setReservations] = useState<CalendarReservation[]>([]);

  useEffect(() => {
    listStores().then((list) => {
      setStores(list);
      if (list.length > 0) setStoreId(list[0].id);
    });
  }, []);
```
を以下に置き換える：
```tsx
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [date, setDate] = useState(todayIso());
  const [reservations, setReservations] = useState<CalendarReservation[]>([]);
  const [scope, setScope] = useState<AdminStoreScope>({ isUnrestricted: true, storeIds: [] });

  useEffect(() => {
    Promise.all([listStores(), getCurrentAdminStoreScope()]).then(([list, s]) => {
      setStores(list);
      setScope(s);
      const visible = s.isUnrestricted ? list : list.filter((store) => s.storeIds.includes(store.id));
      if (visible.length > 0) setStoreId(visible[0].id);
    });
  }, []);

  const visibleStores = scope.isUnrestricted
    ? stores
    : stores.filter((s) => scope.storeIds.includes(s.id));
```

同ファイルの以下の行：
```tsx
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
```
を以下に置き換える：
```tsx
          {visibleStores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
```

- [ ] **Step 2: `staff/page.tsx`を更新する（Phase Eで導入した店舗フィルターに絞り込みを追加）**

`app/admin/(dashboard)/staff/page.tsx`の以下の行：
```tsx
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { Modal } from "@/components/ui/modal";
```
を以下に置き換える：
```tsx
import { listStores, type StoreListItem } from "@/app/actions/stores";
import {
  getCurrentAdminStoreScope,
  type AdminStoreScope,
} from "@/app/actions/current-admin-scope";
import { Modal } from "@/components/ui/modal";
```

同ファイルの以下の行：
```tsx
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [storeFilter, setStoreFilter] = useState<number | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
```
を以下に置き換える：
```tsx
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [storeFilter, setStoreFilter] = useState<number | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [scope, setScope] = useState<AdminStoreScope>({ isUnrestricted: true, storeIds: [] });
```

同ファイルの以下の行：
```tsx
  useEffect(() => {
    reload();
    listStores().then(setStores);
  }, []);
```
を以下に置き換える：
```tsx
  useEffect(() => {
    reload();
    listStores().then(setStores);
    getCurrentAdminStoreScope().then((s) => {
      setScope(s);
      if (!s.isUnrestricted && s.storeIds.length === 1) {
        setStoreFilter(s.storeIds[0]);
      }
    });
  }, []);

  const visibleStoreOptions = scope.isUnrestricted
    ? stores
    : stores.filter((s) => scope.storeIds.includes(s.id));
```

同ファイルの店舗フィルター用`<select>`ブロック内、以下の行：
```tsx
        <select
          value={storeFilter ?? ""}
          onChange={(e) => setStoreFilter(e.target.value ? Number(e.target.value) : null)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        >
          <option value="">全店舗</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
```
を以下に置き換える：
```tsx
        <select
          value={storeFilter ?? ""}
          onChange={(e) => setStoreFilter(e.target.value ? Number(e.target.value) : null)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        >
          <option value="">全店舗</option>
          {visibleStoreOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
```

（新規登録モーダル・編集モーダル内の所属店舗`<select>`の選択肢はこのTaskでは絞り込まない——スタッフの異動先選択には全店舗から選べる必要があるため、店舗スコープの絞り込みは一覧のフィルターのみに適用する。）

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: Commit**

```bash
git add "app/admin/(dashboard)/calendar/page.tsx" "app/admin/(dashboard)/staff/page.tsx"
git commit -m "feat: scope calendar and staff store filters to the admin's stores

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 11: 店舗スコープ — `customers/page.tsx`・`reservations/new/page.tsx`

**Files:**
- Modify: `app/admin/(dashboard)/customers/page.tsx`
- Modify: `app/admin/(dashboard)/reservations/new/page.tsx`

- [ ] **Step 1: `customers/page.tsx`を更新する**

`app/admin/(dashboard)/customers/page.tsx`（Phase Bで利用店舗の複数選択に対応済み）の`import`ブロックに以下を追加する（`listStores`のimportの直後）：
```tsx
import {
  getCurrentAdminStoreScope,
  type AdminStoreScope,
} from "@/app/actions/current-admin-scope";
```

コンポーネント内の状態宣言部分に以下を追加する（`stores`のuseStateの直後）：
```tsx
  const [scope, setScope] = useState<AdminStoreScope>({ isUnrestricted: true, storeIds: [] });
```

`listStores().then(setStores);`を呼んでいる`useEffect`（初回マウント時に店舗・ステータス一覧を読み込むもの）に、以下を追加する：
```tsx
    getCurrentAdminStoreScope().then(setScope);
```

`reload()`関数（`searchCustomers({...})`を呼び出している箇所）の呼び出しパラメータに`storeIds`を追加する。既存の`searchCustomers({ ... })`呼び出しの引数オブジェクトに以下のフィールドを追加する：
```tsx
      storeIds: scope.isUnrestricted ? undefined : scope.storeIds,
```
（`reload`が依存する`useEffect`の依存配列に`scope`を追加し、`scope`が確定してから絞り込まれた一覧が取得されるようにする。）

新規登録モーダル・編集モーダル内の利用店舗チェックボックス一覧はこのTaskでは絞り込まない（Phase Eのスタッフ編集と同様、顧客の利用店舗登録自体は全店舗から選べる必要があるため）。

- [ ] **Step 2: `reservations/new/page.tsx`を更新する**

`app/admin/(dashboard)/reservations/new/page.tsx`の以下の行：
```tsx
import { listStores, type StoreListItem } from "@/app/actions/stores";
```
の直後に以下を追加する：
```tsx
import {
  getCurrentAdminStoreScope,
  type AdminStoreScope,
} from "@/app/actions/current-admin-scope";
```

同ファイルの以下の行：
```tsx
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);
```
を以下に置き換える：
```tsx
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [scope, setScope] = useState<AdminStoreScope>({ isUnrestricted: true, storeIds: [] });
```

同ファイルの以下の行：
```tsx
  useEffect(() => {
    listStores().then(setStores);
    listCourseCategories().then(setCategories);
  }, []);
```
を以下に置き換える：
```tsx
  useEffect(() => {
    listStores().then(setStores);
    listCourseCategories().then(setCategories);
    getCurrentAdminStoreScope().then((s) => {
      setScope(s);
      if (!s.isUnrestricted && s.storeIds.length === 1) {
        setStoreId(s.storeIds[0]);
      }
    });
  }, []);

  const visibleStores = scope.isUnrestricted
    ? stores
    : stores.filter((s) => scope.storeIds.includes(s.id));
```

同ファイルの店舗選択用`<select>`内、`{stores.map((s) => (...))}`を`{visibleStores.map((s) => (...))}`に置き換える。

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: 既存の関連テストが壊れていないことを確認する**

Run: `npx vitest run app/actions/search-customers.test.ts`
Expected: 全件PASS

- [ ] **Step 5: Commit**

```bash
git add "app/admin/(dashboard)/customers/page.tsx" "app/admin/(dashboard)/reservations/new/page.tsx"
git commit -m "feat: scope customer search and phone reservation store selection to the admin's stores

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 12: 店舗スコープ — `campaigns/page.tsx`・`stores/page.tsx`

**Files:**
- Modify: `app/admin/(dashboard)/campaigns/page.tsx`
- Modify: `app/admin/(dashboard)/stores/page.tsx`

- [ ] **Step 1: `campaigns/page.tsx`を更新する（一覧をクライアント側でフィルタ）**

`app/admin/(dashboard)/campaigns/page.tsx`（Phase Dで対象店舗の複数選択に対応済み）の`import`ブロックに以下を追加する：
```tsx
import {
  getCurrentAdminStoreScope,
  type AdminStoreScope,
} from "@/app/actions/current-admin-scope";
```

コンポーネント内の状態宣言部分に以下を追加する：
```tsx
  const [scope, setScope] = useState<AdminStoreScope>({ isUnrestricted: true, storeIds: [] });
```

初回マウント時に店舗・カテゴリ・コース一覧などを読み込んでいる`useEffect`に以下を追加する：
```tsx
    getCurrentAdminStoreScope().then(setScope);
```

一覧を`campaigns.map(...)`でレンダリングしている箇所の直前（一覧取得後の変数定義部分）に、以下のフィルタ済み配列を追加し、以降のレンダリングで`campaigns`の代わりに`visibleCampaigns`を使う：
```tsx
  const visibleCampaigns = scope.isUnrestricted
    ? campaigns
    : campaigns.filter(
        (c) => c.storeIds.length === 0 || c.storeIds.some((id) => scope.storeIds.includes(id)),
      );
```

（対象店舗の複数選択チェックボックス自体（新規作成・編集モーダル）はこのTaskでは絞り込まない——本部が代理でキャンペーンを作成する場合など、どの店舗でも対象に指定できる必要があるため。）

- [ ] **Step 2: `stores/page.tsx`を更新する（一覧の絞り込み＋新規登録ボタンの非表示）**

`app/admin/(dashboard)/stores/page.tsx`の以下の行：
```tsx
import { Plus } from "lucide-react";
import {
  listAllStoresForManagement,
  updateStoreDetails,
  createStore,
  type ManagedStore,
} from "@/app/actions/manage-stores";
import { Modal } from "@/components/ui/modal";
```
を以下に置き換える：
```tsx
import { Plus } from "lucide-react";
import {
  listAllStoresForManagement,
  updateStoreDetails,
  createStore,
  type ManagedStore,
} from "@/app/actions/manage-stores";
import {
  getCurrentAdminStoreScope,
  type AdminStoreScope,
} from "@/app/actions/current-admin-scope";
import { Modal } from "@/components/ui/modal";
```

同ファイルの以下の行：
```tsx
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
```
を以下に置き換える：
```tsx
  const [stores, setStores] = useState<ManagedStore[]>([]);
  const [saving, setSaving] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [scope, setScope] = useState<AdminStoreScope>({ isUnrestricted: true, storeIds: [] });

  function reload() {
    listAllStoresForManagement().then(setStores);
  }

  useEffect(() => {
    reload();
    getCurrentAdminStoreScope().then(setScope);
  }, []);

  const visibleStores = scope.isUnrestricted
    ? stores
    : stores.filter((s) => scope.storeIds.includes(s.id));
```

同ファイルの以下のブロック（Phase Aで`justify-end`化済みの見出し行）：
```tsx
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex h-10 items-center gap-1 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white"
        >
          <Plus size={16} />
          新規登録
        </button>
      </div>
```
を以下に置き換える：
```tsx
      {scope.isUnrestricted && (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex h-10 items-center gap-1 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white"
          >
            <Plus size={16} />
            新規登録
          </button>
        </div>
      )}
```

同ファイルの以下の行：
```tsx
      <div className="flex flex-col gap-4">
        {stores.map((s) => (
```
を以下に置き換える：
```tsx
      <div className="flex flex-col gap-4">
        {visibleStores.map((s) => (
```

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: Commit**

```bash
git add "app/admin/(dashboard)/campaigns/page.tsx" "app/admin/(dashboard)/stores/page.tsx"
git commit -m "feat: scope campaign and store listings to the admin's stores

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 13: 最終検証

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

Task 1で案内した通り、マイグレーション適用が必要（初期シードは任意）。また、Task 9〜12で扱った各ページの店舗フィルターが、`app/actions/manage-staff.ts`・`app/actions/manage-campaigns.ts`・`app/actions/search-customers.ts`・`app/actions/stores.ts`の現在のフィールド名（本Planの前提であるPhase A〜Hの最終形）と一致しているか、実装時に各ファイルを直接読んで確認すること（本Planの各Taskの diff は Phase A〜H の計画書に基づく想定であり、実装順序の間に他の変更が加わっていた場合は該当箇所の変数名・関数シグネチャを実際のファイルに合わせて調整する）。

## 完了条件

- Task 1〜12のコミットが完了している
- `npx tsc --noEmit` / `npx eslint .` / `npx vitest run` がすべてエラーなしで通る
- ユーザーがマイグレーションを適用し、`/admin/permissions`でのロール別ページ権限設定、および非hqロールでの店舗スコープ絞り込みを実機で確認する
