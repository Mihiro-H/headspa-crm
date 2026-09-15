export interface WizardState {
  step: number;
  storeId: number | null;
  categoryId: number | null;
  courseId: number | null;
  optionIds: number[];
  staffId: number | null;
  reservationDate: string | null;
  startTimeLabel: string | null;
  reservationId: number | null;
  errorMessage: string | null;
}

// LINEログイン（signIn("line")）は外部サイトへの本物のページ遷移になるため、
// Reactのstate（メモリ上のみ）は戻ってきたときに初期化されてしまう。
// ログインボタンを押す直前にウィザードの状態をここに保存し、LINE連携から
// 戻ってきた直後（reservation-wizard.tsxのマウント時）に読み出して復元する。
export const LINE_RESUME_STORAGE_KEY = "reservation-wizard-line-resume";

// 保存されていたウィザード状態をパースし、確認画面（step 8）から再開できる形に
// する。保存内容が無い・壊れている・仮予約が完成していない場合はnullを返し、
// 呼び出し側は通常どおり最初から（step 1）表示させる。
export function parseLineResumeState(saved: string | null): WizardState | null {
  if (!saved) return null;

  let restored: WizardState;
  try {
    restored = JSON.parse(saved) as WizardState;
  } catch {
    return null;
  }

  if (
    restored.reservationId === null ||
    restored.reservationDate === null ||
    restored.startTimeLabel === null
  ) {
    return null;
  }

  return { ...restored, step: 8 };
}
