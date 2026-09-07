"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { listAllStaff, updateStaff, createStaff, type ManagedStaff } from "@/app/actions/manage-staff";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { Modal } from "@/components/ui/modal";

const EMPTY_FORM = { storeId: null as number | null, name: "", bio: "", nominationFee: 0 };

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<ManagedStaff[]>([]);
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [saving, setSaving] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  function reload() {
    listAllStaff().then(setStaff);
  }

  useEffect(() => {
    reload();
    listStores().then(setStores);
  }, []);

  async function handleFeeBlur(member: ManagedStaff, nominationFee: number) {
    setSaving(member.id);
    await updateStaff({ staffId: member.id, nominationFee, isActive: member.isActive });
    setStaff((prev) => prev.map((s) => (s.id === member.id ? { ...s, nominationFee } : s)));
    setSaving(null);
  }

  async function handleToggleActive(member: ManagedStaff) {
    const isActive = !member.isActive;
    setSaving(member.id);
    await updateStaff({ staffId: member.id, nominationFee: member.nominationFee, isActive });
    setStaff((prev) => prev.map((s) => (s.id === member.id ? { ...s, isActive } : s)));
    setSaving(null);
  }

  async function handleCreate() {
    if (!form.storeId) return;
    setCreating(true);
    await createStaff({ ...form, storeId: form.storeId, bio: form.bio || null });
    setCreating(false);
    setForm(EMPTY_FORM);
    setModalOpen(false);
    reload();
  }

  const grouped = staff.reduce<Record<string, ManagedStaff[]>>((acc, s) => {
    acc[s.storeName] = acc[s.storeName] ?? [];
    acc[s.storeName].push(s);
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

      {Object.entries(grouped).map(([storeName, members]) => (
        <div key={storeName} className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-neutral-600">{storeName}</h2>
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500">
                  <th className="p-3">氏名</th>
                  <th className="p-3">紹介文</th>
                  <th className="p-3">指名料金</th>
                  <th className="p-3">在籍</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {members.map((s) => (
                  <tr key={s.id} className="border-b border-neutral-100 last:border-0">
                    <td className="p-3">{s.name}</td>
                    <td className="p-3 text-neutral-500">{s.bio ?? "—"}</td>
                    <td className="p-3">
                      <input
                        type="number"
                        min={0}
                        defaultValue={s.nominationFee}
                        onBlur={(e) => handleFeeBlur(s, Number(e.target.value))}
                        className="h-9 w-24 rounded-md border border-neutral-300 px-2"
                      />
                    </td>
                    <td className="p-3">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={s.isActive} onChange={() => handleToggleActive(s)} />
                        {s.isActive ? "在籍中" : "退職"}
                      </label>
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
      ))}

      <Modal open={modalOpen} onOpenChange={setModalOpen} title="新規スタッフ登録">
        <div className="flex flex-col gap-3">
          <select
            value={form.storeId ?? ""}
            onChange={(e) => setForm({ ...form, storeId: e.target.value ? Number(e.target.value) : null })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          >
            <option value="">所属店舗を選択</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="氏名"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <textarea
            placeholder="紹介文（任意）"
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            rows={3}
            className="rounded-md border border-neutral-300 px-2 py-2"
          />
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            指名料金
            <input
              type="number"
              min={0}
              value={form.nominationFee}
              onChange={(e) => setForm({ ...form, nominationFee: Number(e.target.value) })}
              className="h-10 w-32 rounded-md border border-neutral-300 px-2"
            />
          </label>
          <button
            type="button"
            disabled={creating || !form.storeId || !form.name}
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
