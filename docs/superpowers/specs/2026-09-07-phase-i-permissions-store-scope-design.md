# Phase I: 権限設定＋店舗スコープ表示 設計書

- 日付: 2026-09-07
- 対象: フォレスパ（headspa-crm）管理画面
- 位置づけ: 9サブプロジェクト（A〜I）のうち9番目（最後）
- 前提: Phase H（アカウント管理、複数店舗対応の管理者アカウント）が完了していること。

## 背景・目的

1. ロール（hq／manager／staff）ごとに、サイドバーの各ナビ項目単位（ユーザー確定事項）で「編集」「閲覧」「非表示」を設定できるようにする。
2. 店舗別データ（メール／LINE配信管理を除く。メニュー管理・顧客ステータス設定も対象外——ユーザー確定事項、データモデル上店舗と紐付いていないため）は、閲覧している管理者の所属店舗分のみ表示する。ただし顧客の来店履歴（`customers/[id]/page.tsx`の来店履歴タブ）は全店舗分を表示する。hqロールは店舗スコープなし（常に全件）。

この2つは実装難易度が高く、既存の「Server Actionには認証チェックを付けない」「エラーハンドリングを省略する」という、このアプリ全体で既に許容されている設計上のトレードオフ（前回のセッションでユーザーと合意済み）を踏襲する形で、UI層中心の実装とする。Server Action個別に厳密な認可チェックを入れる完全なセキュリティ境界の構築は本Phaseのスコープ外とする（既存の許容済みリスクと同じレベル）。

## データモデル変更

```prisma
model RolePagePermission {
  id      Int              @id @default(autoincrement())
  role    AdminRole
  pageKey String           @db.VarChar(100)
  level   PermissionLevel  @default(edit)

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

`pageKey`にはナビ項目の`href`（例：`/admin/customers`）をそのまま使う。シード時に既存の全ページ×全ロールの組み合わせを`level: "edit"`で作成しておく（デフォルトは今まで通り全ロール編集可能）。

## 権限設定（管理者ロール×ページの編集・閲覧・非表示）

### サーバーアクション（新規 `app/actions/manage-permissions.ts`）

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

### UI（`app/admin/(dashboard)/permissions/page.tsx`、Phase Gのプレースホルダーを置き換える）

行＝ページ（サイドバーの全ナビ項目）、列＝ロール（本部／店長／一般）のマトリクス表。各セルは`<select>`（編集／閲覧／非表示）で`setPermission`を呼ぶ。

### セッションへの反映と適用箇所

`lib/auth/config.ts`のJWTコールバックで、ログイン時（`user`が渡された初回のみ）に`listPermissions()`相当のクエリを実行し、そのロールの`level`が`hidden`のページキー配列を`token.hiddenPageKeys: string[]`、`level`が`view`のページキー配列を`token.viewOnlyPageKeys: string[]`としてトークンに埋め込む。`session`コールバックで`session.hiddenPageKeys`／`session.viewOnlyPageKeys`としてセッションに伝播する。

**既知の制約:** 権限設定を変更しても、既にログイン済みのセッションには次回ログインまで反映されない（`role`自体が既に同じ制約を持っているため、既存の設計と一貫性がある）。

- **非表示（hidden）の適用:** `middleware.ts`の`resolveAccessDecision`（`lib/auth/access-control.ts`）に、現在のパスが`hiddenPageKeys`に含まれる場合は`/admin/dashboard`にリダイレクトする分岐を追加する。サイドバー（`app/admin/(dashboard)/layout.tsx`、Server Component）でも`auth()`のセッションから`hiddenPageKeys`を取得し、`NAV_ITEMS`・`SETTINGS_NAV_ITEMS`から該当項目を除外して描画する。
- **閲覧のみ（view）の適用:** 新規共通コンポーネント`components/admin/permission-gate.tsx`を作成し、各対象ページの最上位`<div>`をこれでラップする。`viewOnlyPageKeys`に現在のページが含まれる場合、`pointer-events-none opacity-60`を適用して全てのボタン・入力を無効化し、ページ上部に「このページは閲覧のみ許可されています」というバナーを表示する。個々のボタン・入力欄を1つずつ無効化するのではなく、ページ全体を一括で操作不可にする簡易的な実装とする（ボタン単位の個別制御は行わない——実装コストとのバランスのため、設計上の意図的な簡略化）。

## 店舗スコープ表示

### 対象ページ（8画面）

ダッシュボード・予約カレンダー・顧客管理・電話予約登録・キャンペーン管理・スタッフ管理・店舗管理・売上レポート。対象外：メール／LINE配信管理（タブ統合後の3タブ全て）・メニュー・料金管理・顧客ステータス設定・顧客詳細の来店履歴タブ・設定配下（Cronログ／アカウント管理／権限設定／利用規約設定）。

### サーバーアクション（新規 `app/actions/current-admin-scope.ts`）

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

### 適用方法

対象8ページそれぞれの初回`useEffect`で`getCurrentAdminStoreScope()`を呼び、`isUnrestricted`が`false`の場合：
- ダッシュボード・予約カレンダー・スタッフ管理（Phase Eで単一`<select>`化済み）：店舗`<select>`の選択肢を`stores.filter(s => scope.storeIds.includes(s.id))`に絞り込み、`storeIds.length === 1`なら自動的にその店舗を選択状態にする（切り替え不要にする）。
- 顧客管理：`searchCustomers`の呼び出しに`storeIds: scope.storeIds`を追加する（Phase Bで`storeIds`パラメータ化済みの絞り込みをそのまま使う）。
- 電話予約登録：店舗選択肢を上記と同様に絞り込む。
- キャンペーン管理：一覧取得後にクライアント側で`c.storeIds.length === 0 || c.storeIds.some(id => scope.storeIds.includes(id))`でフィルタする（Phase Dで店舗複数化済みのデータを使う）。
- 店舗管理：一覧を`stores.filter(s => scope.storeIds.includes(s.id))`に絞り込む。「＋新規登録」ボタンは非hqロールでは非表示にする（新規店舗は本部のみが作成する運用と判断）。
- 売上レポート：既存の店舗`<select>`の選択肢を同様に絞り込む。

いずれもクライアント側のフィルタリングであり、Server Action自体に`auth()`ベースの強制はかけない（本Phase冒頭に記載した既存の許容済みトレードオフに合わせる）。

## テスト方針

- `manage-permissions.ts`・`current-admin-scope.ts`の全関数をTDDで新規テストを書く。
- `resolveAccessDecision`（`access-control.ts`）への`hiddenPageKeys`分岐追加は、既存のテストファイル（存在する場合）に新規ケースを追加する形でTDDを行う。
- ページ・UIコンポーネントはテスト対象外（既存踏襲）。

## 影響範囲

- `lib/auth/config.ts`のJWT/sessionコールバックの型（`next-auth.d.ts`等の型拡張ファイルがあれば確認する）に`hiddenPageKeys`・`viewOnlyPageKeys`を追加する必要がある。
- 対象8ページはPhase A〜Fで既に手を入れているため、実装順序としてPhase Iは他の全Phase完了後に着手する（既に確定している順序と一致）。
