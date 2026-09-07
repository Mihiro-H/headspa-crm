# Phase H: アカウント管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/admin/accounts`（Phase Gでプレースホルダーとして確保済み）に、管理者アカウント（`Admin`）の一覧・新規作成・編集機能を実装する。氏名・メールアドレス・所属店舗（複数選択）・ロール・状態（アクティブ／アーカイブ）を管理でき、新規作成はメール招待制とする（2026-09-07 ユーザー方針変更。仮パスワード発行方式は採用しない）。

**Architecture:** `Admin.storeId`（単一・nullable FK）を廃止し、`MemberStore`（Phase B）・`CampaignStoreTarget`（Phase D）と同じ形の中間テーブル`AdminStore`を新設する。`Admin.isActive`を追加し、アーカイブ済み管理者はログインをブロックする（`Member.isActive`と異なり、実際のアクセス制御として機能させる）。`Admin.passwordHash`をnullable化し、`inviteToken`/`inviteTokenExpiresAt`を追加する。新規作成時は招待トークンを発行し、既存の`lib/delivery/send-email.ts`（Brevo経由）で招待メールを送る。`sendEmail`は`BREVO_API_KEY`未設定時に例外を投げず`{status:"not_configured"}`を返すため、Brevo未設定の現時点でも本Task自体は実装・動作し、メール送信だけが実際には行われない（招待リンクを画面上に表示し手動共有できるようにする）。

**Tech Stack:** Next.js (App Router) / TypeScript / Prisma (PostgreSQL) / Tailwind CSS v4 / Vitest / bcryptjs

**関連ドキュメント:** `docs/superpowers/specs/2026-09-07-phase-h-account-management-design.md`

**前提:** Phase A〜G（実装順序上先に完了）。`app/admin/(dashboard)/accounts/page.tsx`はPhase Gでプレースホルダーとして作成済み（本Planの Task 7 で置き換える）。

---

### Task 1: Prisma schema — `AdminStore`中間テーブル・`Admin.isActive`・招待用フィールドを追加し`Admin.storeId`を廃止

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: `model Admin`を更新する**

`prisma/schema.prisma`の`model Admin`ブロック内、以下の行：
```prisma
  storeId      Int?      @map("store_id")
```
を削除する。

同ブロック内、以下の行：
```prisma
  passwordHash String    @map("password_hash") @db.VarChar(255)
```
を以下に置き換える（招待済みだがまだパスワード未設定のアカウントを`null`で表現するため）：
```prisma
  passwordHash String?   @map("password_hash") @db.VarChar(255)
```

同ブロック内、以下の行の直後：
```prisma
  role         AdminRole
```
に以下を追加する：
```prisma
  isActive     Boolean   @default(true) @map("is_active")
  inviteToken           String?   @unique @map("invite_token") @db.VarChar(255)
  inviteTokenExpiresAt  DateTime? @map("invite_token_expires_at")
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
git commit -m "feat(db): replace Admin.storeId with many-to-many AdminStore, add invite fields

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

**⚠️ ユーザーへの依頼事項:** `npx prisma migrate dev --name replace_admin_store_id_add_invite --create-only`でマイグレーションファイルを生成し、`ALTER TABLE "admins" DROP COLUMN "store_id";`より前に以下のSQLを挿入してから適用する（`role`が`hq`の管理者は元々`store_id`が`NULL`だったため`AdminStore`行は作成されない——Phase Iで「hqロールは店舗スコープなし」として扱う設計と一致する）：
```sql
INSERT INTO "admin_stores" ("admin_id", "store_id")
SELECT "admin_id", "store_id" FROM "admins" WHERE "store_id" IS NOT NULL;
```
`password_hash`カラムを`NOT NULL`から`NULL`許容に変更するマイグレーションは、既存行がすべて値を持っているため追加のデータ移行は不要（列制約の変更のみ）。

---

### Task 2: `lib/auth/admin-credentials.ts` — `storeIds`化・アーカイブ済み管理者と招待未承諾管理者のログインブロック

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

  it("returns null when the invite has not been accepted yet (passwordHash is null)", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({
      id: 3,
      email: "pending@foresupa.jp",
      name: "招待中 太郎",
      passwordHash: null,
      role: "staff",
      isActive: true,
      stores: [{ storeId: 1 }],
    } as never);

    const result = await authorizeAdmin({
      email: "pending@foresupa.jp",
      password: "anything",
    });

    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run lib/auth/admin-credentials.test.ts`
Expected: FAIL（`storeIds`がまだ返っていない、アーカイブ済み・招待未承諾の判定もまだない）

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

  // 招待メール送信済みだがまだパスワードを設定していない管理者はログイン不可。
  if (!admin.passwordHash) {
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
Expected: PASS（6件）

- [ ] **Step 5: Commit**

```bash
git add lib/auth/admin-credentials.ts lib/auth/admin-credentials.test.ts
git commit -m "feat: switch admin auth to multi-store storeIds, block archived and pending-invite admins

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 3: `app/actions/manage-admins.ts`（新規） — 招待メール制の新規作成・再送信

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
  resendAdminInvite,
  updateAdmin,
  deactivateAdmin,
  reactivateAdmin,
} from "./manage-admins";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/delivery/send-email";

vi.mock("@/lib/db", () => ({
  prisma: {
    admin: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/delivery/send-email", () => ({
  sendEmail: vi.fn(),
}));

describe("listAdmins", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns admins with their store ids, names, and pending-invite status", async () => {
    vi.mocked(prisma.admin.findMany).mockResolvedValue([
      {
        id: 1,
        name: "店長 佐藤",
        email: "manager@foresupa.jp",
        role: "manager",
        isActive: true,
        passwordHash: "hashed",
        stores: [{ storeId: 2, store: { name: "フォレスパ 渋谷店" } }],
      },
      {
        id: 2,
        name: "招待中 太郎",
        email: "pending@foresupa.jp",
        role: "staff",
        isActive: true,
        passwordHash: null,
        stores: [],
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
        isPending: false,
        storeIds: [2],
        storeNames: ["フォレスパ 渋谷店"],
      },
      {
        id: 2,
        name: "招待中 太郎",
        email: "pending@foresupa.jp",
        role: "staff",
        isActive: true,
        isPending: true,
        storeIds: [],
        storeNames: [],
      },
    ]);
  });
});

describe("createAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an admin with no password and sends an invite email", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.admin.create).mockResolvedValue({ id: 10 } as never);
    vi.mocked(sendEmail).mockResolvedValue({ status: "sent" });

    const result = await createAdmin({
      name: "店長 田中",
      email: "tanaka@foresupa.jp",
      role: "manager",
      storeIds: [1],
    });

    expect(result.status).toBe("invited");
    if (result.status === "invited") {
      expect(result.adminId).toBe(10);
      expect(result.emailStatus).toBe("sent");
      expect(result.inviteUrl).toContain("/admin/accept-invite?token=");
    }
    expect(prisma.admin.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "店長 田中",
        email: "tanaka@foresupa.jp",
        role: "manager",
        passwordHash: null,
        stores: { create: [{ storeId: 1 }] },
      }),
    });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "tanaka@foresupa.jp" }),
    );
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

  it("still creates the admin and reports not_configured when Brevo is not set up", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.admin.create).mockResolvedValue({ id: 11 } as never);
    vi.mocked(sendEmail).mockResolvedValue({ status: "not_configured" });

    const result = await createAdmin({
      name: "店長 鈴木",
      email: "suzuki@foresupa.jp",
      role: "staff",
      storeIds: [1],
    });

    expect(result.status).toBe("invited");
    if (result.status === "invited") {
      expect(result.emailStatus).toBe("not_configured");
      expect(result.inviteUrl).toContain("/admin/accept-invite?token=");
    }
  });
});

describe("resendAdminInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("issues a new token and resends the invite email for a pending admin", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({
      id: 2,
      name: "招待中 太郎",
      email: "pending@foresupa.jp",
      passwordHash: null,
    } as never);
    vi.mocked(prisma.admin.update).mockResolvedValue({} as never);
    vi.mocked(sendEmail).mockResolvedValue({ status: "sent" });

    const result = await resendAdminInvite(2);

    expect(result.status).toBe("resent");
    if (result.status === "resent") {
      expect(result.emailStatus).toBe("sent");
      expect(result.inviteUrl).toContain("/admin/accept-invite?token=");
    }
    expect(prisma.admin.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: expect.objectContaining({
        inviteToken: expect.any(String),
        inviteTokenExpiresAt: expect.any(Date),
      }),
    });
  });

  it("returns already_active when the admin already has a password set", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({
      id: 1,
      name: "店長 佐藤",
      email: "manager@foresupa.jp",
      passwordHash: "hashed",
    } as never);

    const result = await resendAdminInvite(1);

    expect(result).toEqual({ status: "already_active" });
    expect(prisma.admin.update).not.toHaveBeenCalled();
  });

  it("returns not_found when the admin does not exist", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue(null);

    const result = await resendAdminInvite(999);

    expect(result).toEqual({ status: "not_found" });
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
import { sendEmail } from "@/lib/delivery/send-email";
import type { AdminRole } from "@prisma/client";

const INVITE_EXPIRY_DAYS = 7;

export interface AdminListItem {
  id: number;
  name: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  isPending: boolean; // true = 招待メール送信済みだがパスワード未設定
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
    isPending: a.passwordHash === null,
    storeIds: a.stores.map((s) => s.storeId),
    storeNames: a.stores.map((s) => s.store.name),
  }));
}

function buildInviteUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${baseUrl}/admin/accept-invite?token=${token}`;
}

function inviteEmailBody(name: string, inviteUrl: string): string {
  return `${name}様\n\n管理画面アカウントが作成されました。以下のリンクからパスワードを設定してください（7日間有効です）。\n\n${inviteUrl}\n\nこのメールに心当たりがない場合は破棄してください。`;
}

function inviteExpiresAt(): Date {
  return new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

export interface CreateAdminParams {
  name: string;
  email: string;
  role: AdminRole;
  storeIds: number[];
}

export type CreateAdminResult =
  | {
      status: "invited";
      adminId: number;
      emailStatus: "sent" | "not_configured" | "failed";
      inviteUrl: string;
    }
  | { status: "email_taken" };

export async function createAdmin(params: CreateAdminParams): Promise<CreateAdminResult> {
  const existing = await prisma.admin.findUnique({ where: { email: params.email } });
  if (existing) {
    return { status: "email_taken" };
  }

  const inviteToken = crypto.randomUUID();

  const admin = await prisma.admin.create({
    data: {
      name: params.name,
      email: params.email,
      role: params.role,
      passwordHash: null,
      inviteToken,
      inviteTokenExpiresAt: inviteExpiresAt(),
      stores: { create: params.storeIds.map((storeId) => ({ storeId })) },
    },
  });

  const inviteUrl = buildInviteUrl(inviteToken);
  const emailResult = await sendEmail({
    to: params.email,
    subject: "【フォレスパ】管理画面アカウントのご招待",
    body: inviteEmailBody(params.name, inviteUrl),
  });

  return { status: "invited", adminId: admin.id, emailStatus: emailResult.status, inviteUrl };
}

export type ResendInviteResult =
  | { status: "resent"; emailStatus: "sent" | "not_configured" | "failed"; inviteUrl: string }
  | { status: "already_active" }
  | { status: "not_found" };

// Brevo未設定期間中に送信できなかった招待、または期限切れになった招待をやり直すための再送機能。
export async function resendAdminInvite(adminId: number): Promise<ResendInviteResult> {
  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!admin) {
    return { status: "not_found" };
  }
  if (admin.passwordHash !== null) {
    return { status: "already_active" };
  }

  const inviteToken = crypto.randomUUID();
  await prisma.admin.update({
    where: { id: adminId },
    data: { inviteToken, inviteTokenExpiresAt: inviteExpiresAt() },
  });

  const inviteUrl = buildInviteUrl(inviteToken);
  const emailResult = await sendEmail({
    to: admin.email,
    subject: "【フォレスパ】管理画面アカウントのご招待（再送）",
    body: inviteEmailBody(admin.name, inviteUrl),
  });

  return { status: "resent", emailStatus: emailResult.status, inviteUrl };
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
Expected: PASS（9件）

- [ ] **Step 5: Commit**

```bash
git add app/actions/manage-admins.ts app/actions/manage-admins.test.ts
git commit -m "feat: add manage-admins server actions with email-invite account creation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 4: `app/actions/accept-admin-invite.ts`（新規）

**Files:**
- Create: `app/actions/accept-admin-invite.ts`
- Test: `app/actions/accept-admin-invite.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/accept-admin-invite.test.ts`を以下の内容で新規作成する：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getInviteDetails, acceptAdminInvite } from "./accept-admin-invite";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    admin: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

describe("getInviteDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the invited admin's name and email when the token is valid", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({
      name: "招待中 太郎",
      email: "pending@foresupa.jp",
      inviteTokenExpiresAt: new Date(Date.now() + 60_000),
    } as never);

    const result = await getInviteDetails("valid-token");

    expect(result).toEqual({
      status: "valid",
      admin: { name: "招待中 太郎", email: "pending@foresupa.jp" },
    });
  });

  it("returns invalid when no admin matches the token", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue(null);

    const result = await getInviteDetails("unknown-token");

    expect(result).toEqual({ status: "invalid" });
  });

  it("returns expired when the token's expiry has passed", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({
      name: "招待中 太郎",
      email: "pending@foresupa.jp",
      inviteTokenExpiresAt: new Date(Date.now() - 60_000),
    } as never);

    const result = await getInviteDetails("expired-token");

    expect(result).toEqual({ status: "expired" });
  });
});

describe("acceptAdminInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets the password and clears the invite token when the token is valid", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({
      id: 3,
      inviteTokenExpiresAt: new Date(Date.now() + 60_000),
    } as never);
    vi.mocked(prisma.admin.update).mockResolvedValue({} as never);

    const result = await acceptAdminInvite("valid-token", "new-password-123");

    expect(result).toEqual({ status: "accepted" });
    expect(prisma.admin.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: expect.objectContaining({
        passwordHash: expect.any(String),
        inviteToken: null,
        inviteTokenExpiresAt: null,
      }),
    });
  });

  it("returns invalid when no admin matches the token", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue(null);

    const result = await acceptAdminInvite("unknown-token", "new-password-123");

    expect(result).toEqual({ status: "invalid" });
    expect(prisma.admin.update).not.toHaveBeenCalled();
  });

  it("returns expired when the token's expiry has passed", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({
      id: 3,
      inviteTokenExpiresAt: new Date(Date.now() - 60_000),
    } as never);

    const result = await acceptAdminInvite("expired-token", "new-password-123");

    expect(result).toEqual({ status: "expired" });
    expect(prisma.admin.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run app/actions/accept-admin-invite.test.ts`
Expected: FAIL（`./accept-admin-invite`が存在しない）

- [ ] **Step 3: 実装する**

`app/actions/accept-admin-invite.ts`を以下の内容で新規作成する：

```ts
"use server";

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

export interface InviteDetails {
  name: string;
  email: string;
}

export type GetInviteDetailsResult =
  | { status: "valid"; admin: InviteDetails }
  | { status: "invalid" }
  | { status: "expired" };

export async function getInviteDetails(token: string): Promise<GetInviteDetailsResult> {
  const admin = await prisma.admin.findUnique({ where: { inviteToken: token } });
  if (!admin) {
    return { status: "invalid" };
  }
  if (!admin.inviteTokenExpiresAt || admin.inviteTokenExpiresAt < new Date()) {
    return { status: "expired" };
  }
  return { status: "valid", admin: { name: admin.name, email: admin.email } };
}

export type AcceptAdminInviteResult = { status: "accepted" } | { status: "invalid" } | { status: "expired" };

export async function acceptAdminInvite(
  token: string,
  password: string,
): Promise<AcceptAdminInviteResult> {
  const admin = await prisma.admin.findUnique({ where: { inviteToken: token } });
  if (!admin) {
    return { status: "invalid" };
  }
  if (!admin.inviteTokenExpiresAt || admin.inviteTokenExpiresAt < new Date()) {
    return { status: "expired" };
  }

  const passwordHash = await hashPassword(password);
  await prisma.admin.update({
    where: { id: admin.id },
    data: { passwordHash, inviteToken: null, inviteTokenExpiresAt: null },
  });

  return { status: "accepted" };
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run app/actions/accept-admin-invite.test.ts`
Expected: PASS（6件）

- [ ] **Step 5: Commit**

```bash
git add app/actions/accept-admin-invite.ts app/actions/accept-admin-invite.test.ts
git commit -m "feat: add accept-admin-invite server actions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 5: `lib/auth/access-control.ts` — 招待受諾ページを未認証で許可する

**Files:**
- Modify: `lib/auth/access-control.ts`
- Test: `lib/auth/access-control.test.ts`

- [ ] **Step 1: 失敗するテストを追加する**

`lib/auth/access-control.test.ts`の以下のブロック：
```ts
  it("always allows the /admin/login page itself", () => {
    expect(resolveAccessDecision("/admin/login", undefined)).toEqual({
      type: "allow",
    });
  });
```
の直後に以下を追加する：
```ts

  it("always allows the /admin/accept-invite page itself", () => {
    expect(resolveAccessDecision("/admin/accept-invite", undefined)).toEqual({
      type: "allow",
    });
  });
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run lib/auth/access-control.test.ts`
Expected: FAIL（`/admin/accept-invite`が未認証ユーザーに対して`/admin/login`へのリダイレクトになってしまう）

- [ ] **Step 3: 実装する**

`lib/auth/access-control.ts`の以下の行：
```ts
  const isAdminLoginPage = pathname.startsWith("/admin/login");
  const isAdminArea = pathname.startsWith("/admin") && !isAdminLoginPage;
```
を以下に置き換える：
```ts
  const isPublicAdminPage =
    pathname.startsWith("/admin/login") || pathname.startsWith("/admin/accept-invite");
  const isAdminArea = pathname.startsWith("/admin") && !isPublicAdminPage;
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run lib/auth/access-control.test.ts`
Expected: PASS（8件）

- [ ] **Step 5: Commit**

```bash
git add lib/auth/access-control.ts lib/auth/access-control.test.ts
git commit -m "feat: allow unauthenticated access to the admin invite-acceptance page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 6: `app/admin/accept-invite/page.tsx`（新規、未認証で開ける公開ページ）

**Files:**
- Create: `app/admin/accept-invite/page.tsx`

- [ ] **Step 1: ページを作成する**

`app/admin/accept-invite/page.tsx`を以下の内容で新規作成する（`app/admin/login/page.tsx`と同じ配置・スタイルに揃える）：

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getInviteDetails,
  acceptAdminInvite,
  type InviteDetails,
} from "@/app/actions/accept-admin-invite";

type LoadState =
  | { status: "loading" }
  | { status: "valid"; admin: InviteDetails }
  | { status: "invalid" }
  | { status: "expired" };

export default function AcceptAdminInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadState({ status: "invalid" });
      return;
    }
    getInviteDetails(token).then((result) => {
      if (result.status === "valid") {
        setLoadState({ status: "valid", admin: result.admin });
      } else {
        setLoadState({ status: result.status });
      }
    });
  }, [token]);

  async function handleSubmit() {
    if (password.length < 8) {
      setError("パスワードは8文字以上で入力してください。");
      return;
    }
    if (password !== passwordConfirm) {
      setError("パスワードが一致しません。");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await acceptAdminInvite(token, password);
    setSubmitting(false);
    if (result.status === "accepted") {
      router.push("/admin/login");
    } else {
      setError(
        result.status === "expired"
          ? "招待の有効期限が切れています。管理者に再招待を依頼してください。"
          : "招待リンクが無効です。管理者に再招待を依頼してください。",
      );
    }
  }

  if (loadState.status === "loading") {
    return (
      <div className="mx-auto flex w-full min-h-screen max-w-sm flex-col justify-center gap-4 p-4">
        <p className="text-sm text-neutral-500">確認中...</p>
      </div>
    );
  }

  if (loadState.status !== "valid") {
    return (
      <div className="mx-auto flex w-full min-h-screen max-w-sm flex-col justify-center gap-4 p-4">
        <h1 className="font-heading text-2xl text-primary-700">フォレスパ 管理画面</h1>
        <p className="rounded-lg bg-error/10 p-3 text-sm text-error">
          {loadState.status === "expired"
            ? "招待の有効期限が切れています。管理者に再招待を依頼してください。"
            : "招待リンクが無効です。管理者に再招待を依頼してください。"}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full min-h-screen max-w-sm flex-col justify-center gap-4 p-4">
      <h1 className="font-heading text-2xl text-primary-700">フォレスパ 管理画面</h1>
      <p className="text-sm text-neutral-600">
        {loadState.admin.name}様（{loadState.admin.email}）のパスワードを設定してください。
      </p>
      {error && <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}
      <input
        type="password"
        placeholder="新しいパスワード（8文字以上）"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="h-12 rounded-md border border-neutral-300 px-3"
      />
      <input
        type="password"
        placeholder="新しいパスワード（確認）"
        value={passwordConfirm}
        onChange={(e) => setPasswordConfirm(e.target.value)}
        className="h-12 rounded-md border border-neutral-300 px-3"
      />
      <button
        type="button"
        disabled={submitting}
        onClick={handleSubmit}
        className="h-12 rounded-lg bg-primary-500 font-medium text-white disabled:opacity-50"
      >
        パスワードを設定する
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
git add app/admin/accept-invite/page.tsx
git commit -m "feat: add admin invite-acceptance page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 7: `accounts/page.tsx` — Phase Gのプレースホルダーを置き換える（招待制UI）

**Files:**
- Modify: `app/admin/(dashboard)/accounts/page.tsx`

- [ ] **Step 1: ページ全体を書き換える**

`app/admin/(dashboard)/accounts/page.tsx` を以下の内容に置き換える（`customers/page.tsx`と同じ一覧テーブル＋新規登録モーダル＋編集モーダル＋Trash2/RotateCcwアイコンの構造。招待状況列と「招待を再送信」ボタンを追加）：

```tsx
"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2, RotateCcw, Plus, Send } from "lucide-react";
import {
  listAdmins,
  createAdmin,
  resendAdminInvite,
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

const EMAIL_STATUS_MESSAGE: Record<"sent" | "not_configured" | "failed", string> = {
  sent: "招待メールを送信しました。",
  not_configured:
    "メール送信が未設定のため招待メールは送信されませんでした。Brevo設定後、一覧の「招待を再送信」から送信してください。",
  failed: "招待メールの送信に失敗しました。後ほど「招待を再送信」からやり直してください。",
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
  const [inviteResult, setInviteResult] = useState<{ message: string; inviteUrl: string } | null>(
    null,
  );

  const [editing, setEditing] = useState<AdminListItem | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    role: "staff" as AdminRole,
    storeIds: [] as number[],
  });
  const [saving, setSaving] = useState(false);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

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
    setInviteResult(null);
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
    setInviteResult({ message: EMAIL_STATUS_MESSAGE[result.emailStatus], inviteUrl: result.inviteUrl });
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

  async function handleResendInvite(admin: AdminListItem) {
    setResendingId(admin.id);
    setResendMessage(null);
    const result = await resendAdminInvite(admin.id);
    setResendingId(null);
    if (result.status === "resent") {
      setResendMessage(`${admin.name}様: ${EMAIL_STATUS_MESSAGE[result.emailStatus]}`);
    }
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

      {resendMessage && (
        <p role="status" aria-live="polite" className="text-sm text-neutral-700">
          {resendMessage}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="p-3">氏名</th>
              <th className="p-3">メールアドレス</th>
              <th className="p-3">所属店舗</th>
              <th className="p-3">ロール</th>
              <th className="p-3">状態</th>
              <th className="p-3">招待状況</th>
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
                  {a.isPending ? (
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-accent-100 px-2 py-1 text-xs text-accent-700">
                        招待中
                      </span>
                      <button
                        type="button"
                        onClick={() => handleResendInvite(a)}
                        disabled={resendingId === a.id}
                        className="flex items-center gap-1 text-xs text-primary-600 hover:underline disabled:opacity-50"
                      >
                        <Send size={12} />
                        招待を再送信
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-neutral-500">設定済み</span>
                  )}
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
          {inviteResult ? (
            <div className="flex flex-col gap-2 rounded-lg border border-primary-200 bg-primary-50 p-3">
              <p className="text-sm text-neutral-700">{inviteResult.message}</p>
              <p className="text-xs text-neutral-500">
                招待リンク（Brevo未設定の間はこちらを手動で共有してください）:
              </p>
              <p className="select-all break-all rounded-md bg-neutral-0 px-3 py-2 font-mono text-xs">
                {inviteResult.inviteUrl}
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
                招待メールを送信して登録する
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

（`bg-accent-100`/`text-accent-700`は既存の`accent`カラースケールを使う。実装時に`app/globals.css`のトークン定義を確認し、該当シェードが無ければ`bg-primary-50`/`text-primary-700`など既存の確認済みトークンに置き換える。）

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: 既存の関連テストが壊れていないことを確認する**

Run: `npx vitest run app/actions/manage-admins.test.ts app/actions/accept-admin-invite.test.ts lib/auth/admin-credentials.test.ts lib/auth/access-control.test.ts`
Expected: 全件PASS

- [ ] **Step 4: Commit**

```bash
git add "app/admin/(dashboard)/accounts/page.tsx"
git commit -m "feat: implement account management UI with email-invite flow

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 8: 最終検証

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

- Task 1で案内した通り、マイグレーションファイルへのデータ移行SQL追加とマイグレーション適用が必要。
- 招待リンクの絶対URL生成に使う環境変数`NEXT_PUBLIC_APP_URL`を本番環境に設定する（未設定時は`http://localhost:3000`にフォールバックするため、開発環境ではそのままで動作する）。
- 招待メールの実際の送信にはBrevo設定（`BREVO_API_KEY`環境変数）が必要。未設定の間は`createAdmin`／`resendAdminInvite`の`emailStatus`が`not_configured`になり、画面上に表示される招待リンクを手動で共有する運用になる。Brevo設定後は自動的にメール送信が有効になる（コード変更不要）。

## 完了条件

- Task 1〜7のコミットが完了している
- `npx tsc --noEmit` / `npx eslint .` / `npx vitest run` がすべてエラーなしで通る
- ユーザーがマイグレーションを適用し、`/admin/accounts`での新規作成（招待リンク発行）・招待受諾（`/admin/accept-invite`でのパスワード設定）・編集・アーカイブ・復元・招待再送信を実機で確認する
