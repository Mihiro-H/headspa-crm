"use client";

import { useEffect, useState } from "react";
import {
  listAllStoresForManagement,
  updateStoreDetails,
  type ManagedStore,
} from "@/app/actions/manage-stores";

export default function AdminStoresPage() {
  const [stores, setStores] = useState<ManagedStore[]>([]);
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    listAllStoresForManagement().then(setStores);
  }, []);

  async function handleSave(storeId: number, address: string, phone: string) {
    setSaving(storeId);
    await updateStoreDetails({ storeId, address, phone });
    setSaving(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl text-primary-700">店舗管理</h1>

      <div className="flex flex-col gap-4">
        {stores.map((s) => (
          <div
            key={s.id}
            className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-sm"
          >
            <p className="font-medium text-neutral-800">{s.name}</p>
            {s.nearestStation && (
              <p className="text-xs text-neutral-500">{s.nearestStation}</p>
            )}
            <label className="text-sm text-neutral-600">住所</label>
            <input
              type="text"
              defaultValue={s.address ?? ""}
              onBlur={(e) => handleSave(s.id, e.target.value, s.phone)}
              className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
            />
            <label className="text-sm text-neutral-600">電話番号</label>
            <input
              type="text"
              defaultValue={s.phone}
              onBlur={(e) => handleSave(s.id, s.address ?? "", e.target.value)}
              className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
            />
            {saving === s.id && <p className="text-xs text-neutral-500">保存中...</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
