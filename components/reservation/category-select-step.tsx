import type { CourseCategoryListItem } from "@/app/actions/course-categories";

interface CategorySelectStepProps {
  categories: CourseCategoryListItem[];
  onSelect: (categoryId: number) => void;
}

export function CategorySelectStep({ categories, onSelect }: CategorySelectStepProps) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-heading text-xl text-primary-700">コースカテゴリを選択してください</h2>
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onSelect(category.id)}
          className="rounded-lg border border-neutral-200 bg-neutral-0 p-4 text-left shadow-sm transition-colors hover:border-primary-300"
        >
          <p className="font-medium text-neutral-800">{category.name}</p>
          {category.description && (
            <p className="mt-1 text-sm text-neutral-500">{category.description}</p>
          )}
        </button>
      ))}
    </div>
  );
}
