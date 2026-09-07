# Phase G: 設定セクション新設 設計書

- 日付: 2026-09-07
- 対象: フォレスパ（headspa-crm）管理画面
- 位置づけ: 9サブプロジェクト（A〜I）のうち7番目

## 背景・目的

サイドバーに「設定」セクションを新設し、現在フラットなナビゲーション項目である「Cronジョブ実行ログ」をその配下に移す。加えて「アカウント管理」（Phase H）・「権限設定」（Phase I）・「利用規約設定」（本Phaseで実装）の3項目を設定配下に追加する。本Phaseでは設定セクションの器（サイドバーの入れ子ナビ・設定トップページ）と、その中身のうち「利用規約設定」のみを実装する。「アカウント管理」「権限設定」の中身はPhase H・Iで実装する（本Phaseの時点ではリンク先にプレースホルダーページを置く）。

## サイドバー構成

現在のサイドバーはフラットな`<Link>`の並び（`app/admin/(dashboard)/layout.tsx`の`NAV_ITEMS`）。「設定」は展開／折りたたみ可能な入れ子ナビとして追加する（別ページに飛ぶランディングページ方式ではなく、クリックで配下の4項目がその場に展開されるアコーディオン形式——ユーザーが「その他、アカウント管理、権限設定、利用規約設定を追加する」と並列に列挙していることから、独立した4リンクとして扱うのが自然なため）。

`NAV_ITEMS`を以下のように再構成する：
- トップレベル項目はこれまで通りのフラットな配列を維持しつつ、「Cronジョブ実行ログ」を配列から削除する。
- 新しい`SETTINGS_NAV_ITEMS`配列（Cronジョブ実行ログ・アカウント管理・権限設定・利用規約設定の4件）を定義する。
- サイドバーに「設定」というクリック可能な見出し（`Settings`アイコン、`lucide-react`に存在確認済み）を追加し、クリックで`SETTINGS_NAV_ITEMS`の4リンクが展開／折りたたみされる（`useState`でopen/closed管理。現在のパスが設定配下の場合はデフォルトで展開しておく）。
- サイドバーはこの変更に伴い`app/admin/(dashboard)/layout.tsx`内で`"use client"`が必要になる（現在はサーバーコンポーネント）。あるいは、開閉状態を持つ部分だけを新規クライアントコンポーネント`components/admin/settings-nav.tsx`に切り出し、`layout.tsx`自体はサーバーコンポーネントのまま維持する（こちらを採用——他の部分への影響が最小）。

`components/admin/admin-header.tsx`の`PAGE_TITLES`に以下を追加する：
- `/admin/accounts`: "アカウント管理"
- `/admin/permissions`: "権限設定"
- `/admin/terms`: "利用規約設定"

## データモデル変更（利用規約）

```prisma
model TermsOfService {
  id        Int      @id @default(1)
  bodyText  String
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("terms_of_service")
}
```

単一行のみを想定するシングルトンテーブル（`id`は常に`1`固定）。シード時に空文字または初期文言で1行作成しておく。

## サーバーアクション（新規 `app/actions/terms-of-service.ts`）

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

## UI変更

### 管理画面 `app/admin/(dashboard)/terms/page.tsx`（新規）

`<textarea>`1つと保存ボタンのみのシンプルなページ。`getTermsOfService`で初期値を読み込み、`updateTermsOfService`で保存する。

### 会員向け公開ページ `app/terms/page.tsx`（新規、`/admin`配下ではない）

`getTermsOfService`の内容を`<pre className="whitespace-pre-wrap">`で表示するだけの静的表示ページ。認証不要（未ログインでも閲覧可能）。

### `components/reservation/auth-step.tsx`

会員登録フォームの送信ボタン付近に「利用規約に同意の上、登録してください」という文言と`/terms`へのリンク（`<a href="/terms" target="_blank">`）を追加する。同意チェックボックスによる必須化（登録をブロックする機能）は本Phaseのスコープ外——リンク表示のみ。

### `app/admin/(dashboard)/accounts/page.tsx`・`app/admin/(dashboard)/permissions/page.tsx`（本Phaseではプレースホルダー）

Phase H・Iで実装するまでの間、「準備中です」という1行だけの仮ページを置く（設定ナビのリンク切れを防ぐため）。Phase H・Iのタスクでこの仮実装を置き換える。

## テスト方針

- `getTermsOfService`・`updateTermsOfService`はTDDで新規テストを書く。
- ページ・サイドバーコンポーネントはテスト対象外（既存踏襲）。

## 影響範囲

- `layout.tsx`のナビゲーション構造が変わるため、Phase Aで追加した`admin-header.tsx`の`PAGE_TITLES`と整合させる必要がある。
