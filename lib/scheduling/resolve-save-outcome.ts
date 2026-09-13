export type SaveOutcome = "keep" | "rollback" | "ignore_stale";

/**
 * 同一キー(日付など)への変更が短時間に連続して保存された場合、後発のリクエストが
 * 発行された後に返ってきた先発リクエストの結果で画面を書き換えてはいけない
 * (新しい変更を古い結果で誤って巻き戻す/上書きするバグを防ぐため)。
 *
 * `latestSeqForDate`はそのキーに対して最後に発行されたリクエストの連番、
 * `ownSeq`はこの結果を受け取ったリクエスト自身の連番。両者が一致しない場合、
 * このリクエストは既に「最新」ではないため、成功・失敗に関わらず無視する。
 */
export function resolveSaveOutcome(params: {
  latestSeqForDate: number;
  ownSeq: number;
  saveSucceeded: boolean;
}): SaveOutcome {
  if (params.latestSeqForDate !== params.ownSeq) {
    return "ignore_stale";
  }
  return params.saveSucceeded ? "keep" : "rollback";
}
