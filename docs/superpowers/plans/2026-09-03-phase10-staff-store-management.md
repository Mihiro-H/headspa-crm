# フォレスパ Phase 10: スタッフ管理・店舗管理（A-11・A-12） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理画面のA-11（スタッフ管理・指名料金設定）・A-12（店舗管理）を実装する。

**Architecture:** 既存の`app/admin/(dashboard)/`配下に新しいページを追加する。

**Tech Stack:** Next.js App Router / TypeScript / Tailwind v4（既存Phase 0〜9基盤を使用）

**参照元資料:** `02_screenspecification.md`（A-11・A-12節）

**このPhaseで作らないもの:** スタッフの新規追加・写真アップロード（在籍中スタッフの指名料金編集・在籍フラグ切替のみとする）、店舗の新規追加（既存4店舗の営業時間・住所編集のみ）、店舗休業日カレンダーのUI（`store_holidays`テーブルへのCRUD UIは別タスクとする）。

> **実行環境に関する注記（継承）:** `.git`書き込み不可（コミットは後回し）、`.env`系ファイル読み書き不可、`npm run build`/`npm run dev`は不安定（`tsc --noEmit`/`eslint`/`vitest`を使う）。UIコンポーネントは軽量検証（tsc/eslintのみ）、データ取得・更新系Server ActionsはTDD。

---

## Task 1: スタッフ管理Server Action（TDD）

**Files:**
- Create: `app/actions/manage-staff.ts`
- Test: `app/actions/manage-staff.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/manage-staff.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listAllStaff, updateStaff } from "./manage-staff";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    staff: { findMany: vi.fn(), update: vi.fn() },
  },
}));

describe("listAllStaff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all staff with store name, ordered by store then id", async () => {
    vi.mocked(prisma.staff.findMany).mockResolvedValue([
      {
        id: 1,
        name: "田中 花子",
        bio: "得意メニュー：頭皮ケア",
        nominationFee: 1000,
        isActive: true,
        store: { id: 2, name: "フォレスパ 渋谷店" },
      },
    ] as never);

    const result = await listAllStaff();

    expect(result).toEqual([
      {
        id: 1,
        name: "田中 花子",
        bio: "得意メニュー：頭皮ケア",
        nominationFee: 1000,
        isActive: true,
        storeId: 2,
        storeName: "フォレスパ 渋谷店",
      },
    ]);
    expect(prisma.staff.findMany).toHaveBeenCalledWith({
      include: { store: true },
      orderBy: [{ storeId: "asc" }, { id: "asc" }],
    });
  });
});

describe("updateStaff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates nomination fee and active flag", async () => {
    vi.mocked(prisma.staff.update).mockResolvedValue({} as never);

    await updateStaff({ staffId: 1, nominationFee: 1500, isActive: false });

    expect(prisma.staff.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { nominationFee: 1500, isActive: false },
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run app/actions/manage-staff.test.ts
```

Expected: FAIL

- [ ] **Step 3: 実装する**

`app/actions/manage-staff.ts`:

```typescript
"use server";

import { prisma } from "@/lib/db";

export interface ManagedStaff {
  id: number;
  name: string;
  bio: string | null;
  nominationFee: number;
  isActive: boolean;
  storeId: number;
  storeName: string;
}

export async function listAllStaff(): Promise<ManagedStaff[]> {
  const staff = await prisma.staff.findMany({
    include: { store: true },
    orderBy: [{ storeId: "asc" }, { id: "asc" }],
  });

  return staff.map((s) => ({
    id: s.id,
    name: s.name,
    bio: s.bio,
    nominationFee: s.nominationFee,
    isActive: s.isActive,
    storeId: s.store.id,
    storeName: s.store.name,
  }));
}

export interface UpdateStaffParams {
  staffId: number;
  nominationFee: number;
  isActive: boolean;
}

export async function updateStaff(params: UpdateStaffParams): Promise<void> {
  await prisma.staff.update({
    where: { id: params.staffId },
    data: { nominationFee: params.nominationFee, isActive: params.isActive },
  });
}
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx vitest run app/actions/manage-staff.test.ts
```

Expected: PASS（2 tests）

- [ ] **Step 5: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 2: 店舗管理Server Action（TDD）

**Files:**
- Create: `app/actions/manage-stores.ts`
- Test: `app/actions/manage-stores.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/manage-stores.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listAllStoresForManagement, updateStoreDetails } from "./manage-stores";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    store: { findMany: vi.fn(), update: vi.fn() },
  },
}));

describe("listAllStoresForManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all stores ordered by id", async () => {
    vi.mocked(prisma.store.findMany).mockResolvedValue([
      {
        id: 1,
        name: "フォレスパ 東京丸の内本店",
        address: "東京都千代田区...",
        phone: "03-0000-0001",
        nearestStation: "東京駅 徒歩5分",
      },
    ] as never);

    const result = await listAllStoresForManagement();

    expect(result).toEqual([
      {
        id: 1,
        name: "フォレスパ 東京丸の内本店",
        address: "東京都千代田区...",
        phone: "03-0000-0001",
        nearestStation: "東京駅 徒歩5分",
      },
    ]);
    expect(prisma.store.findMany).toHaveBeenCalledWith({ orderBy: { id: "asc" } });
  });
});

describe("updateStoreDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates address and phone", async () => {
    vi.mocked(prisma.store.update).mockResolvedValue({} as never);

    await updateStoreDetails({ storeId: 1, address: "新住所", phone: "03-1111-1111" });

    expect(prisma.store.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { address: "新住所", phone: "03-1111-1111" },
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run app/actions/manage-stores.test.ts
```

Expected: FAIL

- [ ] **Step 3: 実装する**

`app/actions/manage-stores.ts`:

```typescript
"use server";

import { prisma } from "@/lib/db";

export interface ManagedStore {
  id: number;
  name: string;
  address: string | null;
  phone: string;
  nearestStation: string | null;
}

export async function listAllStoresForManagement(): Promise<ManagedStore[]> {
  const stores = await prisma.store.findMany({ orderBy: { id: "asc" } });
  return stores.map((s) => ({
    id: s.id,
    name: s.name,
    address: s.address,
    phone: s.phone,
    nearestStation: s.nearestStation,
  }));
}

export interface UpdateStoreDetailsParams {
  storeId: number;
  address: string;
  phone: string;
}

export async function updateStoreDetails(params: UpdateStoreDetailsParams): Promise<void> {
  await prisma.store.update({
    where: { id: params.storeId },
    data: { address: params.address, phone: params.phone },
  });
}
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx vitest run app/actions/manage-stores.test.ts
```

Expected: PASS（2 tests）

- [ ] **Step 5: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 3: スタッフ管理UI（軽量検証）

**Files:**
- Create: `app/admin/(dashboard)/staff/page.tsx`

- [ ] **Step 1: 実装する**

`app/admin/(dashboard)/staff/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { listAllStaff, updateStaff, type ManagedStaff } from "@/app/actions/manage-staff";

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<ManagedStaff[]>([]);
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    listAllStaff().then(setStaff);
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

  const grouped = staff.reduce<Record<string, ManagedStaff[]>>((acc, s) => {
    acc[s.storeName] = acc[s.storeName] ?? [];
    acc[s.storeName].push(s);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl text-primary-700">スタッフ管理</h1>

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

## Task 4: 店舗管理UI（軽量検証）

**Files:**
- Create: `app/admin/(dashboard)/stores/page.tsx`

- [ ] **Step 1: 実装する**

`app/admin/(dashboard)/stores/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  listAllStoresForManagement,
  updateStoreDetails,
  type ManagedStore,
} from "@/app/actions/manage-stores";

export default function AdminStoresPage() {
  const [stores, setStores] = useState<ManagedStore[]>([]);
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    listAllStoresForManagement().then(setStores);
  }, []);

  async function handleSave(storeId: number, address: string, phone: string) {
    setSaving(storeId);
    await updateStoreDetails({ storeId, address, phone });
    setSaving(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl text-primary-700">店舗管理</h1>

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
    </div>
  );
}
```

- [ ] **Step 2: サイドバーにリンクを追加する**

`app/admin/(dashboard)/layout.tsx`の`<nav>`内、「キャンペーン管理」リンクの後に以下を追加する:

```tsx
          <Link
            href="/admin/staff"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            スタッフ管理
          </Link>
          <Link
            href="/admin/stores"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            店舗管理
          </Link>
```

- [ ] **Step 3: 型チェックとLintを実行する**

```bash
npx tsc --noEmit
npx eslint .
```

- [ ] **Step 4: 全テストスイートを実行する**

```bash
npx vitest run
```

Expected: 既存の132テスト＋新規4テスト（Task1×2, Task2×2）＝136テストがパスする

- [ ] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## 完了確認チェックリスト

- [ ] `npx vitest run` の全テストがパスする
- [ ] `npx tsc --noEmit` がエラーなく通る
- [ ] `npx eslint .` がエラーなく通る
- [ ] `/admin/staff`で指名料金編集・在籍フラグ切替、`/admin/stores`で住所・電話番号編集をユーザーがブラウザで確認する（`npm run dev`はこのサンドボックスでは起動確認できないため、ユーザーのターミナルで確認する）
