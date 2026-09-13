# シフト希望の3状態化・自動生成ルール再定義 設計書

- 日付: 2026-09-13
- 対象: スタッフシフト管理機能（`docs/superpowers/specs/2026-09-13-staff-shift-management-design.md`で実装済み）のうち、希望入力のルールを再定義する追加変更
- 位置づけ: 実際に触ってみて分かった不足を補う追補設計。既存のフロー（希望入力→自動生成→店長確定）自体は変更しない。

## 背景・目的

現状、`StaffShiftRequest.isDayOffRequested`（真偽値）で「休み希望」か「時間指定」かの2値しか表現できず、以下の課題があった。

1. 「未提出」の日をルール上どう扱うか未定義だった（実装上は休み扱いにしていた）。
2. 「普通に出勤できる」という最も多いはずの希望を毎回時刻入力させるのは非効率。
3. 希望時刻を片方しか入れなかった場合の挙動が未定義（休み扱いにフォールバックしていた）。
4. スタッフが入力を忘れている日がどれだけあるか、店長にもスタッフ本人にも分かりにくい。

これらを解消するため、希望を「出勤／休み希望／時短希望」の3状態で表現し直し、未提出・不備の可視化も追加する。

## データモデル変更

### `StaffShiftRequest.isDayOffRequested`（Boolean）を`requestType`（Enum）に置き換える

```prisma
enum StaffShiftRequestType {
  full     // 出勤（店舗の営業時間フルで勤務）
  day_off  // 休み希望
  reduced  // 時短希望（開始・終了を個別に指定）

  @@map("staff_shift_request_type")
}

model StaffShiftRequest {
  id                 Int                   @id @default(autoincrement()) @map("request_id")
  staffId            Int                   @map("staff_id")
  workDate           DateTime              @map("work_date") @db.Date
  requestType        StaffShiftRequestType @default(full) @map("request_type")
  preferredStartTime DateTime?             @map("preferred_start_time") @db.Time()
  preferredEndTime   DateTime?             @map("preferred_end_time") @db.Time()
  updatedAt          DateTime              @updatedAt @map("updated_at")

  staff Staff @relation(fields: [staffId], references: [id])

  @@unique([staffId, workDate])
  @@map("staff_shift_requests")
}
```

`preferredStartTime`/`preferredEndTime`は`requestType: reduced`のときのみ意味を持つ（`full`/`day_off`のときは無視してよいが、既存データを壊さないため列自体は残す）。

### マイグレーション

既に1件の実データ（吉田麻衣さんの希望）が本番相当のDBに入っているため、**追加＋バックフィル＋削除**の新規マイグレーションを書く（適用済みマイグレーションは編集しない）。

```sql
-- CreateEnum
CREATE TYPE "staff_shift_request_type" AS ENUM ('full', 'day_off', 'reduced');

-- AlterTable: 一旦 'reduced' をデフォルトにして追加（旧 is_day_off_requested=false の意味に合わせる）
ALTER TABLE "staff_shift_requests" ADD COLUMN "request_type" "staff_shift_request_type" NOT NULL DEFAULT 'reduced';

-- Backfill: 旧データの意味をそのまま引き継ぐ
UPDATE "staff_shift_requests" SET "request_type" = 'day_off' WHERE "is_day_off_requested" = true;

-- 今後の新規行のデフォルトは 'full'（Prisma側のデフォルトと合わせる）
ALTER TABLE "staff_shift_requests" ALTER COLUMN "request_type" SET DEFAULT 'full';

-- 旧カラムを削除
ALTER TABLE "staff_shift_requests" DROP COLUMN "is_day_off_requested";
```

## 自動生成ルールの再定義（`lib/scheduling/derive-shift-draft.ts`）

`ShiftRequestInput`を`{ requestType: "full" | "day_off" | "reduced"; preferredStartMinutes: number | null; preferredEndMinutes: number | null }`に変更し、ロジックを以下に差し替える。

| 入力 | 結果 |
|---|---|
| 希望データが無い（`request === null`、未提出） | 出勤扱い（店舗の営業時間フル） |
| `requestType: "full"` | 出勤扱い（店舗の営業時間フル。仮に時刻が入っていても無視） |
| `requestType: "day_off"` | 休み |
| `requestType: "reduced"`、開始・終了とも未入力 | 休み（不備データへの安全側フォールバック。※希望入力画面側では「不備」として警告表示され、店長画面のドラフトには一旦休みとして出る） |
| `requestType: "reduced"`、片方のみ入力 | 未入力側を店舗の営業開始/終了時刻で補完してから、以下の「両方入力」と同じ処理 |
| `requestType: "reduced"`、開始・終了とも入力 | 店舗の営業時間内にクランプ（従来通り）。クランプの結果 開始≧終了 になったら休み扱い |

「出勤」と「未提出」が同じ結果（店舗営業時間フル）になる点は意図的（後述の「不備」判定とは別軸）。

## 希望入力画面（`/admin/my-shift-requests`）の変更

- 各日の入力を、現在の「休み希望」単独チェックボックスから、**「出勤」「休み希望」「時短希望」の3択（ラジオボタン、排他選択）**に変更する。
- 「時短希望」を選んだ日のみ、開始・終了の`<input type="time">`を有効化する。
- 画面上部に、選択中の月について「◯日中◯件完了・◯件不備」というサマリーを表示する。
  - **不備**：その日の希望データが無い（未提出）、または`requestType: "reduced"`で開始・終了とも未入力。
  - **完了**：不備以外すべて（「出勤」明示選択、「休み希望」、または「時短希望」で開始・終了の少なくとも一方が入力済み）。
- 各ラジオ選択・時刻入力の変更は、既存同様その場で`saveStaffShiftRequest`により自動保存する（保存ボタンは引き続き設けない）。

## 店長画面（`/admin/staff-shifts`）の変更

「提出済みの希望（閲覧のみ）」表の`requestSummary`関数を3状態対応に更新する。

| 状態 | 表示 |
|---|---|
| 未提出 | `未提出` |
| `full` | `出勤` |
| `day_off` | `休み希望` |
| `reduced`（時刻あり） | `時短 10:00〜15:00`のように表示 |
| `reduced`（両方未入力＝不備） | `不備（時短希望・時間未入力）` |

## 影響範囲（変更が必要なファイル）

- `prisma/schema.prisma`（`StaffShiftRequestType` enum追加、`StaffShiftRequest.requestType`に置き換え）
- 新規マイグレーション（`prisma/migrations/`配下、上記SQL）
- `lib/scheduling/derive-shift-draft.ts` + `.test.ts`（ロジック全面差し替え、テストケースも作り直し）
- `app/actions/staff-shift-requests.ts` + `.test.ts`（`StaffShiftRequestItem`の型変更、`toItem`/`saveStaffShiftRequest`の入出力変更）
- `app/actions/generate-shift-draft.ts` + `.test.ts`（`deriveDraftShift`への引き渡し方変更）
- `app/admin/(dashboard)/my-shift-requests/page.tsx`（ラジオボタン化、完了/不備サマリー追加）
- `app/admin/(dashboard)/staff-shifts/page.tsx`（`requestSummary`更新）

## スコープ外（今回やらないこと）

- 店舗休業日（`isStoreHoliday`）を自動生成ルールに組み込むこと（現状も未対応、今回も対応しない）。
- 「全て出勤で確定」のような一括操作ボタンの追加。
- 必要人数・スタッフ間バランスを考慮した自動割当（既存設計書のスコープ外を継続）。

## テスト方針

- `derive-shift-draft.test.ts`は新しい5分岐（未提出／full／day_off／reduced不備／reduced片方入力／reduced両方入力）を網羅する形に全面書き直す。
- `staff-shift-requests.test.ts`・`generate-shift-draft.test.ts`は、モックデータの`isDayOffRequested`を`requestType`に置き換えるだけで既存の認可テスト構造は維持する。
- 完了/不備サマリーのロジックは、可能であれば`my-shift-requests/page.tsx`から独立した純粋関数として切り出し、`lib/scheduling/`配下でユニットテストする（[[headspa-crm-mypage-renewal-followups]]で確認済みの「ページコンポーネント自体は新規テスト不要、純粋ロジックはlibで単体テストする」という本セッションの既存パターンに従う）。
