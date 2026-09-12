# 管理画面 予約カレンダー グリッド化 設計書

- 日付: 2026-09-12
- 対象: フォレスパ（headspa-crm）管理画面 予約カレンダー（`/admin/calendar`）
- 位置づけ: 既存の「スタッフごとの縦リスト」表示を、スタッフ×時刻のグリッド表示に置き換える単発のUI改善タスク

## 背景・目的

現在の`/admin/calendar`はスタッフごとに予約を縦に並べたリスト表示（`app/admin/(dashboard)/calendar/page.tsx`）。ユーザー提示のモックアップ画像に基づき、スタッフを列・時刻を行としたグリッド（表形式）に変更し、一覧性を上げる。

## 上部バー

- **日付ナビゲーション**（左寄せ）：`<` 前日ボタン／`{年}年{月}月{日}日（{曜日}）`（`lib/reservation/date-format.ts`の`formatJapaneseDate`を再利用）／`>` 翌日ボタン
- **店舗選択**（右寄せ）：アイコン（`lucide-react`の`Store`、既存admin navで使用中のものと同じ）＋ドロップダウン
- 日／週／月の表示切替タブは**設置しない**（ユーザー確定事項：今回は日表示専用）

## グリッド本体

### 列（スタッフ）

- 選択中の店舗の在籍スタッフ全員（`app/actions/staff.ts`の既存`listStaffForStore(storeId)`をそのまま利用。`isActive: true`のスタッフを`id`昇順で取得済み）
- その日の予約に`staffId === null`（担当未定）のものが1件以上ある場合のみ、末尾に「指名なし」列を追加する

### 行（時刻）

- その日・その店舗の予約（`getCalendarReservations`が返す`CalendarReservation[]`）の`startMinutes`をユニーク化し、昇順ソートしたものを行として使う
- 予約が存在しない時間帯の行は作らない（ユーザー確定事項：モックアップ画像通り、間の空き時間帯はスキップする）

### セル

- 該当スタッフ（列）×該当開始時刻（行）に一致する予約が1件でもあればカードを表示、なければ空白
- 同一スタッフ・同一開始時刻に複数件の予約が重複することは通常運用上想定しない（重複時は最初の1件のみ表示する程度の単純な実装で良い。厳密な重複検知・エラー表示は本タスクのスコープ外）

### カードの内容

- 開始時刻、顧客名（`{memberName}様`。`memberName`が`null`の場合は`（未確定）`）、コース名（`courseName`が空文字の場合は`（明細なし）`）のみ
- **WEB予約／要確認／指名の表示は行わない**（テキストでも色でも表現しない。ユーザー確定事項）

### カードの背景色（ステータス別）

既存のグローバル色トークン（`app/globals.css`の`--color-success` / `--color-warning` / `--color-disabled`）を流用する：

| `status` | ラベル | 背景色トークン |
|---|---|---|
| `temp_hold` | 仮予約 | `--color-warning`（`#d9a441`系）を薄めた色合い |
| `confirmed` | 確定 | `--color-success`（`#6b8e5a`系）を薄めた色合い |
| `completed` | 来店済み | `--color-disabled`（`#c9c4b8`系）を薄めた色合い |

カードは背景色に対して十分なコントラストのテキスト色を使う（既存の`bg-primary-50`+`text-primary-700`のような薄色背景・濃色文字のパターンを踏襲する）。

### クリック動作

- カードクリックで既存の`/admin/reservations/{id}`（予約詳細ページ）へ遷移（現状の`<Link href={...}>`パターンを維持）

## データ層の変更

- `app/actions/calendar-reservations.ts`：**変更不要**。既存の`CalendarReservation`（`staffId`, `staffName`, `memberName`, `courseName`, `startMinutes`, `endMinutes`, `status`, `source`）で本設計に必要な情報は揃っている（`source`は今回未使用だが、将来のための既存フィールドとしてそのまま残す）。
- `app/actions/staff.ts`の`listStaffForStore`：**変更不要**。そのまま列定義に使う。
- `app/admin/(dashboard)/calendar/page.tsx`：全面的に書き換える（後続の実装計画で詳細化）。

## スコープ外

- 週表示・月表示（タブ自体を設置しない）
- WEB予約／要確認／指名の可視化（テキスト・色とも）
- 同一スタッフ・同一時刻の複数予約の重複表示制御
- `cancelled` / `no_show`ステータスの表示（`getCalendarReservations`が元々`temp_hold`/`confirmed`/`completed`のみ取得しているため対象外）
