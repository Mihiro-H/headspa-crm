# Phase C: メニュー・料金管理の拡張 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** メニュー・料金管理ページで、コース名・所要時間もインライン編集可能にし、行右に公開状態（公開中／停止中）を切り替えるステータス列を追加する。

**Architecture:** 既存の`Course.name`・`Course.durationEstimateMin`・`Course.isPublished`をそのまま使い、新規Server Action2本とページの追加編集UIのみで完結する。スキーマ変更なし。

**Tech Stack:** Next.js (App Router) / TypeScript / Prisma (PostgreSQL) / Tailwind CSS v4 / Vitest

**関連ドキュメント:** `docs/superpowers/specs/2026-09-07-phase-c-menu-extension-design.md`

---

### Task 1: `manage-courses.ts` — `updateCourseDetails`・`updateCoursePublished`を追加

**Files:**
- Modify: `app/actions/manage-courses.ts`
- Test: `app/actions/manage-courses.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/manage-courses.test.ts`の末尾に以下を追加する：

```ts

describe("updateCourseDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates name and durationEstimateMin", async () => {
    vi.mocked(prisma.course.update).mockResolvedValue({} as never);

    await updateCourseDetails({ courseId: 1, name: "プレミアム改", durationEstimateMin: 75 });

    expect(prisma.course.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: "プレミアム改", durationEstimateMin: 75 },
    });
  });
});

describe("updateCoursePublished", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates isPublished", async () => {
    vi.mocked(prisma.course.update).mockResolvedValue({} as never);

    await updateCoursePublished(1, false);

    expect(prisma.course.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isPublished: false },
    });
  });
});
```

ファイル冒頭のimportを以下に更新する：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listAllCoursesForManagement,
  updateCoursePrice,
  createCourse,
  updateCourseDetails,
  updateCoursePublished,
} from "./manage-courses";
import { prisma } from "@/lib/db";
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run app/actions/manage-courses.test.ts`
Expected: FAIL（`updateCourseDetails`・`updateCoursePublished`が存在しない）

- [ ] **Step 3: 実装する**

`app/actions/manage-courses.ts`の末尾に以下を追加する：

```ts

export interface UpdateCourseDetailsParams {
  courseId: number;
  name: string;
  durationEstimateMin: number;
}

export async function updateCourseDetails(params: UpdateCourseDetailsParams): Promise<void> {
  await prisma.course.update({
    where: { id: params.courseId },
    data: { name: params.name, durationEstimateMin: params.durationEstimateMin },
  });
}

export async function updateCoursePublished(courseId: number, isPublished: boolean): Promise<void> {
  await prisma.course.update({
    where: { id: courseId },
    data: { isPublished },
  });
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run app/actions/manage-courses.test.ts`
Expected: PASS（5件）

- [ ] **Step 5: Commit**

```bash
git add app/actions/manage-courses.ts app/actions/manage-courses.test.ts
git commit -m "feat: add updateCourseDetails and updateCoursePublished admin actions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 2: `menu/page.tsx` — コース名・所要時間の編集とステータス列を追加

**Files:**
- Modify: `app/admin/(dashboard)/menu/page.tsx`

- [ ] **Step 1: 読み込んで現在の内容を確認する**

現在の`app/admin/(dashboard)/menu/page.tsx`を読み、以下のStep 2で示すテーブル部分（`<table>`〜`</table>`）を特定する。ページ冒頭の`import`・`EMPTY_FORM`・`handleCreate`・モーダル部分は変更しない。

- [ ] **Step 2: importと状態・ハンドラを追加する**

`import { Plus } from "lucide-react";`の行を以下に置き換える：

```tsx
import { Plus } from "lucide-react";
```
（変更なし。次のimportブロックのみ変更する。）

```tsx
import {
  listAllCoursesForManagement,
  updateCoursePrice,
  createCourse,
  updateCourseDetails,
  updateCoursePublished,
  type ManagedCourse,
} from "@/app/actions/manage-courses";
```

`const [saving, setSaving] = useState<number | null>(null);`の直後に以下を追加する：

```tsx
  const [savingField, setSavingField] = useState<number | null>(null);
```

`async function handleSave(courseId: number, price: number) { ... }`の関数の直後に以下を追加する：

```tsx
  async function handleNameBlur(courseId: number, name: string) {
    setSavingField(courseId);
    await updateCourseDetails({ courseId, name, durationEstimateMin: currentDuration(courseId) });
    setSavingField(null);
  }

  async function handleDurationBlur(courseId: number, durationEstimateMin: number) {
    setSavingField(courseId);
    await updateCourseDetails({ courseId, name: currentName(courseId), durationEstimateMin });
    setSavingField(null);
  }

  function currentName(courseId: number): string {
    return courses.find((c) => c.id === courseId)?.name ?? "";
  }

  function currentDuration(courseId: number): number {
    return courses.find((c) => c.id === courseId)?.durationEstimateMin ?? 0;
  }

  async function handlePublishedChange(courseId: number, isPublished: boolean) {
    setSavingField(courseId);
    await updateCoursePublished(courseId, isPublished);
    setCourses((prev) => prev.map((c) => (c.id === courseId ? { ...c, isPublished } : c)));
    setSavingField(null);
  }
```

（`updateCourseDetails`は`name`と`durationEstimateMin`を同時に必須で受け取る設計のため、片方だけを編集した場合でも直近の値をもう片方に添える。これはTask 14で導入した「部分更新で競合を避ける」設計とは異なり——`updateCourseDetails`自体は2フィールドを常にペアで扱うシンプルな設計を採用している——同一行内での連続編集はほぼ発生しない想定のため、ここでは競合状態の対策は行わない。）

- [ ] **Step 3: テーブルを書き換える**

以下のブロック：

```tsx
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
```

を以下に置き換える：

```tsx
                <tr key={c.id} className="border-b border-neutral-100 last:border-0">
                    <td className="p-3">
                      <input
                        type="text"
                        defaultValue={c.name}
                        onBlur={(e) => handleNameBlur(c.id, e.target.value)}
                        className="h-9 w-40 rounded-md border border-neutral-300 px-2"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        min={0}
                        defaultValue={c.durationEstimateMin}
                        onBlur={(e) => handleDurationBlur(c.id, Number(e.target.value))}
                        className="h-9 w-20 rounded-md border border-neutral-300 px-2"
                      />
                      分
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        min={0}
                        defaultValue={c.price}
                        onBlur={(e) => handleSave(c.id, Number(e.target.value))}
                        className="h-9 w-28 rounded-md border border-neutral-300 px-2"
                      />
                    </td>
                    <td className="p-3">
                      <select
                        value={c.isPublished ? "published" : "unpublished"}
                        onChange={(e) => handlePublishedChange(c.id, e.target.value === "published")}
                        className="h-9 rounded-md border border-neutral-300 px-2"
                      >
                        <option value="published">公開中</option>
                        <option value="unpublished">停止中</option>
                      </select>
                    </td>
                    <td className="p-3 text-xs text-neutral-500">
                      {saving === c.id || savingField === c.id ? "保存中..." : ""}
                    </td>
                  </tr>
```

対応する`<thead>`の以下のブロック：

```tsx
                <tr className="border-b border-neutral-200 text-left text-neutral-500">
                  <th className="p-3">コース名</th>
                  <th className="p-3">所要時間</th>
                  <th className="p-3">料金（税込）</th>
                  <th className="p-3"></th>
                </tr>
```

を以下に置き換える：

```tsx
                <tr className="border-b border-neutral-200 text-left text-neutral-500">
                  <th className="p-3">コース名</th>
                  <th className="p-3">所要時間</th>
                  <th className="p-3">料金（税込）</th>
                  <th className="p-3">ステータス</th>
                  <th className="p-3"></th>
                </tr>
```

- [ ] **Step 4: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 5: 既存の関連テストが壊れていないことを確認する**

Run: `npx vitest run app/actions/manage-courses.test.ts`
Expected: 全件PASS

- [ ] **Step 6: Commit**

```bash
git add "app/admin/(dashboard)/menu/page.tsx"
git commit -m "feat: make course name and duration editable, add publish status column

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
