# Phase G: 設定セクション新設 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** サイドバーに開閉式の「設定」セクションを新設し、Cronジョブ実行ログをその配下に移す。加えてアカウント管理・権限設定（本Phaseではプレースホルダー、中身はPhase H・Iで実装）・利用規約設定（本Phaseで実装）の3項目を設定配下に追加する。

**Architecture:** サイドバーの開閉状態のみを新規クライアントコンポーネント`components/admin/settings-nav.tsx`に切り出し、`layout.tsx`自体はサーバーコンポーネントのまま維持する。利用規約は新規シングルトンテーブル`TermsOfService`（`id`固定`1`）で管理し、管理画面での編集ページと会員向けの公開表示ページを追加する。

**Tech Stack:** Next.js (App Router) / TypeScript / Prisma (PostgreSQL) / Tailwind CSS v4 / Vitest

**関連ドキュメント:** `docs/superpowers/specs/2026-09-07-phase-g-settings-section-design.md`

**前提:** Phase A〜F（実装順序上先に完了）。本Planの`layout.tsx`・`admin-header.tsx`への変更は、Phase A（`AdminHeader`導入）・Phase F（`auto-delivery`/`templates`のNAV_ITEMS削除、`Repeat`/`FileText`アイコンimport削除）適用後の状態を出発点とする。

---

### Task 1: Prisma schema — `TermsOfService`シングルトンテーブルを追加

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: `TermsOfService`モデルを新設する**

`prisma/schema.prisma`の末尾に以下を追加する：

```prisma

model TermsOfService {
  id       Int    @id @default(1)
  bodyText String @map("body_text")

  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("terms_of_service")
}
```

- [ ] **Step 2: Prisma Clientを再生成する**

Run: `npx prisma generate`
Expected: `Generated Prisma Client`

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): add TermsOfService singleton table

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

**⚠️ ユーザーへの依頼事項:** `npx prisma migrate dev --name add_terms_of_service`でマイグレーションを作成・適用したあと、以下のSQLで初期行を1件作成しておく：
```sql
INSERT INTO "terms_of_service" ("id", "body_text") VALUES (1, '') ON CONFLICT (id) DO NOTHING;
```

---

### Task 2: `app/actions/terms-of-service.ts`（新規）

**Files:**
- Create: `app/actions/terms-of-service.ts`
- Test: `app/actions/terms-of-service.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/terms-of-service.test.ts`を以下の内容で新規作成する：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTermsOfService, updateTermsOfService } from "./terms-of-service";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/lib/db", () => ({
  prisma: {
    termsOfService: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

describe("getTermsOfService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the stored body text", async () => {
    vi.mocked(prisma.termsOfService.findUnique).mockResolvedValue({
      id: 1,
      bodyText: "第1条 本規約について",
      updatedAt: new Date(),
    } as never);

    const result = await getTermsOfService();

    expect(result).toBe("第1条 本規約について");
    expect(prisma.termsOfService.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it("returns an empty string when no row exists yet", async () => {
    vi.mocked(prisma.termsOfService.findUnique).mockResolvedValue(null);

    const result = await getTermsOfService();

    expect(result).toBe("");
  });
});

describe("updateTermsOfService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts the body text when the caller is an admin", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { role: "hq" } } as never);
    vi.mocked(prisma.termsOfService.upsert).mockResolvedValue({} as never);

    await updateTermsOfService("第1条 本規約について（改訂版）");

    expect(prisma.termsOfService.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      create: { id: 1, bodyText: "第1条 本規約について（改訂版）" },
      update: { bodyText: "第1条 本規約について（改訂版）" },
    });
  });

  it("throws when there is no authenticated admin session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    await expect(updateTermsOfService("本文")).rejects.toThrow("unauthorized");
    expect(prisma.termsOfService.upsert).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run app/actions/terms-of-service.test.ts`
Expected: FAIL（`./terms-of-service`が存在しない）

- [ ] **Step 3: 実装する**

`app/actions/terms-of-service.ts`を以下の内容で新規作成する：

```ts
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

const ADMIN_ROLES = new Set(["hq", "manager", "staff"]);

export async function getTermsOfService(): Promise<string> {
  const record = await prisma.termsOfService.findUnique({ where: { id: 1 } });
  return record?.bodyText ?? "";
}

export async function updateTermsOfService(bodyText: string): Promise<void> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  await prisma.termsOfService.upsert({
    where: { id: 1 },
    create: { id: 1, bodyText },
    update: { bodyText },
  });
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run app/actions/terms-of-service.test.ts`
Expected: PASS（4件）

- [ ] **Step 5: Commit**

```bash
git add app/actions/terms-of-service.ts app/actions/terms-of-service.test.ts
git commit -m "feat: add getTermsOfService/updateTermsOfService server actions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 3: `components/admin/settings-nav.tsx`（新規）＋`layout.tsx`にサイドバー統合

**Files:**
- Create: `components/admin/settings-nav.tsx`
- Modify: `app/admin/(dashboard)/layout.tsx`

- [ ] **Step 1: `settings-nav.tsx`を作成する**

`components/admin/settings-nav.tsx`を以下の内容で新規作成する：

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, ChevronDown, ChevronRight, Terminal, UserCog, ShieldCheck, FileText } from "lucide-react";

const NAV_ICON_SIZE = 16;

const SETTINGS_NAV_ITEMS = [
  { href: "/admin/cron-logs", label: "Cronジョブ実行ログ", icon: Terminal },
  { href: "/admin/accounts", label: "アカウント管理", icon: UserCog },
  { href: "/admin/permissions", label: "権限設定", icon: ShieldCheck },
  { href: "/admin/terms", label: "利用規約設定", icon: FileText },
] as const;

export function SettingsNav() {
  const pathname = usePathname();
  const isInSettings = SETTINGS_NAV_ITEMS.some((item) => pathname.startsWith(item.href));
  const [open, setOpen] = useState(isInSettings);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
      >
        <Settings size={NAV_ICON_SIZE} className="shrink-0 text-neutral-500" />
        設定
        {open ? (
          <ChevronDown size={14} className="ml-auto text-neutral-400" />
        ) : (
          <ChevronRight size={14} className="ml-auto text-neutral-400" />
        )}
      </button>
      {open && (
        <div className="ml-4 flex flex-col gap-1 border-l border-neutral-200 pl-2">
          {SETTINGS_NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
            >
              <Icon size={NAV_ICON_SIZE} className="shrink-0 text-neutral-500" />
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: `layout.tsx`から「Cronジョブ実行ログ」をトップレベルNAV_ITEMSから削除し、`SettingsNav`を組み込む**

`app/admin/(dashboard)/layout.tsx`の以下の行：
```tsx
  { href: "/admin/segment-campaigns", label: "メール／LINE配信管理", icon: Send },
  { href: "/admin/cron-logs", label: "Cronジョブ実行ログ", icon: Terminal },
] as const;
```
を以下に置き換える：
```tsx
  { href: "/admin/segment-campaigns", label: "メール／LINE配信管理", icon: Send },
] as const;
```

同ファイルの`lucide-react`からのimportブロック内、`Terminal`の行（Phase Fで`Repeat`・`FileText`は既に削除済みのため、残っているのは`Terminal`のみ）：
```tsx
  Terminal,
```
を削除する。

同ファイルの以下のimport行：
```tsx
import { AdminHeader } from "@/components/admin/admin-header";
```
の直後に以下を追加する：
```tsx
import { SettingsNav } from "@/components/admin/settings-nav";
```

`<nav>`ブロック内、以下の行：
```tsx
        <nav className="mt-6 flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
            >
              <Icon size={NAV_ICON_SIZE} className="shrink-0 text-neutral-500" />
              {label}
            </Link>
          ))}
        </nav>
```
を以下に置き換える：
```tsx
        <nav className="mt-6 flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
            >
              <Icon size={NAV_ICON_SIZE} className="shrink-0 text-neutral-500" />
              {label}
            </Link>
          ))}
          <SettingsNav />
        </nav>
```

- [ ] **Step 3: `admin-header.tsx`の`PAGE_TITLES`に3エントリを追加する**

`components/admin/admin-header.tsx`の以下の行：
```tsx
  "/admin/cron-logs": "Cronジョブ実行ログ",
```
を以下に置き換える：
```tsx
  "/admin/cron-logs": "Cronジョブ実行ログ",
  "/admin/accounts": "アカウント管理",
  "/admin/permissions": "権限設定",
  "/admin/terms": "利用規約設定",
```

- [ ] **Step 4: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし（`/admin/accounts`・`/admin/permissions`・`/admin/terms`のルート自体はTask 4・5で作成するため、この時点ではまだ存在しないが`PAGE_TITLES`はただの文字列マップなのでエラーにはならない）

- [ ] **Step 5: Commit**

```bash
git add components/admin/settings-nav.tsx "app/admin/(dashboard)/layout.tsx" components/admin/admin-header.tsx
git commit -m "feat: add collapsible settings section to sidebar navigation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 4: プレースホルダーページ（`accounts`・`permissions`）と利用規約管理ページ（`terms`）

**Files:**
- Create: `app/admin/(dashboard)/accounts/page.tsx`
- Create: `app/admin/(dashboard)/permissions/page.tsx`
- Create: `app/admin/(dashboard)/terms/page.tsx`

- [ ] **Step 1: `accounts/page.tsx`をプレースホルダーとして作成する**

`app/admin/(dashboard)/accounts/page.tsx`を以下の内容で新規作成する：

```tsx
export default function AdminAccountsPage() {
  return <p className="text-sm text-neutral-500">準備中です。</p>;
}
```

- [ ] **Step 2: `permissions/page.tsx`をプレースホルダーとして作成する**

`app/admin/(dashboard)/permissions/page.tsx`を以下の内容で新規作成する：

```tsx
export default function AdminPermissionsPage() {
  return <p className="text-sm text-neutral-500">準備中です。</p>;
}
```

- [ ] **Step 3: `terms/page.tsx`（管理画面の編集ページ）を作成する**

`app/admin/(dashboard)/terms/page.tsx`を以下の内容で新規作成する：

```tsx
"use client";

import { useEffect, useState } from "react";
import { getTermsOfService, updateTermsOfService } from "@/app/actions/terms-of-service";

export default function AdminTermsPage() {
  const [bodyText, setBodyText] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    getTermsOfService().then(setBodyText);
  }, []);

  async function handleSave() {
    setSaving(true);
    setSavedMessage(null);
    await updateTermsOfService(bodyText);
    setSaving(false);
    setSavedMessage("保存しました。");
  }

  return (
    <div className="flex flex-col gap-4">
      <textarea
        value={bodyText}
        onChange={(e) => setBodyText(e.target.value)}
        rows={20}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />
      {savedMessage && (
        <p role="status" aria-live="polite" className="text-sm text-neutral-700">
          {savedMessage}
        </p>
      )}
      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="h-12 w-40 rounded-lg bg-primary-500 font-medium text-white disabled:opacity-50"
      >
        保存する
      </button>
    </div>
  );
}
```

- [ ] **Step 4: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 5: Commit**

```bash
git add "app/admin/(dashboard)/accounts/page.tsx" "app/admin/(dashboard)/permissions/page.tsx" "app/admin/(dashboard)/terms/page.tsx"
git commit -m "feat: add terms-of-service admin editor and accounts/permissions placeholders

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 5: 会員向け公開ページ `app/terms/page.tsx`（新規）

**Files:**
- Create: `app/terms/page.tsx`

- [ ] **Step 1: ページを作成する**

`app/terms/page.tsx`を以下の内容で新規作成する（`/admin`配下ではなく、認証不要の公開ページ）：

```tsx
import { getTermsOfService } from "@/app/actions/terms-of-service";

export default async function TermsPage() {
  const bodyText = await getTermsOfService();

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-heading text-2xl text-primary-700">利用規約</h1>
      <pre className="mt-6 whitespace-pre-wrap font-sans text-sm text-neutral-700">
        {bodyText || "準備中です。"}
      </pre>
    </main>
  );
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
git add app/terms/page.tsx
git commit -m "feat: add public terms-of-service page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 6: `auth-step.tsx` — 会員登録フォームに利用規約リンクを追加

**Files:**
- Modify: `components/reservation/auth-step.tsx`

- [ ] **Step 1: 登録ボタンの直前に利用規約リンクを追加する**

`components/reservation/auth-step.tsx`の以下のブロック：
```tsx
          <p className="text-xs text-neutral-500">
            誕生月をご登録いただくと誕生月特典が受け取れます。
          <br/>
            性別は、性別限定コース・オプションの選択可否判定に使用いたします。
          </p>
          <button
            type="button"
            disabled={submitting}
            onClick={handleRegister}
            className="h-12 w-full rounded-lg bg-accent-500 font-medium text-white disabled:opacity-50"
          >
            登録して次へ
          </button>
```
を以下に置き換える：
```tsx
          <p className="text-xs text-neutral-500">
            誕生月をご登録いただくと誕生月特典が受け取れます。
          <br/>
            性別は、性別限定コース・オプションの選択可否判定に使用いたします。
          </p>
          <p className="text-xs text-neutral-500">
            <a href="/terms" target="_blank" className="text-primary-600 underline">
              利用規約
            </a>
            に同意の上、登録してください。
          </p>
          <button
            type="button"
            disabled={submitting}
            onClick={handleRegister}
            className="h-12 w-full rounded-lg bg-accent-500 font-medium text-white disabled:opacity-50"
          >
            登録して次へ
          </button>
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
git add components/reservation/auth-step.tsx
git commit -m "feat: link to terms of service from the member registration form

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

Task 1で案内した通り、マイグレーション適用と初期行の作成が必要。

## 完了条件

- Task 1〜6のコミットが完了している
- `npx tsc --noEmit` / `npx eslint .` / `npx vitest run` がすべてエラーなしで通る
- ユーザーがマイグレーションを適用し、`/admin/terms`での編集と`/terms`での表示を実機で確認する
