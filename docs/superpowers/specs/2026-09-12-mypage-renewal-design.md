# マイページ／ログイン画面リニューアル 設計書

- 日付: 2026-09-12
- 対象: フォレスパ（headspa-crm）会員向けマイページ（`/mypage/*`）およびログイン画面（`/login`, `/admin/login`）
- 位置づけ: ライブ不具合修正フェーズ中のUI改善タスク（新規サブプロジェクトA〜Iとは独立）

## 背景・目的

会員向けマイページのUIを、ユーザー提示のモックアップ画像（ホーム画面：ステータスカード・次回予約カード・下部ナビ）に沿って刷新する。合わせて、ログイン画面のレイアウトとブランドロゴの表示方法、見出しフォントの一貫性も整える。

## A. ログイン画面（`app/login/page.tsx` / `app/admin/login/page.tsx`）

- ルート要素の`justify-center`（縦中央揃え）を`justify-start`に変更し、上部に適切な余白（`pt-*`）を設ける。
- 見出し部分（現状：`BrandSymbol`のSVGアイコン＋`<h1 className="font-heading">フォレスパ</h1>`、または`admin/login`は文字のみ）を、`public/logo/foresupa_logo_tight.png`のロゴ画像に置き換える。
- 既存パターン（`app/admin/(dashboard)/layout.tsx`のサイドバーロゴ）を流用：
  ```tsx
  <Image
    src="/logo/foresupa_logo_tight.png"
    alt="フォレスパ"
    width={1206}
    height={600}
    className="h-auto w-40"
    priority
  />
  ```

## B. マイページ共通ヘッダー（`app/mypage/layout.tsx`）

- `fixed top-0`の固定ヘッダーを新設。内容は左揃えの同ロゴ画像のみ（`w-32`程度、ヘッダー高さに収まるサイズ）。
- 各ページ側で重複していたロゴ表示（`app/mypage/page.tsx`内のロゴ＋名前の行など）は共通ヘッダーに一本化し、各ページからは削除する。氏名・ステータスバッジ等はページ本文側に残す。
- `<main>`側に`padding-top`を追加し、固定ヘッダーと本文が重ならないようにする（下部固定ナビと同様の考え方）。

## C. フォント統一（サイト全体、`app/globals.css`）

- 現状の無条件ルール：
  ```css
  h1, h2, h3, h4 {
    font-family: var(--font-heading); /* Noto Serif JP */
  }
  ```
  を削除する（見出し要素はデフォルトで`body`の`font-family: var(--font-body)`＝Noto Sans JPを継承するようになる）。
- **影響を受けないもの**：`className="font-heading"`を明示的に付けている見出し（ログイン画面、`/terms`、予約フロー各ステップ見出し、モーダルタイトル、管理画面ヘッダー`AdminHeader`等）。Tailwindのクラス指定はタグセレクタより詳細度が高いため、これらは意図通り明朝体（Noto Serif JP）のまま維持される。
- **影響を受けるもの（サンセリフ体に変わる）**：クラス指定のない生の`<h1>`〜`<h4>`。洗い出し済みの一覧：
  - マイページ：`app/mypage/profile/page.tsx`の「基本情報」等の`<h2>`
  - 管理画面：`app/admin/(dashboard)/layout.tsx`のロゴラッパー`<h1>`（見た目上影響なし）、`app/admin/(dashboard)/calendar/page.tsx`・`menu/page.tsx`・`reports/page.tsx`・`components/admin/segment-settings-tab.tsx`・`components/admin/auto-delivery-tab.tsx`内の複数`<h2>`/`<h3>`
  - この変更はユーザー承認済み（管理画面側の見出しも含めて統一する方針）

## D. 下部ナビ再構成＋ホーム画面リニューアル

### D-1. 下部ナビ（`app/mypage/layout.tsx`）

現行の`NAV_ITEMS`（予約／マイページ／来店履歴／設定）を以下に変更：

```ts
const NAV_ITEMS = [
  { href: "/mypage", label: "ホーム", icon: Home },
  { href: "/mypage/history", label: "来店履歴", icon: Clock },
  { href: "/mypage/notifications", label: "お知らせ", icon: Bell },
  { href: "/mypage/profile", label: "設定", icon: Settings },
];
```

「予約」タブは削除（新しい予約の起点はホーム画面の「新しく予約する」ボタンに一本化）。

### D-2. ホーム画面（`app/mypage/page.tsx`）

モックアップに沿って以下の構成にする：

1. 「こんにちは」／「{name} 様」
2. ステータスカード：現在のステータス名、来店回数、次のステータスまでの残り回数、進捗バー
3. 次回のご予約カード：日時・店舗／コース・担当スタッフ、「変更」「キャンセル」ボタン
4. 「新しく予約する」大ボタン（`/reserve`への通常のリンク、アクセントカラー）

「変更」「キャンセル」ボタンは**`/mypage/reservation`へ遷移するだけ**とし、キャンセル／変更処理そのものはそのページの既存実装（`cancelMemberReservation`呼び出し等）を再利用する。ホーム画面側にロジックを複製しない。

### D-3. `getMypageSummary`の拡張（`app/actions/mypage-summary.ts`）

進捗バー計算に現在のステータスの`minVisitCount`が必要なため、戻り値に追加する：

```ts
export interface MypageSummary {
  // ...既存フィールド
  currentStatusMinVisitCount: number; // 進捗バーの起点
  nextStatusMinVisitCount: number | null; // 進捗バーの終点（最終ステータスの場合はnull）
}
```

進捗率 = `(visitCount - currentStatusMinVisitCount) / (nextStatusMinVisitCount - currentStatusMinVisitCount)`（0〜1にクランプ）。最終ステータス（`nextStatusName`が`null`）の場合は進捗バー自体を非表示にし、来店回数のみ表示する。

## E. お知らせ機能（新規実装）

### E-1. データソース

`EmailLineLog`（誕生日／来店リマインド／セグメント配信の送信履歴）を会員自身の分だけ取得する。既存の管理側配信履歴表示と同じテーブルを参照するが、会員向けには**配信失敗（`status: "failed"`）分は表示しない**（内部的な失敗を会員に見せる意味がないため）。

### E-2. サーバーアクション（新規 `app/actions/member-notifications.ts`）

```ts
"use server";

export interface MemberNotificationItem {
  id: number;
  templateType: "birthday" | "reminder" | "segment";
  channel: "email" | "line";
  subject: string | null;
  sentAt: string; // ISO date
}

export async function getMemberNotifications(): Promise<MemberNotificationItem[] | null> {
  // getMemberReservationHistoryと同じ認可パターン（session.user.role !== "member"ならnull）
  // where: { memberId, status: "success" }, orderBy: { sentAt: "desc" }
}
```

### E-3. ページ（新規 `app/mypage/notifications/page.tsx`）

`templateType`ごとに日本語ラベルを表示（誕生日メッセージ／来店リマインド／キャンペーンのお知らせ）。メール配信の場合は件名も表示。0件の場合は「お知らせはまだありません。」。

## F. 来店履歴ページ（`app/mypage/history/page.tsx`）

- 見出しを「来店履歴・ステータス確認」→「来店履歴」に変更。
- 「ステータス条件」テーブル（`listCustomerStatuses`呼び出しごと）を削除。
- 各カードのうち`status === "confirmed"`かつキャンセル期限内のものに「変更」「キャンセル」ボタンを追加。期限を過ぎたものは現状通り「予約確定」ラベルのままボタンなし（現状維持）。
- ボタンの処理は`/mypage/reservation`と**同じアクション関数**（`cancelMemberReservation`）をカード側から直接呼び出す形で再利用する（`/mypage/reservation`は「次回の予約」1件専用のページで`reservationId`を受け取れないため、複数の確定予約が同時に存在するケースを正しく扱うには、履歴カード側で各カードの`reservationId`を使って直接呼び出す必要がある）。キャンセルは確認ダイアログ→`cancelMemberReservation({reservationId})`、変更は確認ダイアログ→キャンセル後に`/reserve`へ遷移、と`/mypage/reservation`のロジックと同じ流れにする。
- 判定・表示に必要な`canModify`フラグを`getMemberReservationHistory`の戻り値に追加する：
  ```ts
  export interface MemberReservationHistoryItem {
    // ...既存フィールド
    canModify: boolean; // status === "confirmed" && today < reservation.cancellationDeadline
  }
  ```

## テスト方針

- 既存プロジェクトのTDD方針に従い、各サーバーアクションの変更・新規追加（`getMypageSummary`の拡張、`getMemberNotifications`新規、`getMemberReservationHistory`の`canModify`追加）は先に失敗するテストを書いてから実装する。
- UIコンポーネントの主要な分岐（ステータス条件テーブルが表示されないこと、キャンセル期限内/外でボタンの有無が切り替わること等）も可能な範囲でテストする。

## スコープ外

- お知らせの既読／未読管理、プッシュ通知は今回のスコープ外。
- 複数の確定予約を同時に持つケースのUI（「次回の予約」以外の確定予約をどう扱うか）は既存動作を変更しない。
