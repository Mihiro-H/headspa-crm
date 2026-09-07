"use client";

import { useEffect, useState } from "react";
import {
  listCustomerStatuses,
  updateStatusCondition,
  type CustomerStatusItem,
} from "@/app/actions/customer-statuses";
import type { StatusConditionMode } from "@prisma/client";

export default function AdminCustomerStatusesPage() {
  const [statuses, setStatuses] = useState<CustomerStatusItem[]>([]);
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    listCustomerStatuses().then(setStatuses);
  }, []);

  // 1フィールドずつ部分更新する。3項目まとめて送ると、他フィールドの保存が
  // 未完了のうちに別フィールドを編集した場合、古い値で上書きしてしまう競合状態が起きる。
  async function handleSave(
    statusId: number,
    patch: Partial<{
      minVisitCount: number;
      minTotalSpent: number;
      conditionMode: StatusConditionMode;
    }>,
  ) {
    setSaving(statusId);
    await updateStatusCondition({ statusId, ...patch });
    setStatuses((prev) => prev.map((s) => (s.id === statusId ? { ...s, ...patch } : s)));
    setSaving(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-neutral-500">
        4店舗共通の設定です。来店回数・利用金額は4店舗合算でカウントされます。
      </p>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="p-3">ステータス</th>
              <th className="p-3">最低来店回数</th>
              <th className="p-3">最低利用金額</th>
              <th className="p-3">条件</th>
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
                    onBlur={(e) => handleSave(s.id, { minVisitCount: Number(e.target.value) })}
                    className="h-9 w-24 rounded-md border border-neutral-300 px-2"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    min={0}
                    defaultValue={s.minTotalSpent}
                    onBlur={(e) => handleSave(s.id, { minTotalSpent: Number(e.target.value) })}
                    className="h-9 w-28 rounded-md border border-neutral-300 px-2"
                  />
                </td>
                <td className="p-3">
                  <select
                    defaultValue={s.conditionMode}
                    onChange={(e) =>
                      handleSave(s.id, { conditionMode: e.target.value as StatusConditionMode })
                    }
                    className="h-9 rounded-md border border-neutral-300 px-2"
                  >
                    <option value="or">OR（いずれか）</option>
                    <option value="and">AND（両方）</option>
                  </select>
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
