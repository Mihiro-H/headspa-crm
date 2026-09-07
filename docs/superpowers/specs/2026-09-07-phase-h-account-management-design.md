# Phase H: アカウント管理 設計書

- 日付: 2026-09-07
- 対象: フォレスパ（headspa-crm）管理画面
- 位置づけ: 9サブプロジェクト（A〜I）のうち8番目

## 背景・目的

`/admin/accounts`（Phase Gでプレースホルダーとして確保済み）に、管理者アカウント（`Admin`テーブル）の一覧・新規作成・編集機能を実装する。氏名・メールアドレス・所属店舗（複数選択）・ロール（既存3段階、ユーザー確定事項）・状態（アクティブ／アーカイブ）をテーブル表示し、編集ボタンで各項目を変更できるようにする。新規作成時は仮パスワードを発行し、作成した管理者の画面に一度だけ表示する（強制変更フローは実装しない、ユーザー確定事項）。

## データモデル変更

`Admin.storeId`（単一・nullable FK）を廃止し、多対多の中間テーブル`AdminStore`を新設する（Phase Bの`MemberStore`、Phase Dの`CampaignStoreTarget`と全く同じパターン）：

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

`model Admin`に`isActive Boolean @default(true) @map("is_active")`を追加する（`Member.isActive`と同じパターン）。`storeId`・`store`リレーションを削除し、`stores AdminStore[]`を追加する。`model Store`から`admins Admin[]`（`storeId`由来）を削除し、`adminStores AdminStore[]`を追加する。

**移行:** 既存の`storeId`が設定されている管理者（`role`が`manager`/`staff`）は対応する`AdminStore`行を1件作成してから`store_id`カラムを削除する。`role === "hq"`の管理者は元々`storeId`が`null`（全店舗）だったため、`AdminStore`行は作成しない（Iで「hqロールは店舗スコープなし」として扱う）。

**注意:** `lib/auth/admin-credentials.ts`（ログイン時のセッションに`storeId`を含めている場合）・`middleware.ts`・`lib/auth/access-control.ts`が`Admin.storeId`を参照していないか実装タスクの最初に確認する（現状は`role`のみセッションに載せているため影響なしの見込み）。

## サーバーアクション（新規 `app/actions/manage-admins.ts`）

```ts
"use server";

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import type { AdminRole } from "@prisma/client";

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

function generateTemporaryPassword(): string {
  // 12桁の英数字ランダム文字列。crypto.randomUUID()の一部を流用する。
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
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

`lib/auth/admin-credentials.ts`の`authorizeAdmin`に`isActive: true`の絞り込みを追加し、アーカイブ済み管理者がログインできないようにする（`Member.isActive`が現状ログインをブロックしていないのとは異なり、管理者アカウントは実際にアクセス制御として機能させる——H自体がアクセス管理機能のため）。

## UI変更（`app/admin/(dashboard)/accounts/page.tsx`）

`customers/page.tsx`と同じ構造（一覧テーブル＋新規登録モーダル＋編集モーダル＋Trash2/RotateCcwアイコン）：
- 列: 氏名・メールアドレス・所属店舗（`storeNames.join("、")`、hqロールの場合は「全店舗」固定表示）・ロール（日本語ラベル：本部／店長／一般）・状態（アクティブ／アーカイブ、`isActive`に応じたバッジ）・編集アイコン・アーカイブ／復帰アイコン。
- 新規登録モーダル：氏名・メールアドレス・ロール（`<select>`）・所属店舗（チェックボックス群、ロールが`hq`の場合は非表示にして自動的に全店舗扱いとする）。作成成功後、モーダル内に発行された仮パスワードを1回だけ表示する（`window.confirm`ではなく画面上のテキストとして表示し、コピーできるようにする）。
- 編集モーダル：氏名・ロール・所属店舗のみ（メールアドレスは不変、パスワード変更は本Phaseのスコープ外）。

## テスト方針

- `manage-admins.ts`の全関数をTDDで新規テストを書く。
- ページはテスト対象外（既存踏襲）。

## 影響範囲

- `lib/auth/admin-credentials.ts`の`AuthorizedAdmin`インターフェースが`storeId: number | null`を持ち、`authorizeAdmin`が`admin.storeId`を返している（確認済み）。これを`storeIds: number[]`（`AdminStore`から取得）に変更する。ただし現状`lib/auth/config.ts`のJWTコールバックは`token.id`・`token.role`のみをセッションに積んでおり、`storeId`自体はこれまでセッションに伝播していなかった（未使用のデッドコードだった）。店舗スコープ表示の実装（Phase I）で初めて`token.storeIds`をセッションに積む必要が生じるため、本Phaseでは`AuthorizedAdmin.storeIds`への型変更のみ行い、`config.ts`のコールバック更新はPhase Iに委ねる。
