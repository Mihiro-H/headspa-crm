import type { StaffListItem } from "@/app/actions/staff";

interface StaffSelectStepProps {
  staff: StaffListItem[];
  onSelect: (staffId: number | null) => void;
}

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export function StaffSelectStep({ staff, onSelect }: StaffSelectStepProps) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-heading text-xl text-primary-700">スタッフを指名しますか？</h2>
      <button
        type="button"
        onClick={() => onSelect(null)}
        className="w-full rounded-lg border border-primary-300 bg-primary-50 p-4 text-left shadow-sm"
      >
        <p className="font-medium text-neutral-800">指名なし</p>
      </button>
      {staff.map((member) => (
        <button
          key={member.id}
          type="button"
          onClick={() => onSelect(member.id)}
          className="w-full rounded-lg border border-neutral-200 bg-neutral-0 p-4 text-left shadow-sm transition-colors hover:border-primary-300"
        >
          <p className="font-medium text-neutral-800">{member.name}</p>
          {member.bio && <p className="mt-1 text-sm text-neutral-500">{member.bio}</p>}
          {member.nominationFee > 0 && (
            <p className="mt-1 text-sm text-accent-600">
              指名料 {formatYen(member.nominationFee)}
            </p>
          )}
        </button>
      ))}
    </div>
  );
}
