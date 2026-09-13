"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2, RotateCcw, Plus, Send } from "lucide-react";
import {
  listAdmins,
  createAdmin,
  resendAdminInvite,
  updateAdmin,
  deactivateAdmin,
  reactivateAdmin,
  type AdminListItem,
} from "@/app/actions/manage-admins";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { Modal } from "@/components/ui/modal";
import type { AdminRole } from "@prisma/client";

const ROLE_LABEL: Record<AdminRole, string> = {
  hq: "本部",
  manager: "店長",
  staff: "一般",
};

const EMAIL_STATUS_MESSAGE: Record<"sent" | "not_configured" | "failed", string> = {
  sent: "招待メールを送信しました。",
  not_configured:
    "メール送信が未設定のため招待メールは送信されませんでした。Resend設定後、一覧の「招待を再送信」から送信してください。",
  failed: "招待メールの送信に失敗しました。後ほど「招待を再送信」からやり直してください。",
};

const EMPTY_CREATE_FORM = {
  name: "",
  email: "",
  role: "staff" as AdminRole,
  storeIds: [] as number[],
};

export default function AdminAccountsPage() {
  const [admins, setAdmins] = useState<AdminListItem[]>([]);
  const [stores, setStores] = useState<StoreListItem[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ message: string; inviteUrl: string } | null>(
    null,
  );

  const [editing, setEditing] = useState<AdminListItem | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    role: "staff" as AdminRole,
    storeIds: [] as number[],
  });
  const [saving, setSaving] = useState(false);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  function reload() {
    listAdmins().then(setAdmins);
  }

  useEffect(() => {
    reload();
    listStores().then(setStores);
  }, []);

  function toggleCreateStore(id: number) {
    setCreateForm((f) => ({
      ...f,
      storeIds: f.storeIds.includes(id) ? f.storeIds.filter((s) => s !== id) : [...f.storeIds, id],
    }));
  }

  function toggleEditStore(id: number) {
    setEditForm((f) => ({
      ...f,
      storeIds: f.storeIds.includes(id) ? f.storeIds.filter((s) => s !== id) : [...f.storeIds, id],
    }));
  }

  function openCreate() {
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateError(null);
    setInviteResult(null);
    setCreateOpen(true);
  }

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);
    const result = await createAdmin({
      name: createForm.name,
      email: createForm.email,
      role: createForm.role,
      storeIds: createForm.role === "hq" ? [] : createForm.storeIds,
    });
    setCreating(false);
    if (result.status === "email_taken") {
      setCreateError("このメールアドレスは既に登録されています。");
      return;
    }
    setInviteResult({
      message: EMAIL_STATUS_MESSAGE[result.emailStatus],
      inviteUrl: result.inviteUrl,
    });
    reload();
  }

  function startEdit(admin: AdminListItem) {
    setEditing(admin);
    setEditForm({ name: admin.name, role: admin.role, storeIds: admin.storeIds });
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setSaving(true);
    await updateAdmin({
      adminId: editing.id,
      name: editForm.name,
      role: editForm.role,
      storeIds: editForm.role === "hq" ? [] : editForm.storeIds,
    });
    setSaving(false);
    setEditing(null);
    reload();
  }

  async function handleDeactivate(admin: AdminListItem) {
    if (!window.confirm(`${admin.name}様をアーカイブしますか？`)) return;
    await deactivateAdmin(admin.id);
    reload();
  }

  async function handleReactivate(admin: AdminListItem) {
    await reactivateAdmin(admin.id);
    reload();
  }

  async function handleResendInvite(admin: AdminListItem) {
    setResendingId(admin.id);
    setResendMessage(null);
    const result = await resendAdminInvite(admin.id);
    setResendingId(null);
    if (result.status === "resent") {
      setResendMessage(`${admin.name}様: ${EMAIL_STATUS_MESSAGE[result.emailStatus]}`);
    }
    reload();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="flex h-10 items-center gap-1 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white"
        >
          <Plus size={16} />
          新規登録
        </button>
      </div>

      {resendMessage && (
        <p role="status" aria-live="polite" className="text-sm text-neutral-700">
          {resendMessage}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="p-3">氏名</th>
              <th className="p-3">メールアドレス</th>
              <th className="p-3">所属店舗</th>
              <th className="p-3">ロール</th>
              <th className="p-3">状態</th>
              <th className="p-3">招待状況</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr
                key={a.id}
                className={`border-b border-neutral-100 last:border-0 ${!a.isActive ? "opacity-50" : ""}`}
              >
                <td className="p-3">{a.name}</td>
                <td className="p-3">{a.email}</td>
                <td className="p-3">
                  {a.role === "hq" ? "全店舗" : a.storeNames.join("、") || "—"}
                </td>
                <td className="p-3">{ROLE_LABEL[a.role]}</td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs text-white ${
                      a.isActive ? "bg-primary-500" : "bg-neutral-400"
                    }`}
                  >
                    {a.isActive ? "アクティブ" : "アーカイブ"}
                  </span>
                </td>
                <td className="p-3">
                  {a.isPending ? (
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-primary-50 px-2 py-1 text-xs text-primary-700">
                        招待中
                      </span>
                      <button
                        type="button"
                        onClick={() => handleResendInvite(a)}
                        disabled={resendingId === a.id}
                        className="flex items-center gap-1 text-xs text-primary-600 hover:underline disabled:opacity-50"
                      >
                        <Send size={12} />
                        招待を再送信
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-neutral-500">設定済み</span>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(a)}
                      className="text-neutral-500 hover:text-primary-600"
                      aria-label="編集"
                    >
                      <Pencil size={16} />
                    </button>
                    {a.isActive ? (
                      <button
                        type="button"
                        onClick={() => handleDeactivate(a)}
                        className="text-neutral-500 hover:text-error"
                        aria-label="アーカイブ"
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleReactivate(a)}
                        className="text-neutral-500 hover:text-primary-600"
                        aria-label="復元"
                      >
                        <RotateCcw size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {admins.length === 0 && (
          <p className="p-6 text-center text-sm text-neutral-500">管理者アカウントがありません。</p>
        )}
      </div>

      <Modal open={createOpen} onOpenChange={setCreateOpen} title="新規アカウント登録">
        <div className="flex flex-col gap-3">
          {createError && (
            <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{createError}</p>
          )}
          {inviteResult ? (
            <div className="flex flex-col gap-2 rounded-lg border border-primary-200 bg-primary-50 p-3">
              <p className="text-sm text-neutral-700">{inviteResult.message}</p>
              <p className="text-xs text-neutral-500">
                招待リンク（Resend未設定の間はこちらを手動で共有してください）:
              </p>
              <p className="select-all break-all rounded-md bg-neutral-0 px-3 py-2 font-mono text-xs">
                {inviteResult.inviteUrl}
              </p>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="h-10 rounded-lg bg-primary-500 font-medium text-white"
              >
                閉じる
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                placeholder="氏名"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                className="h-10 rounded-md border border-neutral-300 px-2"
              />
              <input
                type="email"
                placeholder="メールアドレス"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                className="h-10 rounded-md border border-neutral-300 px-2"
              />
              <select
                value={createForm.role}
                onChange={(e) =>
                  setCreateForm({ ...createForm, role: e.target.value as AdminRole })
                }
                className="h-10 rounded-md border border-neutral-300 px-2"
              >
                <option value="hq">本部</option>
                <option value="manager">店長</option>
                <option value="staff">一般</option>
              </select>
              {createForm.role !== "hq" && (
                <div>
                  <p className="mb-1 text-sm text-neutral-600">所属店舗</p>
                  <div className="flex flex-wrap gap-3">
                    {stores.map((s) => (
                      <label key={s.id} className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={createForm.storeIds.includes(s.id)}
                          onChange={() => toggleCreateStore(s.id)}
                        />
                        {s.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <button
                type="button"
                disabled={creating || !createForm.name || !createForm.email}
                onClick={handleCreate}
                className="h-12 rounded-lg bg-primary-500 font-medium text-white disabled:opacity-50"
              >
                招待メールを送信して登録する
              </button>
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="アカウント情報を編集"
      >
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="氏名"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <select
            value={editForm.role}
            onChange={(e) => setEditForm({ ...editForm, role: e.target.value as AdminRole })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          >
            <option value="hq">本部</option>
            <option value="manager">店長</option>
            <option value="staff">一般</option>
          </select>
          {editForm.role !== "hq" && (
            <div>
              <p className="mb-1 text-sm text-neutral-600">所属店舗</p>
              <div className="flex flex-wrap gap-3">
                {stores.map((s) => (
                  <label key={s.id} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.storeIds.includes(s.id)}
                      onChange={() => toggleEditStore(s.id)}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <button
            type="button"
            disabled={saving || !editForm.name}
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
