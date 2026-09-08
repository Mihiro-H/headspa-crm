"use client";

import { useEffect, useState } from "react";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { getDashboardSummary, type DashboardSummary } from "@/app/actions/dashboard-summary";
import { getCurrentAdminStoreScope, type AdminStoreScope } from "@/app/actions/current-admin-scope";

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export default function AdminDashboardPage() {
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [scope, setScope] = useState<AdminStoreScope>({ isUnrestricted: true, storeIds: [] });

  useEffect(() => {
    listStores().then(setStores);
    getCurrentAdminStoreScope().then((s) => {
      setScope(s);
      if (!s.isUnrestricted && s.storeIds.length === 1) {
        setStoreId(s.storeIds[0]);
      }
    });
  }, []);

  useEffect(() => {
    getDashboardSummary(
      storeId,
      new Date(),
      scope.isUnrestricted ? undefined : scope.storeIds,
    ).then(setSummary);
  }, [storeId, scope]);

  const visibleStores = scope.isUnrestricted
    ? stores
    : stores.filter((s) => scope.storeIds.includes(s.id));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <select
          value={storeId ?? ""}
          onChange={(e) => setStoreId(e.target.value ? Number(e.target.value) : null)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        >
          <option value="">全店舗</option>
          {visibleStores.map((s) => (
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
