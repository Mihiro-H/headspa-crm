# Googleフォームによるシフト希望提出フロー セットアップ手順書

- 日付: 2026-09-14
- 対象読者: 実際にGoogleフォームを作成し、Apps Scriptを設定する管理者
- 前提: 本手順書に対応する実装（`/api/shift-form-webhook`、パース処理、スタッフ一覧コピー機能など）はすでにコードとしてデプロイ済みであること。設計は`docs/superpowers/specs/2026-09-14-google-form-shift-submission-design.md`を参照。

この手順書に従ってApps Scriptを1回実行すると、フォームの新規作成・質問の設定・トリガーの登録までがすべて自動で行われます。フォームをGoogleフォームの画面で手作業で組み立てる必要はありません。

---

## 1. `.env`への設定（先にすませておく）

アプリの`.env`ファイルに、以下の環境変数を追加する。

```
SHIFT_FORM_WEBHOOK_SECRET=<ランダムな文字列>
```

- `<ランダムな文字列>`には、第三者に推測されない十分に長いランダムな文字列を設定する（例: `openssl rand -hex 32`で生成した32文字以上の文字列）。
- この値は、後述の手順2でApps Scriptに貼り付ける`WEBHOOK_SECRET`と**完全に同じ値**にすること。値が異なると、Webhook呼び出しが認証エラーで拒否される。
- `.env`を変更した後は、アプリ（`npm run dev`またはデプロイ先）を再起動して環境変数を反映させる。

---

## 2. Apps Scriptプロジェクトの作成

1. [script.google.com](https://script.google.com) を開き、「新しいプロジェクト」を作成する。
2. デフォルトで生成されている`myFunction`などのコードを全て削除して、以下のコードをそのまま貼り付ける。
3. コード冒頭の`WEBHOOK_URL`と`WEBHOOK_SECRET`の2箇所を書き換える。**それ以外は変更不要**（フォームの質問文言もこのコードが自動で設定するため、手作業で用意する必要はない）。
   - `WEBHOOK_URL`: アプリを実際にホストしているドメインの`/api/shift-form-webhook`（例: `https://your-app.example.com/api/shift-form-webhook`）
   - `WEBHOOK_SECRET`: 手順1で`.env`に設定した`SHIFT_FORM_WEBHOOK_SECRET`と同じ文字列

```js
// ===== 書き換えが必要な設定 =====
const WEBHOOK_URL = "https://<あなたのドメイン>/api/shift-form-webhook";
const WEBHOOK_SECRET = "<.envのSHIFT_FORM_WEBHOOK_SECRETと同じ値>";
const FORM_TITLE = "シフト希望提出フォーム";
// ================================

// フォームの質問タイトル。setupShiftRequestForm()が作成する質問文と完全一致させること
const QUESTION_TITLES = {
  yearMonth: "対象年月",
  staffLabel: "お名前",
  dayOff: "休み希望の日",
  reduced: "時短希望の日と時間",
};

// 「お名前」プルダウンの初期プレースホルダー（あとで手順4の一覧に置き換える）
const STAFF_PLACEHOLDER_CHOICE =
  "（管理者へ：「フォーム用スタッフ一覧をコピー」ボタンの内容に置き換えてください）";

/**
 * 初回セットアップ用。このプロジェクトにつき最初に1回だけ実行する。
 * フォームを新規作成し、質問を設定し、必要なトリガーを登録する。
 */
function setupShiftRequestForm() {
  const form = FormApp.create(FORM_TITLE);
  form.setDescription("スタッフ用：シフト希望を提出するフォームです。");
  PropertiesService.getScriptProperties().setProperty("FORM_ID", form.getId());

  form.addListItem().setTitle(QUESTION_TITLES.yearMonth).setRequired(true);

  form
    .addListItem()
    .setTitle(QUESTION_TITLES.staffLabel)
    .setRequired(true)
    .setChoiceValues([STAFF_PLACEHOLDER_CHOICE]);

  form.addCheckboxItem().setTitle(QUESTION_TITLES.dayOff).setRequired(false);

  form
    .addParagraphTextItem()
    .setTitle(QUESTION_TITLES.reduced)
    .setRequired(false)
    .setHelpText(
      "1行につき1件、「日付 開始-終了」の形式で入力してください。\n" +
        "区切りは「-」「〜」「~」のいずれでも構いません。\n" +
        "開店・閉店時刻に合わせたい場合は「開店」「閉店」と書いてください。\n\n" +
        "例:\n10/5 11:00-15:00\n10/12 開店〜14:00",
    );

  // フォーム送信時にWebhookを呼ぶトリガー
  ScriptApp.newTrigger("onFormSubmit").forForm(form).onFormSubmit().create();

  // シフト希望の提出期限が毎月20日のため、その翌日の21日に次月分の選択肢へ自動更新する
  ScriptApp.newTrigger("refreshFormChoices").timeBased().onMonthDay(21).atHour(6).create();

  // 初回分（実行時点から見た次月分）の選択肢を即時反映する
  refreshFormChoices();

  Logger.log("フォームを作成しました。");
  Logger.log("回答用URL（スタッフに共有するURL）: " + form.getPublishedUrl());
  Logger.log("編集用URL（質問の確認・スタッフ一覧の貼り付けに使う）: " + form.getEditUrl());
}

/**
 * 「対象年月」「休み希望の日」の選択肢を、次月分に更新する。
 * setupShiftRequestForm()が登録したトリガーにより、毎月21日に自動実行される。
 */
function refreshFormChoices() {
  const formId = PropertiesService.getScriptProperties().getProperty("FORM_ID");
  const form = FormApp.openById(formId);
  const target = getNextYearMonth();
  const numDays = daysInMonth(target.year, target.month);

  // 「対象年月」は常に次月のみの1択に固定する（複数月を選べる状態にすると、
  // 後述の休み希望チェックボックスの選択肢と食い違う恐れがあるため）
  const yearMonthItem = findItemByTitle(form, QUESTION_TITLES.yearMonth).asListItem();
  yearMonthItem.setChoiceValues([target.label]);

  const dayOffItem = findItemByTitle(form, QUESTION_TITLES.dayOff).asCheckboxItem();
  const dayChoices = [];
  for (let day = 1; day <= numDays; day++) {
    dayChoices.push(target.month + "/" + day);
  }
  dayOffItem.setChoiceValues(dayChoices);

  Logger.log(target.label + "分の選択肢に更新しました。");
}

// 実行時点から見て「次の月」を year / month(1-12) / label("YYYY-MM") の形で返す
function getNextYearMonth() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const year = next.getFullYear();
  const month = next.getMonth() + 1;
  const label = year + "-" + String(month).padStart(2, "0");
  return { year: year, month: month, label: label };
}

// 指定した年・月（月は1-12）の日数を返す
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

// フォーム内の質問をタイトル文字列で検索する
function findItemByTitle(form, title) {
  const items = form.getItems();
  for (let i = 0; i < items.length; i++) {
    if (items[i].getTitle() === title) {
      return items[i];
    }
  }
  throw new Error("質問が見つかりません: " + title);
}

/**
 * フォーム送信時に自動実行され、回答をWebhookにPOSTする。
 */
function onFormSubmit(e) {
  const responses = e.response.getItemResponses();
  const answers = {};
  responses.forEach((r) => {
    answers[r.getItem().getTitle()] = r.getResponse();
  });

  const yearMonthAnswer = answers[QUESTION_TITLES.yearMonth]; // 例: "2026-10"
  const year = yearMonthAnswer.split("-")[0];

  const dayOffRaw = answers[QUESTION_TITLES.dayOff];
  // 日付の複数選択項目は配列で返ってくる場合と文字列（カンマ区切り）で
  // 返ってくる場合があるため両対応する
  const dayOffMonthDayList = Array.isArray(dayOffRaw)
    ? dayOffRaw
    : (dayOffRaw || "").split(",").map((s) => s.trim()).filter((s) => s !== "");

  // フォームの選択肢は「10/1」のようなM/D形式（対象年月の年を含まない）なので、
  // 「対象年月」の回答から取り出した年と組み合わせてYYYY-MM-DD形式に変換する。
  // ここで年を補完しないと、アプリ側は年なしの日付を解釈できずエラーになる。
  const dayOffDates = dayOffMonthDayList.map((monthDay) => {
    const parts = monthDay.split("/");
    const month = parts[0].padStart(2, "0");
    const day = parts[1].padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

  const payload = {
    yearMonth: yearMonthAnswer,
    staffLabel: answers[QUESTION_TITLES.staffLabel],
    dayOffDates: dayOffDates,
    reducedFreeText: answers[QUESTION_TITLES.reduced] || "",
  };

  UrlFetchApp.fetch(WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + WEBHOOK_SECRET },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
}
```

4. Apps Scriptエディタ上部のフロッピーディスクアイコン（保存）をクリックして保存する。

---

## 3. `setupShiftRequestForm`の実行（フォームの新規作成）

1. Apps Scriptエディタ上部の関数選択ドロップダウンで`setupShiftRequestForm`を選択する。
2. 「実行」（▶）ボタンをクリックする。
3. 初回実行時はGoogleアカウントの承認画面が表示される。フォームの所有者アカウントで承認する。
   - 「このアプリは Google で確認されていません」という警告が出た場合は、「詳細」→「（プロジェクト名）に移動（安全ではないページ）」を選んで進める。これは自分が作成したスクリプトであるため問題ない。
4. 実行が完了したら、Apps Scriptエディタ左側メニューの「実行数」（またはログ表示）を開き、`Logger.log`で出力された以下の2つのURLを控える。
   - **回答用URL**: スタッフに共有してフォームに回答してもらうためのURL
   - **編集用URL**: フォームの質問内容を確認したり、次の手順4で使うURL

この時点で、フォーム本体・4つの質問・「フォーム送信時」トリガー・「毎月21日」の自動更新トリガーがすべて作成済みになっている。「対象年月」「休み希望の日」の選択肢も、実行時点から見た次月分（実行を2026年9月中に行えば2026年10月分）がすでに反映されている。

---

## 4. お名前プルダウンの設定

`setupShiftRequestForm`が作成した時点では、「お名前」プルダウンにはプレースホルダーの選択肢が1つだけ入っている。これを実際のスタッフ一覧に置き換える。

1. アプリの管理画面`/admin/staff-shifts`を開き、「フォーム用スタッフ一覧をコピー」ボタンをクリックする（対象店舗のアクティブなスタッフが`店舗名 - 氏名`形式で1行ずつクリップボードにコピーされる）。
2. 手順3で控えた編集用URLを開き、「お名前」の質問を選択する。
3. プレースホルダーの選択肢を削除し、コピーした内容を選択肢欄に貼り付ける（複数行のテキストを貼り付けると、改行ごとに別の選択肢として分割される）。

店舗異動・入退職があった場合は、この手順を繰り返して選択肢を更新する（この項目のみ自動更新の対象外なので、変更があったタイミングで手動更新が必要）。

**注意**: 回答用URLをスタッフへ共有するのは、この手順4が完了し、かつ後述の手順6（動作確認）が済んだ後にすること。プレースホルダーのままスタッフに共有してしまうと、スタッフ名が突合できず`unmatched_staff`エラーになる。

---

## 5. 「対象年月」「休み希望の日」の自動更新について

これらの選択肢は、Apps Scriptの時間主導型トリガー（`refreshFormChoices`、毎月21日に自動実行）によって、常に「次月」分に自動で更新される。手動でのメンテナンスは不要。

- 「対象年月」は常に次月のみの1択になる。Googleフォーム経由の提出は、**次月分の新規申請専用**という位置づけになる。
- 当月分の修正や、過去に遡った修正が必要な場合は、既存の管理画面（`/admin/my-shift-requests`）から入力する。
- トリガーの実行状況は、Apps Scriptエディタ左側メニューの「トリガー」画面、または「実行数」画面から確認できる。

質問3「休み希望の日」は、Googleフォーム標準の日付形式の質問（自由入力の日付ピッカー）ではなく、**チェックボックス形式**である必要がある（Apps Script側が複数選択の回答として日付文字列の配列を受け取る前提のため）。`setupShiftRequestForm`はこの形式で作成するため、通常は意識する必要はないが、質問を後から手動で編集する場合はこの点に注意する。

---

## 6. 動作確認手順

1. 手順3で控えた回答用URLを開き、テストとして自分自身の名前・適当な休み希望日・時短希望を入力して送信する。
2. アプリを`npm run dev`で起動している場合は、そのターミナルの出力を確認し、Webhook呼び出し（`/api/shift-form-webhook`へのPOST）でエラーが出ていないか確認する。
   - `unmatched_staff`エラーが出た場合は、「お名前」の選択肢とアプリ側のスタッフ名（`店舗名 - 氏名`）が完全一致しているか確認する。
   - 認証エラーが出た場合は、`.env`の`SHIFT_FORM_WEBHOOK_SECRET`とApps Scriptの`WEBHOOK_SECRET`が一致しているか確認する。
3. アプリの`/admin/staff-shifts`画面を開き、テスト送信した対象月・対象スタッフの「提出済みの希望」欄に、フォームで入力した休み希望日・時短希望が反映されているか確認する。
4. 時短希望の自由記述欄にわざと不正な書式の行を含めて再テストし、その行が「不明な行」としてWebhookのレスポンス（Apps Scriptの実行ログ、Apps Scriptエディタの「実行数」メニューから確認可能）に記録され、かつ他の正常な行は反映されることを確認する（任意だが推奨）。
5. 自動更新トリガーを即時に確認したい場合は、Apps Scriptエディタの関数選択ドロップダウンで`refreshFormChoices`を選び、手動で実行してログを確認してもよい（本来は毎月21日に自動実行される）。

以上で設定は完了。
