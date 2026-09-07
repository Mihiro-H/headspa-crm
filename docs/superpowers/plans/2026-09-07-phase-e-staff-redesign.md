# Phase E: スタッフ管理の再設計 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スタッフ管理ページの店舗別グループ表示を単一テーブル＋ドロップダウン店舗フィルターに変更し、氏名・紹介文・所属店舗を編集できる編集モーダルと、在籍チェックボックスに代わるアーカイブ（Trash2/RotateCcw）アイコンを追加する。

**Architecture:** `Staff.storeId`・`Staff.isActive`・`Staff.bio`は変更なし（スキーマ変更なし）。新規Server Action`updateStaffProfile`（氏名・紹介文・所属店舗の一括更新）を追加し、ページを`calendar/page.tsx`と同じ単一`<select>`店舗フィルター＋`customers/page.tsx`と同じ編集モーダル・アイコン列の構造に全面書き換えする。

**Tech Stack:** Next.js (App Router) / TypeScript / Prisma (PostgreSQL) / Tailwind CSS v4 / Vitest

**関連ドキュメント:** `docs/superpowers/specs/2026-09-07-phase-e-staff-redesign-design.md`

**前提:** Phase A（実装順序上先に完了。`staff/page.tsx`の`<h1>`が削除され、ヘッダー行が`justify-between`→`justify-end`になっている状態が本Planの出発点）。

---

### Task 1: `manage-staff.ts` — `updateStaffProfile`を追加

**Files:**
- Modify: `app/actions/manage-staff.ts`
- Test: `app/actions/manage-staff.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/manage-staff.test.ts`が存在するか確認する（存在しない場合はStep 1aから、存在する場合はStep 1bから進める）。

**Step 1a（ファイルが存在しない場合）:** 以下の内容で新規作成する：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateStaffProfile } from "./manage-staff";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    staff: { update: vi.fn() },
  },
}));

describe("updateStaffProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates name, bio, and storeId", async () => {
    vi.mocked(prisma.staff.update).mockResolvedValue({} as never);

    await updateStaffProfile({ staffId: 1, name: "山田花子", bio: "頭皮ケア歴10年", storeId: 2 });

    expect(prisma.staff.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: "山田花子", bio: "頭皮ケア歴10年", storeId: 2 },
    });
  });

  it("allows clearing bio to null", async () => {
    vi.mocked(prisma.staff.update).mockResolvedValue({} as never);

    await updateStaffProfile({ staffId: 1, name: "山田花子", bio: null, storeId: 2 });

    expect(prisma.staff.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: "山田花子", bio: null, storeId: 2 },
    });
  });
});
```

**Step 1b（ファイルが既に存在する場合）:** 既存のimportに`updateStaffProfile`を追加し、末尾に上記の`describe("updateStaffProfile", ...)`ブロックを追加する。

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run app/actions/manage-staff.test.ts`
Expected: FAIL（`updateStaffProfile`が存在しない）

- [ ] **Step 3: 実装する**

`app/actions/manage-staff.ts`の末尾に以下を追加する：

```ts

export interface UpdateStaffProfileParams {
  staffId: number;
  name: string;
  bio: string | null;
  storeId: number;
}

export async function updateStaffProfile(params: UpdateStaffProfileParams): Promise<void> {
  await prisma.staff.update({
    where: { id: params.staffId },
    data: { name: params.name, bio: params.bio, storeId: params.storeId },
  });
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run app/actions/manage-staff.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/actions/manage-staff.ts app/actions/manage-staff.test.ts
git commit -m "feat: add updateStaffProfile admin action for staff name/bio/store edits

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 2: `staff/page.tsx` — 単一テーブル化・店舗ドロップダウン・編集モーダル・アーカイブアイコン

**Files:**
- Modify: `app/admin/(dashboard)/staff/page.tsx`

- [ ] **Step 1: ページ全体を書き換える**

`app/admin/(dashboard)/staff/page.tsx` を以下の内容に置き換える：

```tsx
"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, RotateCcw } from "lucide-react";
import {
  listAllStaff,
  updateStaff,
  updateStaffProfile,
  createStaff,
  type ManagedStaff,
} from "@/app/actions/manage-staff";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { Modal } from "@/components/ui/modal";

const EMPTY_FORM = { storeId: null as number | null, name: "", bio: "", nominationFee: 0 };
const EMPTY_EDIT_FORM = { name: "", bio: "", storeId: null as number | null };

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<ManagedStaff[]>([]);
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [storeFilter, setStoreFilter] = useState<number | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState<ManagedStaff | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [editSaving, setEditSaving] = useState(false);

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

  function startEdit(member: ManagedStaff) {
    setEditing(member);
    setEditForm({ name: member.name, bio: member.bio ?? "", storeId: member.storeId });
  }

  async function handleSaveEdit() {
    if (!editing || !editForm.storeId) return;
    setEditSaving(true);
    await updateStaffProfile({
      staffId: editing.id,
      name: editForm.name,
      bio: editForm.bio || null,
      storeId: editForm.storeId,
    });
    setEditSaving(false);
    setEditing(null);
    reload();
  }

  const visibleStaff = storeFilter === null ? staff : staff.filter((s) => s.storeId === storeFilter);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
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
        <button
          type="button"
          onClick={() => setModalOpen(true)}
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
              <th className="p-3">紹介文</th>
              {storeFilter === null && <th className="p-3">所属店舗</th>}
              <th className="p-3">指名料金</th>
              <th className="p-3">在籍</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {visibleStaff.map((s) => (
              <tr key={s.id} className="border-b border-neutral-100 last:border-0">
                <td className="p-3">{s.name}</td>
                <td className="p-3 text-neutral-500">{s.bio ?? "—"}</td>
                {storeFilter === null && <td className="p-3">{s.storeName}</td>}
                <td className="p-3">
                  <input
                    type="number"
                    min={0}
                    defaultValue={s.nominationFee}
                    onBlur={(e) => handleFeeBlur(s, Number(e.target.value))}
                    className="h-9 w-24 rounded-md border border-neutral-300 px-2"
                  />
                </td>
                <td className="p-3">{s.isActive ? "在籍中" : "退職"}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(s)}
                      className="text-neutral-500 hover:text-primary-600"
                      aria-label="編集"
                    >
                      <Pencil size={16} />
                    </button>
                    {s.isActive ? (
                      <button
                        type="button"
                        onClick={() => handleToggleActive(s)}
                        className="text-neutral-500 hover:text-error"
                        aria-label="退職扱いにする"
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleActive(s)}
                        className="text-neutral-500 hover:text-primary-600"
                        aria-label="在籍中に戻す"
                      >
                        <RotateCcw size={16} />
                      </button>
                    )}
                    {saving === s.id && <span className="text-xs text-neutral-500">保存中...</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleStaff.length === 0 && (
          <p className="p-6 text-center text-sm text-neutral-500">該当するスタッフがいません。</p>
        )}
      </div>

      <Modal open={modalOpen} onOpenChange={setModalOpen} title="新規スタッフ登録">
        <div className="flex flex-col gap-3">
          <select
            value={form.storeId ?? ""}
            onChange={(e) => setForm({ ...form, storeId: e.target.value ? Number(e.target.value) : null })}
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

      <Modal
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="スタッフ情報を編集"
      >
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="氏名"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <textarea
            placeholder="紹介文（任意）"
            value={editForm.bio}
            onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
            rows={3}
            className="rounded-md border border-neutral-300 px-2 py-2"
          />
          <select
            value={editForm.storeId ?? ""}
            onChange={(e) =>
              setEditForm({ ...editForm, storeId: e.target.value ? Number(e.target.value) : null })
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
          <button
            type="button"
            disabled={editSaving || !editForm.name || !editForm.storeId}
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

（Phase A完了後は上記トップレベルの`<div className="flex flex-wrap items-center justify-between gap-4">`が既存のヘッダー行と同じ位置に来る。もしPhase A未実施のままこのTaskを実行する場合は、既存の`<h1 className="font-heading text-2xl text-primary-700">スタッフ管理</h1>`をこのブロック内に残すよう調整すること。）

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: 既存の関連テストが壊れていないことを確認する**

Run: `npx vitest run app/actions/manage-staff.test.ts`
Expected: 全件PASS

- [ ] **Step 4: Commit**

```bash
git add "app/admin/(dashboard)/staff/page.tsx"
git commit -m "feat: redesign staff management with store dropdown filter and edit/archive icons

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 3: 最終検証

- [ ] **Step 1: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 2: Lint**

Run: `npx eslint .`
Expected: エラーなし

- [ ] **Step 3: 全テスト実行**

Run: `npx vitest run`
Expected: 既存テストを含め全件PASS

## 完了条件

- Task 1〜2のコミットが完了している
- `npx tsc --noEmit` / `npx eslint .` / `npx vitest run` がすべてエラーなしで通る
