"use client";

import { useEffect, useState } from "react";
import { listCampaigns, createCampaign, type CampaignListItem } from "@/app/actions/manage-campaigns";
import { listAllCoursesForManagement, type ManagedCourse } from "@/app/actions/manage-courses";
import { listCourseCategories, type CourseCategoryListItem } from "@/app/actions/course-categories";
import { listStores, type StoreListItem } from "@/app/actions/stores";

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [courses, setCourses] = useState<ManagedCourse[]>([]);
  const [categories, setCategories] = useState<CourseCategoryListItem[]>([]);
  const [stores, setStores] = useState<StoreListItem[]>([]);

  const [name, setName] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed_amount">("percentage");
  const [discountValue, setDiscountValue] = useState(10);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [priority, setPriority] = useState(0);
  const [targetStoreId, setTargetStoreId] = useState<number | null>(null);
  const [courseIds, setCourseIds] = useState<number[]>([]);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function reload() {
    listCampaigns().then(setCampaigns);
  }

  useEffect(() => {
    reload();
    listAllCoursesForManagement().then(setCourses);
    listCourseCategories().then(setCategories);
    listStores().then(setStores);
  }, []);

  async function handleSubmit() {
    setSubmitting(true);
    await createCampaign({
      name,
      discountType,
      discountValue,
      startDate,
      endDate,
      priority,
      targetStoreId,
      courseIds,
      categoryIds,
    });
    setSubmitting(false);
    setName("");
    setCourseIds([]);
    setCategoryIds([]);
    reload();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl text-primary-700">キャンペーン管理</h1>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="p-3">キャンペーン名</th>
              <th className="p-3">割引</th>
              <th className="p-3">期間</th>
              <th className="p-3">対象店舗</th>
              <th className="p-3">対象</th>
              <th className="p-3">優先度</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-b border-neutral-100 last:border-0">
                <td className="p-3">{c.name}</td>
                <td className="p-3">
                  {c.discountType === "percentage" ? `${c.discountValue}%` : formatYen(c.discountValue)}
                </td>
                <td className="p-3">
                  {c.startDate} 〜 {c.endDate}
                </td>
                <td className="p-3">{c.targetStoreName}</td>
                <td className="p-3">{c.targetNames.join("、") || "—"}</td>
                <td className="p-3">{c.priority}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {campaigns.length === 0 && (
          <p className="p-6 text-center text-sm text-neutral-500">キャンペーンがありません。</p>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-sm">
        <h2 className="font-heading text-lg text-primary-700">新規キャンペーン作成</h2>

        <input
          type="text"
          placeholder="キャンペーン名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        />

        <div className="flex gap-3">
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as "percentage" | "fixed_amount")}
            className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
          >
            <option value="percentage">定率（%）</option>
            <option value="fixed_amount">定額（円）</option>
          </select>
          <input
            type="number"
            min={0}
            value={discountValue}
            onChange={(e) => setDiscountValue(Number(e.target.value))}
            className="h-10 w-32 rounded-md border border-neutral-300 px-3 text-sm"
          />
        </div>

        <div className="flex gap-3">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm text-neutral-600">優先度</label>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="h-10 w-24 rounded-md border border-neutral-300 px-3 text-sm"
          />
        </div>

        <select
          value={targetStoreId ?? ""}
          onChange={(e) => setTargetStoreId(e.target.value ? Number(e.target.value) : null)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        >
          <option value="">全店舗</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <div>
          <p className="mb-1 text-sm text-neutral-600">対象カテゴリ</p>
          <div className="flex flex-wrap gap-3">
            {categories.map((cat) => (
              <label key={cat.id} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={categoryIds.includes(cat.id)}
                  onChange={() =>
                    setCategoryIds((ids) =>
                      ids.includes(cat.id) ? ids.filter((id) => id !== cat.id) : [...ids, cat.id],
                    )
                  }
                />
                {cat.name}
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-sm text-neutral-600">対象コース</p>
          <div className="flex flex-wrap gap-3">
            {courses.map((course) => (
              <label key={course.id} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={courseIds.includes(course.id)}
                  onChange={() =>
                    setCourseIds((ids) =>
                      ids.includes(course.id)
                        ? ids.filter((id) => id !== course.id)
                        : [...ids, course.id],
                    )
                  }
                />
                {course.name}
              </label>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={submitting || !name || !startDate || !endDate}
          onClick={handleSubmit}
          className="h-12 rounded-lg bg-accent-500 font-medium text-white disabled:opacity-50"
        >
          キャンペーンを作成する
        </button>
      </div>
    </div>
  );
}
