import { checkGenderRestriction, type MemberGender } from "@/lib/reservation/gender-restriction";
import type { OptionListItem } from "@/app/actions/options";

interface OptionSelectStepProps {
  options: OptionListItem[];
  memberGender: MemberGender | null;
  selectedOptionIds: number[];
  onToggle: (optionId: number) => void;
  onNext: () => void;
}

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export function OptionSelectStep({
  options,
  memberGender,
  selectedOptionIds,
  onToggle,
  onNext,
}: OptionSelectStepProps) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-heading text-xl text-primary-700">
        オプションを選択してください（任意）
      </h2>
      {options.map((option) => {
        const check =
          memberGender === null
            ? { allowed: true, warning: false }
            : checkGenderRestriction(option.genderRestriction, memberGender);
        const selected = selectedOptionIds.includes(option.id);

        return (
          <label
            key={option.id}
            className={`flex items-start gap-3 rounded-lg border p-4 shadow-sm ${
              check.allowed
                ? "cursor-pointer border-neutral-200 bg-neutral-0"
                : "cursor-not-allowed border-neutral-200 bg-neutral-100 opacity-50"
            }`}
          >
            <input
              type="checkbox"
              className="mt-1"
              disabled={!check.allowed}
              checked={selected}
              onChange={() => onToggle(option.id)}
            />
            <div>
              <p className="font-medium text-neutral-800">
                {option.name}
                <span className="ml-2 text-sm text-neutral-500">{formatYen(option.price)}</span>
              </p>
              {option.requiresAdvanceBooking && (
                <p className="mt-1 text-xs text-neutral-500">事前予約が必要です</p>
              )}
              {option.discountExempt && (
                <p className="mt-1 text-xs text-neutral-500">オプション料金は割引対象外</p>
              )}
              {check.warning && (
                <p className="mt-1 text-xs text-warning">
                  施術内容によってはご希望に添えない場合があります
                </p>
              )}
            </div>
          </label>
        );
      })}
      <button
        type="button"
        onClick={onNext}
        className="mt-4 h-12 w-full rounded-lg bg-accent-500 font-medium text-white hover:bg-accent-600"
      >
        次へ
      </button>
    </div>
  );
}
