"use client";

import { useEffect, useState } from "react";
import {
  listAllCoursesForManagement,
  updateCoursePrice,
  type ManagedCourse,
} from "@/app/actions/manage-courses";

export default function AdminMenuPage() {
  const [courses, setCourses] = useState<ManagedCourse[]>([]);
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    listAllCoursesForManagement().then(setCourses);
  }, []);

  async function handleSave(courseId: number, price: number) {
    setSaving(courseId);
    await updateCoursePrice({ courseId, price });
    setSaving(null);
  }

  const grouped = courses.reduce<Record<string, ManagedCourse[]>>((acc, c) => {
    acc[c.categoryName] = acc[c.categoryName] ?? [];
    acc[c.categoryName].push(c);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl text-primary-700">メニュー・料金管理</h1>

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
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="border-b border-neutral-100 last:border-0">
                    <td className="p-3">{c.name}</td>
                    <td className="p-3">{c.durationEstimateMin}分</td>
                    <td className="p-3">
                      <input
                        type="number"
                        min={0}
                        defaultValue={c.price}
                        onBlur={(e) => handleSave(c.id, Number(e.target.value))}
                        className="h-9 w-28 rounded-md border border-neutral-300 px-2"
                      />
                    </td>
                    <td className="p-3 text-xs text-neutral-500">
                      {saving === c.id ? "保存中..." : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
