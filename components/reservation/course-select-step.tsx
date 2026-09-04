import { checkGenderRestriction, type MemberGender } from "@/lib/reservation/gender-restriction";
import type { CourseListItem } from "@/app/actions/courses";

interface CourseSelectStepProps {
  courses: CourseListItem[];
  memberGender: MemberGender | null;
  onSelect: (courseId: number) => void;
}

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export function CourseSelectStep({ courses, memberGender, onSelect }: CourseSelectStepProps) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-heading text-xl text-primary-700">コースを選択してください</h2>
      {courses.length === 0 && (
        <p className="rounded-lg bg-neutral-100 p-4 text-sm text-neutral-500">
          現在このカテゴリでご利用いただけるコースがありません。「戻る」から他のカテゴリをお選びください。
        </p>
      )}
      {courses.map((course) => {
        const check =
          memberGender === null
            ? { allowed: true, warning: false }
            : checkGenderRestriction(course.genderRestriction, memberGender);
        const onSale = course.finalPrice < course.originalPrice;

        return (
          <button
            key={course.id}
            type="button"
            disabled={!check.allowed}
            onClick={() => onSelect(course.id)}
            className="w-full rounded-lg border border-neutral-200 bg-neutral-0 p-4 text-left shadow-sm transition-colors hover:border-primary-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <p className="font-medium text-neutral-800">{course.name}</p>
            <p className="mt-1 text-sm text-neutral-500">目安 {course.durationEstimateMin}分</p>
            <p className="mt-2">
              {onSale && (
                <span className="mr-2 text-sm text-neutral-400 line-through">
                  {formatYen(course.originalPrice)}
                </span>
              )}
              <span
                className={onSale ? "font-medium text-accent-600" : "font-medium text-neutral-800"}
              >
                {formatYen(course.finalPrice)}
              </span>
            </p>
            {!check.allowed && (
              <p className="mt-1 text-sm text-error">このコースはご利用いただけません</p>
            )}
            {check.warning && (
              <p className="mt-1 text-sm text-warning">
                施術内容によってはご希望に添えない場合があります
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
