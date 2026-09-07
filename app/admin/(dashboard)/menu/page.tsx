"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import {
  listAllCoursesForManagement,
  updateCoursePrice,
  createCourse,
  updateCourseDetails,
  updateCoursePublished,
  type ManagedCourse,
} from "@/app/actions/manage-courses";
import { listCourseCategories, type CourseCategoryListItem } from "@/app/actions/course-categories";
import type { GenderRestriction } from "@/lib/reservation/gender-restriction";
import { Modal } from "@/components/ui/modal";

const EMPTY_FORM = {
  categoryId: null as number | null,
  name: "",
  durationEstimateMin: 60,
  treatmentTimeMin: 50,
  price: 0,
  genderRestriction: "none" as GenderRestriction,
  sortOrder: 0,
};

export default function AdminMenuPage() {
  const [courses, setCourses] = useState<ManagedCourse[]>([]);
  const [categories, setCategories] = useState<CourseCategoryListItem[]>([]);
  const [saving, setSaving] = useState<number | null>(null);
  const [savingField, setSavingField] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  function reload() {
    listAllCoursesForManagement().then(setCourses);
  }

  useEffect(() => {
    reload();
    listCourseCategories().then(setCategories);
  }, []);

  async function handleSave(courseId: number, price: number) {
    setSaving(courseId);
    await updateCoursePrice({ courseId, price });
    setSaving(null);
  }

  async function handleNameBlur(courseId: number, name: string) {
    setSavingField(courseId);
    await updateCourseDetails({ courseId, name, durationEstimateMin: currentDuration(courseId) });
    setSavingField(null);
  }

  async function handleDurationBlur(courseId: number, durationEstimateMin: number) {
    setSavingField(courseId);
    await updateCourseDetails({ courseId, name: currentName(courseId), durationEstimateMin });
    setSavingField(null);
  }

  function currentName(courseId: number): string {
    return courses.find((c) => c.id === courseId)?.name ?? "";
  }

  function currentDuration(courseId: number): number {
    return courses.find((c) => c.id === courseId)?.durationEstimateMin ?? 0;
  }

  async function handlePublishedChange(courseId: number, isPublished: boolean) {
    setSavingField(courseId);
    const previousCourses = courses;
    setCourses((prev) => prev.map((c) => (c.id === courseId ? { ...c, isPublished } : c)));
    try {
      await updateCoursePublished(courseId, isPublished);
    } catch (error) {
      setCourses(previousCourses);
      throw error;
    } finally {
      setSavingField(null);
    }
  }

  async function handleCreate() {
    if (!form.categoryId) return;
    setCreating(true);
    const coursesInCategory = courses.filter((c) => c.categoryId === form.categoryId);
    const nextSortOrder =
      coursesInCategory.length > 0
        ? Math.max(...coursesInCategory.map((c) => c.sortOrder)) + 1
        : 0;
    await createCourse({ ...form, categoryId: form.categoryId, sortOrder: nextSortOrder });
    setCreating(false);
    setForm(EMPTY_FORM);
    setModalOpen(false);
    reload();
  }

  const grouped = courses.reduce<Record<string, ManagedCourse[]>>((acc, c) => {
    acc[c.categoryName] = acc[c.categoryName] ?? [];
    acc[c.categoryName].push(c);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex h-10 items-center gap-1 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white"
        >
          <Plus size={16} />
          新規登録
        </button>
      </div>

      {Object.entries(grouped).map(([categoryName, items]) => (
        <div key={categoryName} className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-neutral-600">{categoryName}</h2>
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500">
                  <th className="p-3">コース名</th>
                  <th className="p-3">所要時間</th>
                  <th className="p-3">料金（税込）</th>
                  <th className="p-3">ステータス</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="border-b border-neutral-100 last:border-0">
                    <td className="p-3">
                      <input
                        type="text"
                        defaultValue={c.name}
                        onBlur={(e) => handleNameBlur(c.id, e.target.value)}
                        className="h-9 w-40 rounded-md border border-neutral-300 px-2"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        min={0}
                        defaultValue={c.durationEstimateMin}
                        onBlur={(e) => handleDurationBlur(c.id, Number(e.target.value))}
                        className="h-9 w-20 rounded-md border border-neutral-300 px-2"
                      />
                      分
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        min={0}
                        defaultValue={c.price}
                        onBlur={(e) => handleSave(c.id, Number(e.target.value))}
                        className="h-9 w-28 rounded-md border border-neutral-300 px-2"
                      />
                    </td>
                    <td className="p-3">
                      <select
                        value={c.isPublished ? "published" : "unpublished"}
                        onChange={(e) => handlePublishedChange(c.id, e.target.value === "published")}
                        className="h-9 rounded-md border border-neutral-300 px-2"
                      >
                        <option value="published">公開中</option>
                        <option value="unpublished">停止中</option>
                      </select>
                    </td>
                    <td className="p-3 text-xs text-neutral-500">
                      {saving === c.id || savingField === c.id ? "保存中..." : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <Modal open={modalOpen} onOpenChange={setModalOpen} title="新規コース登録">
        <div className="flex flex-col gap-3">
          <select
            value={form.categoryId ?? ""}
            onChange={(e) =>
              setForm({ ...form, categoryId: e.target.value ? Number(e.target.value) : null })
            }
            className="h-10 rounded-md border border-neutral-300 px-2"
          >
            <option value="">カテゴリを選択</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="コース名"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <div className="flex gap-3">
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              所要時間（分）
              <input
                type="number"
                min={0}
                value={form.durationEstimateMin}
                onChange={(e) =>
                  setForm({ ...form, durationEstimateMin: Number(e.target.value) })
                }
                className="h-10 w-28 rounded-md border border-neutral-300 px-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              施術時間（分）
              <input
                type="number"
                min={0}
                value={form.treatmentTimeMin}
                onChange={(e) => setForm({ ...form, treatmentTimeMin: Number(e.target.value) })}
                className="h-10 w-28 rounded-md border border-neutral-300 px-2"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            料金（税込）
            <input
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              className="h-10 w-32 rounded-md border border-neutral-300 px-2"
            />
          </label>
          <select
            value={form.genderRestriction}
            onChange={(e) =>
              setForm({ ...form, genderRestriction: e.target.value as GenderRestriction })
            }
            className="h-10 rounded-md border border-neutral-300 px-2"
          >
            <option value="none">性別制限なし</option>
            <option value="female">女性限定</option>
            <option value="male">男性限定</option>
          </select>
          <button
            type="button"
            disabled={creating || !form.categoryId || !form.name}
            onClick={handleCreate}
            className="h-12 rounded-lg bg-primary-500 font-medium text-white disabled:opacity-50"
          >
            登録する
          </button>
        </div>
      </Modal>
    </div>
  );
}
