"use client";

import { useEffect, useState } from "react";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { getDashboardSummary, type DashboardSummary } from "@/app/actions/dashboard-summary";

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export default function AdminDashboardPage() {
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    listStores().then(setStores);
  }, []);

  useEffect(() => {
    getDashboardSummary(storeId).then(setSummary);
  }, [storeId]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <select
          value={storeId ?? ""}
          onChange={(e) => setStoreId(e.target.value ? Number(e.target.value) : null)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        >
          <option value="">全店舗</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-neutral-200 bg-neutral-0 p-6 shadow-sm">
          <p className="text-sm text-neutral-500">本日の予約件数</p>
          <p className="mt-2 text-3xl font-medium text-neutral-800">
            {summary?.todayReservationCount ?? "—"}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-0 p-6 shadow-sm">
          <p className="text-sm text-neutral-500">本日の売上速報</p>
          <p className="mt-2 text-3xl font-medium text-neutral-800">
            {summary ? formatYen(summary.todaySalesTotal) : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
