# Phase H: アカウント管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/admin/accounts`（Phase Gでプレースホルダーとして確保済み）に、管理者アカウント（`Admin`）の一覧・新規作成・編集機能を実装する。氏名・メールアドレス・所属店舗（複数選択）・ロール・状態（アクティブ／アーカイブ）を管理でき、新規作成時は仮パスワードを1回だけ表示する。

**Architecture:** `Admin.storeId`（単一・nullable FK）を廃止し、`MemberStore`（Phase B）・`CampaignStoreTarget`（Phase D）と同じ形の中間テーブル`AdminStore`を新設する。`Admin.isActive`を追加し、アーカイブ済み管理者はログインをブロックする（`Member.isActive`と異なり、実際のアクセス制御として機能させる）。

**Tech Stack:** Next.js (App Router) / TypeScript / Prisma (PostgreSQL) / Tailwind CSS v4 / Vitest / bcryptjs

**関連ドキュメント:** `docs/superpowers/specs/2026-09-07-phase-h-account-management-design.md`

**前提:** Phase A〜G（実装順序上先に完了）。`app/admin/(dashboard)/accounts/page.tsx`はPhase Gでプレースホルダーとして作成済み（本Planの Task 4 で置き換える）。

---

### Task 1: Prisma schema — `AdminStore`中間テーブル・`Admin.isActive`を追加し`Admin.storeId`を廃止

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: `model Admin`を更新する**

`prisma/schema.prisma`の`model Admin`ブロック内、以下の行：
```prisma
  storeId      Int?      @map("store_id")
```
を削除する。

同ブロック内、以下の行の直後：
```prisma
  role         AdminRole
```
に以下を追加する：
```prisma
  isActive     Boolean   @default(true) @map("is_active")
```

同ブロック内、以下の行：
```prisma
  store            Store?            @relation(fields: [storeId], references: [id])
```
を以下に置き換える：
```prisma
  stores            AdminStore[]
```

- [ ] **Step 2: `model Store`から`admins`を削除し、`adminStores`を追加する**

`model Store`ブロック内、以下の行：
```prisma
  admins         Admin[]
```
を以下に置き換える：
```prisma
  adminStores    AdminStore[]
```

- [ ] **Step 3: `AdminStore`モデルを新設する**

`model Admin`ブロックの直後に以下を追加する：

```prisma

model AdminStore {
  id      Int @id @default(autoincrement())
  adminId Int @map("admin_id")
  storeId Int @map("store_id")

  admin Admin @relation(fields: [adminId], references: [id])
  store Store @relation(fields: [storeId], references: [id])

  @@unique([adminId, storeId])
  @@map("admin_stores")
}
```

- [ ] **Step 4: Prisma Clientを再生成する**

Run: `npx prisma generate`
Expected: `Generated Prisma Client`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): replace Admin.storeId with many-to-many AdminStore, add Admin.isActive

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

**⚠️ ユーザーへの依頼事項:** `npx prisma migrate dev --name replace_admin_store_id --create-only`でマイグレーションファイルを生成し、`ALTER TABLE "admins" DROP COLUMN "store_id";`より前に以下のSQLを挿入してから適用する（`role`が`hq`の管理者は元々`store_id`が`NULL`だったため`AdminStore`行は作成されない——Phase Iで「hqロールは店舗スコープなし」として扱う設計と一致する）：
```sql
INSERT INTO "admin_stores" ("admin_id", "store_id")
SELECT "admin_id", "store_id" FROM "admins" WHERE "store_id" IS NOT NULL;
```

---

### Task 2: `lib/auth/admin-credentials.ts` — `storeIds`化とアーカイブ済み管理者のログインブロック

**Files:**
- Modify: `lib/auth/admin-credentials.ts`
- Test: `lib/auth/admin-credentials.test.ts`

- [ ] **Step 1: 失敗するテストを書く（既存テストファイルを全面書き換え）**

`lib/auth/admin-credentials.test.ts`を以下の内容に置き換える：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { authorizeAdmin } from "./admin-credentials";
import { prisma } from "@/lib/db";
import { hashPassword } from "./password";

vi.mock("@/lib/db", () => ({
  prisma: {
    admin: {
      findUnique: vi.fn(),
    },
  },
}));

describe("authorizeAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the admin with its role and store ids when credentials match", async () => {
    const passwordHash = await hashPassword("admin-password");
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({
      id: 1,
      email: "manager@foresupa.jp",
      name: "店長 佐藤",
      passwordHash,
      role: "manager",
      isActive: true,
      stores: [{ storeId: 2 }],
    } as never);

    const result = await authorizeAdmin({
      email: "manager@foresupa.jp",
      password: "admin-password",
    });

    expect(result).toEqual({
      id: "1",
      email: "manager@foresupa.jp",
      name: "店長 佐藤",
      role: "manager",
      storeIds: [2],
    });
  });

  it("returns null when the admin does not exist", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue(null);

    const result = await authorizeAdmin({
      email: "unknown@foresupa.jp",
      password: "anything",
    });

    expect(result).toBeNull();
  });

  it("returns null when the password does not match", async () => {
    const passwordHash = await hashPassword("admin-password");
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({
      id: 1,
      email: "manager@foresupa.jp",
      name: "店長 佐藤",
      passwordHash,
      role: "manager",
      isActive: true,
      stores: [{ storeId: 2 }],
    } as never);

    const result = await authorizeAdmin({
      email: "manager@foresupa.jp",
      password: "wrong-password",
    });

    expect(result).toBeNull();
  });

  it("returns an empty storeIds array for HQ admins", async () => {
    const passwordHash = await hashPassword("hq-password");
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({
      id: 2,
      email: "hq@foresupa.jp",
      name: "本部 鈴木",
      passwordHash,
      role: "hq",
      isActive: true,
      stores: [],
    } as never);

    const result = await authorizeAdmin({
      email: "hq@foresupa.jp",
      password: "hq-password",
    });

    expect(result?.storeIds).toEqual([]);
    expect(result?.role).toBe("hq");
  });

  it("returns null when the admin has been archived", async () => {
    const passwordHash = await hashPassword("admin-password");
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({
      id: 1,
      email: "manager@foresupa.jp",
      name: "店長 佐藤",
      passwordHash,
      role: "manager",
      isActive: false,
      stores: [{ storeId: 2 }],
    } as never);

    const result = await authorizeAdmin({
      email: "manager@foresupa.jp",
      password: "admin-password",
    });

    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run lib/auth/admin-credentials.test.ts`
Expected: FAIL（`storeIds`がまだ返っていない、アーカイブ済み判定もまだない）

- [ ] **Step 3: 実装する**

`lib/auth/admin-credentials.ts`を以下の内容に置き換える：

```ts
import { prisma } from "@/lib/db";
import { verifyPassword } from "./password";

export interface AuthorizedAdmin {
  id: string;
  email: string;
  name: string;
  role: "hq" | "manager" | "staff";
  storeIds: number[];
}

export async function authorizeAdmin(credentials: {
  email: string;
  password: string;
}): Promise<AuthorizedAdmin | null> {
  const admin = await prisma.admin.findUnique({
    where: { email: credentials.email },
    include: { stores: true },
  });

  if (!admin) {
    return null;
  }

  if (!admin.isActive) {
    return null;
  }

  const isValid = await verifyPassword(credentials.password, admin.passwordHash);
  if (!isValid) {
    return null;
  }

  return {
    id: String(admin.id),
    email: admin.email,
    name: admin.name,
    role: admin.role,
    storeIds: admin.stores.map((s) => s.storeId),
  };
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run lib/auth/admin-credentials.test.ts`
Expected: PASS（5件）

- [ ] **Step 5: Commit**

```bash
git add lib/auth/admin-credentials.ts lib/auth/admin-credentials.test.ts
git commit -m "feat: switch admin auth to multi-store storeIds and block archived admins

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 3: `app/actions/manage-admins.ts`（新規）

**Files:**
- Create: `app/actions/manage-admins.ts`
- Test: `app/actions/manage-admins.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/manage-admins.test.ts`を以下の内容で新規作成する：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listAdmins,
  createAdmin,
  updateAdmin,
  deactivateAdmin,
  reactivateAdmin,
} from "./manage-admins";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    admin: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

describe("listAdmins", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns admins with their store ids and names", async () => {
    vi.mocked(prisma.admin.findMany).mockResolvedValue([
      {
        id: 1,
        name: "店長 佐藤",
        email: "manager@foresupa.jp",
        role: "manager",
        isActive: true,
        stores: [{ storeId: 2, store: { name: "フォレスパ 渋谷店" } }],
      },
    ] as never);

    const result = await listAdmins();

    expect(result).toEqual([
      {
        id: 1,
        name: "店長 佐藤",
        email: "manager@foresupa.jp",
        role: "manager",
        isActive: true,
        storeIds: [2],
        storeNames: ["フォレスパ 渋谷店"],
      },
    ]);
  });
});

describe("createAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an admin and returns a one-time temporary password", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.admin.create).mockResolvedValue({ id: 10 } as never);

    const result = await createAdmin({
      name: "店長 田中",
      email: "tanaka@foresupa.jp",
      role: "manager",
      storeIds: [1],
    });

    expect(result.status).toBe("created");
    if (result.status === "created") {
      expect(result.adminId).toBe(10);
      expect(result.temporaryPassword).toHaveLength(12);
    }
    expect(prisma.admin.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "店長 田中",
        email: "tanaka@foresupa.jp",
        role: "manager",
        stores: { create: [{ storeId: 1 }] },
      }),
    });
  });

  it("returns email_taken when the email is already registered", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({ id: 1 } as never);

    const result = await createAdmin({
      name: "店長 田中",
      email: "tanaka@foresupa.jp",
      role: "manager",
      storeIds: [1],
    });

    expect(result).toEqual({ status: "email_taken" });
    expect(prisma.admin.create).not.toHaveBeenCalled();
  });
});

describe("updateAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates name, role, and replaces store targets", async () => {
    vi.mocked(prisma.admin.update).mockResolvedValue({} as never);

    await updateAdmin({ adminId: 1, name: "店長 佐藤（改姓）", role: "manager", storeIds: [3] });

    expect(prisma.admin.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        name: "店長 佐藤（改姓）",
        role: "manager",
        stores: { deleteMany: {}, create: [{ storeId: 3 }] },
      },
    });
  });
});

describe("deactivateAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets isActive to false", async () => {
    vi.mocked(prisma.admin.update).mockResolvedValue({} as never);

    await deactivateAdmin(1);

    expect(prisma.admin.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { isActive: false } });
  });
});

describe("reactivateAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets isActive to true", async () => {
    vi.mocked(prisma.admin.update).mockResolvedValue({} as never);

    await reactivateAdmin(1);

    expect(prisma.admin.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { isActive: true } });
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run app/actions/manage-admins.test.ts`
Expected: FAIL（`./manage-admins`が存在しない）

- [ ] **Step 3: 実装する**

`app/actions/manage-admins.ts`を以下の内容で新規作成する：

```ts
"use server";

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import type { AdminRole } from "@prisma/client";

const TEMPORARY_PASSWORD_LENGTH = 12;

export interface AdminListItem {
  id: number;
  name: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  storeIds: number[];
  storeNames: string[];
}

export async function listAdmins(): Promise<AdminListItem[]> {
  const admins = await prisma.admin.findMany({
    include: { stores: { include: { store: true } } },
    orderBy: { id: "asc" },
  });
  return admins.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    role: a.role,
    isActive: a.isActive,
    storeIds: a.stores.map((s) => s.storeId),
    storeNames: a.stores.map((s) => s.store.name),
  }));
}

export interface CreateAdminParams {
  name: string;
  email: string;
  role: AdminRole;
  storeIds: number[];
}

export type CreateAdminResult =
  | { status: "created"; adminId: number; temporaryPassword: string }
  | { status: "email_taken" };

// crypto.randomUUID()の一部を流用した12桁の英数字ランダム文字列を仮パスワードとする。
function generateTemporaryPassword(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, TEMPORARY_PASSWORD_LENGTH);
}

export async function createAdmin(params: CreateAdminParams): Promise<CreateAdminResult> {
  const existing = await prisma.admin.findUnique({ where: { email: params.email } });
  if (existing) {
    return { status: "email_taken" };
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const admin = await prisma.admin.create({
    data: {
      name: params.name,
      email: params.email,
      role: params.role,
      passwordHash,
      stores: { create: params.storeIds.map((storeId) => ({ storeId })) },
    },
  });

  return { status: "created", adminId: admin.id, temporaryPassword };
}

export interface UpdateAdminParams {
  adminId: number;
  name: string;
  role: AdminRole;
  storeIds: number[];
}

export async function updateAdmin(params: UpdateAdminParams): Promise<void> {
  await prisma.admin.update({
    where: { id: params.adminId },
    data: {
      name: params.name,
      role: params.role,
      stores: { deleteMany: {}, create: params.storeIds.map((storeId) => ({ storeId })) },
    },
  });
}

export async function deactivateAdmin(adminId: number): Promise<void> {
  await prisma.admin.update({ where: { id: adminId }, data: { isActive: false } });
}

export async function reactivateAdmin(adminId: number): Promise<void> {
  await prisma.admin.update({ where: { id: adminId }, data: { isActive: true } });
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run app/actions/manage-admins.test.ts`
Expected: PASS（6件）

- [ ] **Step 5: Commit**

```bash
git add app/actions/manage-admins.ts app/actions/manage-admins.test.ts
git commit -m "feat: add manage-admins server actions (list/create/update/deactivate/reactivate)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 4: `accounts/page.tsx` — Phase Gのプレースホルダーを置き換える

**Files:**
- Modify: `app/admin/(dashboard)/accounts/page.tsx`

- [ ] **Step 1: ページ全体を書き換える**

`app/admin/(dashboard)/accounts/page.tsx` を以下の内容に置き換える（`customers/page.tsx`と同じ一覧テーブル＋新規登録モーダル＋編集モーダル＋Trash2/RotateCcwアイコンの構造）：

```tsx
"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2, RotateCcw, Plus } from "lucide-react";
import {
  listAdmins,
  createAdmin,
  updateAdmin,
  deactivateAdmin,
  reactivateAdmin,
  type AdminListItem,
} from "@/app/actions/manage-admins";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { Modal } from "@/components/ui/modal";
import type { AdminRole } from "@prisma/client";

const ROLE_LABEL: Record<AdminRole, string> = {
  hq: "本部",
  manager: "店長",
  staff: "一般",
};

const EMPTY_CREATE_FORM = {
  name: "",
  email: "",
  role: "staff" as AdminRole,
  storeIds: [] as number[],
};

export default function AdminAccountsPage() {
  const [admins, setAdmins] = useState<AdminListItem[]>([]);
  const [stores, setStores] = useState<StoreListItem[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [issuedPassword, setIssuedPassword] = useState<string | null>(null);

  const [editing, setEditing] = useState<AdminListItem | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    role: "staff" as AdminRole,
    storeIds: [] as number[],
  });
  const [saving, setSaving] = useState(false);

  function reload() {
    listAdmins().then(setAdmins);
  }

  useEffect(() => {
    reload();
    listStores().then(setStores);
  }, []);

  function toggleCreateStore(id: number) {
    setCreateForm((f) => ({
      ...f,
      storeIds: f.storeIds.includes(id) ? f.storeIds.filter((s) => s !== id) : [...f.storeIds, id],
    }));
  }

  function toggleEditStore(id: number) {
    setEditForm((f) => ({
      ...f,
      storeIds: f.storeIds.includes(id) ? f.storeIds.filter((s) => s !== id) : [...f.storeIds, id],
    }));
  }

  function openCreate() {
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateError(null);
    setIssuedPassword(null);
    setCreateOpen(true);
  }

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);
    const result = await createAdmin({
      name: createForm.name,
      email: createForm.email,
      role: createForm.role,
      storeIds: createForm.role === "hq" ? [] : createForm.storeIds,
    });
    setCreating(false);
    if (result.status === "email_taken") {
      setCreateError("このメールアドレスは既に登録されています。");
      return;
    }
    setIssuedPassword(result.temporaryPassword);
    reload();
  }

  function startEdit(admin: AdminListItem) {
    setEditing(admin);
    setEditForm({ name: admin.name, role: admin.role, storeIds: admin.storeIds });
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setSaving(true);
    await updateAdmin({
      adminId: editing.id,
      name: editForm.name,
      role: editForm.role,
      storeIds: editForm.role === "hq" ? [] : editForm.storeIds,
    });
    setSaving(false);
    setEditing(null);
    reload();
  }

  async function handleDeactivate(admin: AdminListItem) {
    if (!window.confirm(`${admin.name}様をアーカイブしますか？`)) return;
    await deactivateAdmin(admin.id);
    reload();
  }

  async function handleReactivate(admin: AdminListItem) {
    await reactivateAdmin(admin.id);
    reload();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="flex h-10 items-center gap-1 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white"
        >
          <Plus size={16} />
          新規登録
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="p-3">氏名</th>
              <th className="p-3">メールアドレス</th>
              <th className="p-3">所属店舗</th>
              <th className="p-3">ロール</th>
              <th className="p-3">状態</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr
                key={a.id}
                className={`border-b border-neutral-100 last:border-0 ${!a.isActive ? "opacity-50" : ""}`}
              >
                <td className="p-3">{a.name}</td>
                <td className="p-3">{a.email}</td>
                <td className="p-3">{a.role === "hq" ? "全店舗" : a.storeNames.join("、") || "—"}</td>
                <td className="p-3">{ROLE_LABEL[a.role]}</td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs text-white ${
                      a.isActive ? "bg-primary-500" : "bg-neutral-400"
                    }`}
                  >
                    {a.isActive ? "アクティブ" : "アーカイブ"}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(a)}
                      className="text-neutral-500 hover:text-primary-600"
                      aria-label="編集"
                    >
                      <Pencil size={16} />
                    </button>
                    {a.isActive ? (
                      <button
                        type="button"
                        onClick={() => handleDeactivate(a)}
                        className="text-neutral-500 hover:text-error"
                        aria-label="アーカイブ"
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleReactivate(a)}
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
        {admins.length === 0 && (
          <p className="p-6 text-center text-sm text-neutral-500">管理者アカウントがありません。</p>
        )}
      </div>

      <Modal open={createOpen} onOpenChange={setCreateOpen} title="新規アカウント登録">
        <div className="flex flex-col gap-3">
          {createError && (
            <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{createError}</p>
          )}
          {issuedPassword ? (
            <div className="flex flex-col gap-2 rounded-lg border border-primary-200 bg-primary-50 p-3">
              <p className="text-sm text-neutral-700">
                アカウントを作成しました。以下の仮パスワードを本人に伝えてください（この画面を閉じると再表示できません）。
              </p>
              <p className="select-all rounded-md bg-neutral-0 px-3 py-2 font-mono text-sm">
                {issuedPassword}
              </p>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="h-10 rounded-lg bg-primary-500 font-medium text-white"
              >
                閉じる
              </button>
            </div>
          ) : (
            <>
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
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as AdminRole })}
                className="h-10 rounded-md border border-neutral-300 px-2"
              >
                <option value="hq">本部</option>
                <option value="manager">店長</option>
                <option value="staff">一般</option>
              </select>
              {createForm.role !== "hq" && (
                <div>
                  <p className="mb-1 text-sm text-neutral-600">所属店舗</p>
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
              )}
              <button
                type="button"
                disabled={creating || !createForm.name || !createForm.email}
                onClick={handleCreate}
                className="h-12 rounded-lg bg-primary-500 font-medium text-white disabled:opacity-50"
              >
                登録する
              </button>
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="アカウント情報を編集"
      >
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="氏名"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <select
            value={editForm.role}
            onChange={(e) => setEditForm({ ...editForm, role: e.target.value as AdminRole })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          >
            <option value="hq">本部</option>
            <option value="manager">店長</option>
            <option value="staff">一般</option>
          </select>
          {editForm.role !== "hq" && (
            <div>
              <p className="mb-1 text-sm text-neutral-600">所属店舗</p>
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
          )}
          <button
            type="button"
            disabled={saving || !editForm.name}
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

Run: `npx vitest run app/actions/manage-admins.test.ts lib/auth/admin-credentials.test.ts`
Expected: 全件PASS

- [ ] **Step 4: Commit**

```bash
git add "app/admin/(dashboard)/accounts/page.tsx"
git commit -m "feat: implement account management UI (list, create, edit, archive)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 5: 最終検証

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

Task 1で案内した通り、マイグレーションファイルへのデータ移行SQL追加とマイグレーション適用が必要。

## 完了条件

- Task 1〜4のコミットが完了している
- `npx tsc --noEmit` / `npx eslint .` / `npx vitest run` がすべてエラーなしで通る
- ユーザーがマイグレーションを適用し、`/admin/accounts`での新規作成・編集・アーカイブ・復元を実機で確認する
