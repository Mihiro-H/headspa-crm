"use client";

import { useEffect, useState } from "react";
import {
  listCustomerStatuses,
  updateStatusThreshold,
  type CustomerStatusItem,
} from "@/app/actions/customer-statuses";

export default function AdminCustomerStatusesPage() {
  const [statuses, setStatuses] = useState<CustomerStatusItem[]>([]);
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    listCustomerStatuses().then(setStatuses);
  }, []);

  async function handleSave(statusId: number, minVisitCount: number) {
    setSaving(statusId);
    await updateStatusThreshold({ statusId, minVisitCount });
    setSaving(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl text-primary-700">顧客ステータス設定</h1>
      <p className="text-sm text-neutral-500">
        4店舗共通の設定です。来店回数は4店舗合算でカウントされます。
      </p>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="p-3">ステータス</th>
              <th className="p-3">最低来店回数</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {statuses.map((s) => (
              <tr key={s.id} className="border-b border-neutral-100 last:border-0">
                <td className="p-3">
                  <span
                    className="rounded-full px-2 py-1 text-xs text-white"
                    style={{ backgroundColor: s.colorCode }}
                  >
                    {s.name}
                  </span>
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    min={0}
                    defaultValue={s.minVisitCount}
                    onBlur={(e) => handleSave(s.id, Number(e.target.value))}
                    className="h-9 w-24 rounded-md border border-neutral-300 px-2"
                  />
                </td>
                <td className="p-3 text-xs text-neutral-500">
                  {saving === s.id ? "保存中..." : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
