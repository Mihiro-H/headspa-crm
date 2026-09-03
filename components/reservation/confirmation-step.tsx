import { calculateCancellationDeadline } from "@/lib/reservation/cancellation-deadline";
import type { StoreListItem } from "@/app/actions/stores";
import type { CourseListItem } from "@/app/actions/courses";
import type { OptionListItem } from "@/app/actions/options";
import type { StaffListItem } from "@/app/actions/staff";

interface ConfirmationStepProps {
  store: StoreListItem | undefined;
  course: CourseListItem | undefined;
  options: OptionListItem[];
  staff: StaffListItem | undefined;
  reservationDate: string;
  startTimeLabel: string;
  onConfirm: () => void;
  submitting: boolean;
  errorMessage: string | null;
}

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export function ConfirmationStep({
  store,
  course,
  options,
  staff,
  reservationDate,
  startTimeLabel,
  onConfirm,
  submitting,
  errorMessage,
}: ConfirmationStepProps) {
  const deadline = calculateCancellationDeadline(new Date(`${reservationDate}T00:00:00.000Z`));
  const deadlineLabel = `${deadline.toISOString().slice(0, 10)} 23:59`;
  const total =
    (course?.finalPrice ?? 0) +
    options.reduce((sum, o) => sum + o.price, 0) +
    (staff?.nominationFee ?? 0);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-heading text-xl text-primary-700">予約内容の確認</h2>

      <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-sm">
        <p className="text-neutral-800">
          <span className="text-neutral-500">店舗：</span>
          {store?.name}
        </p>
        <p className="text-neutral-800">
          <span className="text-neutral-500">コース：</span>
          {course?.name}
        </p>
        {options.length > 0 && (
          <p className="text-neutral-800">
            <span className="text-neutral-500">オプション：</span>
            {options.map((o) => o.name).join("、")}
          </p>
        )}
        <p className="text-neutral-800">
          <span className="text-neutral-500">スタッフ：</span>
          {staff ? staff.name : "指名なし（自動割当）"}
        </p>
        <p className="text-neutral-800">
          <span className="text-neutral-500">日時：</span>
          {reservationDate} {startTimeLabel}〜
        </p>
        <p className="mt-2 text-lg font-medium text-neutral-800">合計 {formatYen(total)}</p>
      </div>

      <p className="text-xs text-neutral-500">
        ご予約前日23:59（{deadlineLabel}）までマイページから変更・キャンセル可能です。
      </p>

      {errorMessage && (
        <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{errorMessage}</p>
      )}

      <button
        type="button"
        disabled={submitting}
        onClick={onConfirm}
        className="h-12 w-full rounded-lg bg-accent-500 font-medium text-white disabled:opacity-50"
      >
        予約する
      </button>
    </div>
  );
}
