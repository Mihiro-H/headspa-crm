"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import {
  listAllStoresForManagement,
  updateStoreDetails,
  createStore,
  type ManagedStore,
} from "@/app/actions/manage-stores";
import { Modal } from "@/components/ui/modal";

const EMPTY_FORM = {
  name: "",
  address: "",
  phone: "",
  nearestStation: "",
  weekdayOpen: "11:00",
  weekdayClose: "20:00",
  weekendOpen: "10:00",
  weekendClose: "18:00",
  luxuryLastOrderWeekday: "19:30",
  luxuryLastOrderWeekend: "17:30",
};

export default function AdminStoresPage() {
  const [stores, setStores] = useState<ManagedStore[]>([]);
  const [saving, setSaving] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  function reload() {
    listAllStoresForManagement().then(setStores);
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleSave(storeId: number, address: string, phone: string) {
    setSaving(storeId);
    await updateStoreDetails({ storeId, address, phone });
    setSaving(null);
  }

  async function handleCreate() {
    setCreating(true);
    await createStore({
      ...form,
      address: form.address || null,
      nearestStation: form.nearestStation || null,
    });
    setCreating(false);
    setForm(EMPTY_FORM);
    setModalOpen(false);
    reload();
  }

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

      <Modal open={modalOpen} onOpenChange={setModalOpen} title="新規店舗登録">
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="店舗名"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <input
            type="text"
            placeholder="住所"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <input
            type="text"
            placeholder="電話番号"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <input
            type="text"
            placeholder="最寄駅（任意）"
            value={form.nearestStation}
            onChange={(e) => setForm({ ...form, nearestStation: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              平日 開店
              <input
                type="time"
                value={form.weekdayOpen}
                onChange={(e) => setForm({ ...form, weekdayOpen: e.target.value })}
                className="h-10 rounded-md border border-neutral-300 px-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              平日 閉店
              <input
                type="time"
                value={form.weekdayClose}
                onChange={(e) => setForm({ ...form, weekdayClose: e.target.value })}
                className="h-10 rounded-md border border-neutral-300 px-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              週末 開店
              <input
                type="time"
                value={form.weekendOpen}
                onChange={(e) => setForm({ ...form, weekendOpen: e.target.value })}
                className="h-10 rounded-md border border-neutral-300 px-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              週末 閉店
              <input
                type="time"
                value={form.weekendClose}
                onChange={(e) => setForm({ ...form, weekendClose: e.target.value })}
                className="h-10 rounded-md border border-neutral-300 px-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              ラグジュアリー最終受付（平日）
              <input
                type="time"
                value={form.luxuryLastOrderWeekday}
                onChange={(e) => setForm({ ...form, luxuryLastOrderWeekday: e.target.value })}
                className="h-10 rounded-md border border-neutral-300 px-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              ラグジュアリー最終受付（週末）
              <input
                type="time"
                value={form.luxuryLastOrderWeekend}
                onChange={(e) => setForm({ ...form, luxuryLastOrderWeekend: e.target.value })}
                className="h-10 rounded-md border border-neutral-300 px-2"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={
              creating ||
              !form.name ||
              !form.phone ||
              !form.weekdayOpen ||
              !form.weekdayClose ||
              !form.weekendOpen ||
              !form.weekendClose ||
              !form.luxuryLastOrderWeekday ||
              !form.luxuryLastOrderWeekend
            }
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
