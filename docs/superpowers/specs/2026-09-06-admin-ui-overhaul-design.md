# 管理画面UI改修 設計書

- 日付: 2026-09-06
- 対象: フォレスパ（headspa-crm）管理画面 `/admin/...`
- フェーズ: ライブ不具合修正／UI改善フェーズの一環
- スコープ外: 管理画面Googleログイン（ユーザー判断により今回は保留）

## 背景・目的

実機テストで蓄積された管理画面のUI・UX改善要望をまとめて実装する。既存の19画面（A-01〜A-14, M-01〜M-06）は機能実装済みだが、以下が未対応：
- ブランドロゴ・アイコンが未反映（テキストのみ、絵文字ベル）
- 顧客／メニュー／スタッフ／店舗の新規作成導線がない
- 顧客・キャンペーンの一覧に行操作（編集・削除）がない
- 顧客一覧のソート・ステータス絞り込みがない
- 顧客ステータスの自動判定が来店回数のみで、利用金額を考慮できない
- キャンペーン管理・配信管理・テンプレート管理が「フォーム先出し」型で、履歴/一覧を主役にした構成になっていない

## 全体アーキテクチャ方針

- 既存パターン（Next.js App Router + Server Actions + Prisma）を踏襲。新規のUI状態管理ライブラリは導入しない
- モーダルは共通コンポーネント `components/ui/modal.tsx` を新規作成し、`radix-ui`（インストール済み）の `Dialog` プリミティブをラップする。以降の「新規作成」「編集」「配信設定」等はすべてこれを再利用する
- アイコンは `lucide-react`（インストール済み）に統一する。新規画像素材は追加しない（ロゴ画像を除く）
- 論理削除（無効化）は各テーブルの真偽値フィールドで表現し、物理削除は行わない
- スキーマ変更は `prisma/schema.prisma` を編集し、ユーザーに `prisma migrate dev` の実行を依頼する（サンドボックス制約によりマイグレーション実行はユーザー側で行う）

## 1. ナビゲーション（サイドバー・ヘッダー）

### データ/資材
- `logo/foresupa_logo_transparent.png` を `public/logo/foresupa_logo_transparent.png` にコピーする

### UI変更
- `app/admin/(dashboard)/layout.tsx` のサイドバー見出し（`<h1>フォレスパ</h1>`）を `next/image` によるロゴ画像表示に置き換える
- サイドバーの各 `<Link>` の先頭に `lucide-react` アイコンを追加する。対応表：

| 画面 | アイコン |
|---|---|
| ダッシュボード | `LayoutDashboard` |
| 予約カレンダー | `CalendarDays` |
| 顧客管理 | `Users` |
| ステータス設定 | `Tag` |
| 電話予約登録 | `PhoneCall` |
| メニュー・料金管理 | `ListChecks` |
| キャンペーン管理 | `Percent` |
| スタッフ管理 | `UserCog` |
| 店舗管理 | `Store` |
| 売上・月報レポート | `BarChart3` |
| メール／LINE配信管理 | `Send` |
| 自動配信設定 | `Repeat` |
| 配信テンプレート管理 | `FileText` |
| Cronジョブ実行ログ | `Terminal` |

- `components/admin/notification-bell.tsx` の絵文字 `🔔` を `lucide-react` の `Bell` アイコン（線画・16〜20px）に置き換える。未読バッジ・開閉ロジックは変更しない

### テスト
- 既存のnotification-bellにユニットテストがあれば、アイコンレンダリングを壊さないことを確認する程度（スナップショット的な厳密テストは行わない。見た目確認はユーザーの実機テストに委ねる）

## 2. 共通モーダルコンポーネント

- `components/ui/modal.tsx` を新規作成。`radix-ui` の `Dialog.Root` / `Dialog.Portal` / `Dialog.Overlay` / `Dialog.Content` をラップし、下記のインターフェースを提供する：

```ts
interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}
```

- 見た目は既存のカード（`rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm`）のトーンに合わせる
- Escキー・オーバーレイクリックで閉じられる（Radix標準機能）
- 各画面はこのモーダルに既存のフォームJSXをそのまま移植する形で利用する

## 3. 新規登録ボタン＋モーダル（顧客／メニュー／スタッフ／店舗）

各一覧ページの右上に「＋新規登録」ボタンを設置し、クリックで登録モーダルを開く。既存のインライン編集（金額・在籍状態のトグルなど）はそのまま維持する。

### 顧客管理
- 新規サーバーアクション `app/actions/admin-create-customer.ts` の `createCustomerByAdmin(params)` を追加
  - 入力：氏名・メール・電話番号・性別・生年月（月のみ）・所属店舗（任意）
  - パスワードは受け取らない（空欄のまま作成。会員本人が別途会員側フローでパスワード設定する想定）。ステータスは `registerMember` と同様に最も若い `sortOrder` の `CustomerStatus` を既定値とする
  - メール重複時は `{ status: "email_taken" }` を返す（`registerMember` と同じ規約）

### メニュー・料金管理
- 新規サーバーアクション `createCourse(params)` を `app/actions/manage-courses.ts` に追加
  - 入力：カテゴリ・コース名・所要時間（分）・施術時間（分）・料金・性別制限・並び順
  - `isPublished` は既定 `true`

### スタッフ管理
- 新規サーバーアクション `createStaff(params)` を `app/actions/manage-staff.ts` に追加
  - 入力：所属店舗・氏名・紹介文（任意）・指名料金
  - `isActive` は既定 `true`

### 店舗管理
- 新規サーバーアクション `createStore(params)` を `app/actions/manage-stores.ts` に追加
  - 入力：店舗名・住所・電話番号・平日/週末の営業開始終了・ラグジュアリーコース最終受付（平日/週末）・最寄駅

いずれも作成後は一覧を再フェッチしてモーダルを閉じる。バリデーションエラー（必須項目未入力・料金や時間の負数など）はモーダル内にエラーメッセージを表示する。

## 4. 顧客管理一覧の拡張

### スキーマ変更
- `Member` に `isActive Boolean @default(true) @map("is_active")` を追加

### サーバーアクション
- `app/actions/search-customers.ts` を拡張：
  - `sortBy?: "id" | "visitCount" | "totalSpent" | "lastVisitDate"`、`sortDirection?: "asc" | "desc"` を受け付ける
  - `statusIds?: number[]`（複数選択のステータス絞り込み）を受け付ける
  - `includeInactive?: boolean`（既定 `false`。`true` の場合のみ無効化済み顧客も含む）
- 新規 `updateCustomerByAdmin(params)`：氏名・連絡先・所属店舗の編集
- 新規 `deactivateCustomer(memberId)` / `reactivateCustomer(memberId)`：`isActive` の切り替え（論理削除・復元）

### UI変更（`app/admin/(dashboard)/customers/page.tsx`）
- テーブル右端に編集（`Pencil`アイコン→モーダルで氏名/連絡先/所属店舗を編集）・削除（`Trash2`アイコン→確認ダイアログの上で無効化）の列を追加
- 「会員ID」「来店回数」「累計金額」「最終来店日」の列見出しをクリック可能にし、昇順⇄降順をトグルする（矢印アイコンで現在のソート状態を表示）
- テーブル上部にステータスのフィルターチップ（複数選択トグル、色は `CustomerStatus.colorCode` を反映）を設置。既存の氏名／電話番号のテキスト検索はそのまま維持
- 「無効な顧客も表示」チェックボックスを検索欄の近くに追加

## 5. ステータス設定の拡張

### スキーマ変更
- `CustomerStatus` に以下を追加：
  - `minTotalSpent Int @default(0) @map("min_total_spent")`
  - `conditionMode CustomerStatusConditionMode @default(OR) @map("condition_mode")`
  - 新規enum: `enum CustomerStatusConditionMode { OR AND }`

### サーバーアクション
- `CustomerStatusItem` に `minTotalSpent`・`conditionMode` を追加
- `updateStatusThreshold` を `updateStatusCondition({ statusId, minVisitCount, minTotalSpent, conditionMode })` にリネーム・拡張

### 自動判定ロジック（`lib/cron/reporting-jobs.ts`）
- 現行：`statuses.filter((s) => s.minVisitCount <= member.visitCount)` の最上位を採用
- 変更後：ステータスごとに条件式を評価する関数を用意
  ```ts
  function satisfiesStatus(status, member) {
    const visitOk = member.visitCount >= status.minVisitCount;
    const spentOk = member.totalSpent >= status.minTotalSpent;
    return status.conditionMode === "AND" ? visitOk && spentOk : visitOk || spentOk;
  }
  ```
- `qualifying = statuses.filter((s) => satisfiesStatus(s, member))` とし、これまで通り `sortOrder`（＝ランクの昇順）でソートされた配列の最後尾（＝最上位ランク）を採用する

### UI変更（`app/admin/(dashboard)/customer-statuses/page.tsx`）
- 各行に「最低来店回数」に加えて「最低利用金額」の数値入力を追加
- 「条件」列にOR/ANDのセレクト（またはトグルボタン）を追加

## 6. キャンペーン管理の再構成

### サーバーアクション（`app/actions/manage-campaigns.ts`）
- 新規 `updateCampaign(params)`：作成時と同じ項目を編集可能にする
- 新規 `deleteCampaign(campaignId)`：実体は `isPublished: false` への更新（論理削除）
- `listCampaigns` に `includeUnpublished?: boolean`（既定 `false`）を追加し、既定では公開中のみ返す

### UI変更（`app/admin/(dashboard)/campaigns/page.tsx`）
- ページ構成を「一覧がメイン」に変更。既存の作成フォームはモーダルに移植し、一覧右上の「＋新規作成」ボタンから開く
- 一覧の各行に編集（モーダルで内容編集）・削除（確認の上 `isPublished=false`）のアイコン列を追加
- 「無効なキャンペーンも表示」チェックボックスで `includeUnpublished` を切り替え

## 7. 配信管理・テンプレート管理の再構成

### メール／LINE配信管理（`app/admin/(dashboard)/segment-campaigns/page.tsx`）
- ページ構成を「配信履歴の一覧がメイン」に変更
- 一覧テーブル上部に「＋配信設定」ボタンを設置。クリックで既存の条件設定〜プレビュー〜テンプレート選択〜送信/予約のフォーム一式をモーダル表示する（ロジック・サーバーアクションは変更なし、レイアウトのみモーダル化）
- 送信/予約が完了したらモーダルを閉じ、履歴を再フェッチする

### 配信テンプレート管理（`app/admin/(dashboard)/templates/page.tsx`）
- ページ構成を「テンプレート一覧がメイン」に変更
- 一覧テーブル上部に「＋新規テンプレート作成」ボタンを設置し、モーダルで作成フォームを表示
- 各行の「編集」リンクもモーダルを開く形に統一（同じモーダル・フォームを編集モードで再利用）

## エラーハンドリング方針（共通）

- すべての新規サーバーアクションは、既存の規約（例：`registerMember` の `email_taken` のような判別可能な結果型）に倣い、例外を投げずに結果オブジェクトを返す
- 必須項目未入力・不正な数値（負数など）はクライアント側で送信前にチェックし、モーダル内にエラーメッセージを表示する
- 論理削除・復元・公開切り替えの操作は、対象が既に同じ状態だった場合も冪等に成功として扱う

## テスト方針

- プロジェクトルール（TDD）に従い、各新規サーバーアクションに対して実装前にテスト（`*.test.ts`）を作成する
  - 例：`createCourse`（正常系・カテゴリ不在エラー）、`deleteCampaign`（冪等性）、`satisfiesStatus`（OR/AND各パターン・境界値）、`search-customers` のソート・フィルタ
- UIコンポーネントは既存踏襲でユニットテストの対象外とし、実機確認はユーザーに委ねる（既存の開発フローと同様）

## 影響範囲・移行

- スキーマ変更（`Member.isActive`、`CustomerStatus.minTotalSpent`／`conditionMode`）は `prisma migrate dev` の実行が必要。サンドボックス制約により、この実行はユーザーに依頼する
- 既存データ：`isActive` は既定 `true`、`minTotalSpent` は既定 `0`、`conditionMode` は既定 `OR` とすることで、既存の顧客ステータス判定結果に変更が生じないようにする
