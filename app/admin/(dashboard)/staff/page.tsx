"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, RotateCcw } from "lucide-react";
import {
  listAllStaff,
  updateStaff,
  updateStaffProfile,
  createStaff,
  type ManagedStaff,
} from "@/app/actions/manage-staff";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { getCurrentAdminStoreScope, type AdminStoreScope } from "@/app/actions/current-admin-scope";
import { Modal } from "@/components/ui/modal";

const EMPTY_FORM = { storeId: null as number | null, name: "", bio: "", nominationFee: 0 };
const EMPTY_EDIT_FORM = { name: "", bio: "", storeId: null as number | null };

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<ManagedStaff[]>([]);
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [storeFilter, setStoreFilter] = useState<number | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [scope, setScope] = useState<AdminStoreScope>({ isUnrestricted: true, storeIds: [] });
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState<ManagedStaff | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [editSaving, setEditSaving] = useState(false);

  function reload() {
    listAllStaff().then(setStaff);
  }

  useEffect(() => {
    reload();
    listStores().then(setStores);
    getCurrentAdminStoreScope().then((s) => {
      setScope(s);
      if (!s.isUnrestricted && s.storeIds.length === 1) {
        setStoreFilter(s.storeIds[0]);
      }
    });
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

  function startEdit(member: ManagedStaff) {
    setEditing(member);
    setEditForm({ name: member.name, bio: member.bio ?? "", storeId: member.storeId });
  }

  async function handleSaveEdit() {
    if (!editing || !editForm.storeId) return;
    setEditSaving(true);
    await updateStaffProfile({
      staffId: editing.id,
      name: editForm.name,
      bio: editForm.bio || null,
      storeId: editForm.storeId,
    });
    setEditSaving(false);
    setEditing(null);
    reload();
  }

  const visibleStaff =
    storeFilter === null ? staff : staff.filter((s) => s.storeId === storeFilter);
  const visibleStoreOptions = scope.isUnrestricted
    ? stores
    : stores.filter((s) => scope.storeIds.includes(s.id));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <select
          value={storeFilter ?? ""}
          onChange={(e) => setStoreFilter(e.target.value ? Number(e.target.value) : null)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        >
          <option value="">全店舗</option>
          {visibleStoreOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex h-10 items-center gap-1 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white"
        >
          <Plus size={16} />
          新規登録
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="p-3">氏名</th>
              <th className="p-3">紹介文</th>
              {storeFilter === null && <th className="p-3">所属店舗</th>}
              <th className="p-3">指名料金</th>
              <th className="p-3">在籍</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {visibleStaff.map((s) => (
              <tr key={s.id} className="border-b border-neutral-100 last:border-0">
                <td className="p-3">{s.name}</td>
                <td className="p-3 text-neutral-500">{s.bio ?? "—"}</td>
                {storeFilter === null && <td className="p-3">{s.storeName}</td>}
                <td className="p-3">
                  <input
                    type="number"
                    min={0}
                    defaultValue={s.nominationFee}
                    onBlur={(e) => handleFeeBlur(s, Number(e.target.value))}
                    className="h-9 w-24 rounded-md border border-neutral-300 px-2"
                  />
                </td>
                <td className="p-3">{s.isActive ? "在籍中" : "退職"}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(s)}
                      className="text-neutral-500 hover:text-primary-600"
                      aria-label="編集"
                    >
                      <Pencil size={16} />
                    </button>
                    {s.isActive ? (
                      <button
                        type="button"
                        onClick={() => handleToggleActive(s)}
                        className="text-neutral-500 hover:text-error"
                        aria-label="退職扱いにする"
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleActive(s)}
                        className="text-neutral-500 hover:text-primary-600"
                        aria-label="在籍中に戻す"
                      >
                        <RotateCcw size={16} />
                      </button>
                    )}
                    {saving === s.id && <span className="text-xs text-neutral-500">保存中...</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleStaff.length === 0 && (
          <p className="p-6 text-center text-sm text-neutral-500">該当するスタッフがいません。</p>
        )}
      </div>

      <Modal open={modalOpen} onOpenChange={setModalOpen} title="新規スタッフ登録">
        <div className="flex flex-col gap-3">
          <select
            value={form.storeId ?? ""}
            onChange={(e) =>
              setForm({ ...form, storeId: e.target.value ? Number(e.target.value) : null })
            }
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

      <Modal
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="スタッフ情報を編集"
      >
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="氏名"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <textarea
            placeholder="紹介文（任意）"
            value={editForm.bio}
            onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
            rows={3}
            className="rounded-md border border-neutral-300 px-2 py-2"
          />
          <select
            value={editForm.storeId ?? ""}
            onChange={(e) =>
              setEditForm({ ...editForm, storeId: e.target.value ? Number(e.target.value) : null })
            }
            className="h-10 rounded-md border border-neutral-300 px-2"
          >
            <option value="">所属店舗を選択</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={editSaving || !editForm.name || !editForm.storeId}
            onClick={handleSaveEdit}
            className="h-12 rounded-lg bg-primary-500 font-medium text-white disabled:opacity-50"
          >
            更新する
          </button>
        </div>
      </Modal>
    </div>
  );
}
