"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil } from "lucide-react";
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  type TemplateListItem,
  type DeliveryTemplateType,
} from "@/app/actions/manage-templates";
import { Modal } from "@/components/ui/modal";

const TYPE_LABEL: Record<DeliveryTemplateType, string> = {
  birthday: "誕生月メール",
  reminder: "前日リマインド",
  segment: "セグメント配信",
};

const EMPTY_FORM = { type: "segment" as DeliveryTemplateType, name: "", subject: "", bodyText: "" };

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function refresh() {
    listTemplates().then(setTemplates);
  }

  useEffect(() => {
    refresh();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(t: TemplateListItem) {
    setEditingId(t.id);
    setForm({ type: t.type, name: t.name, subject: t.subject ?? "", bodyText: t.bodyText });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    if (editingId) {
      await updateTemplate({
        templateId: editingId,
        name: form.name,
        subject: form.subject || null,
        bodyText: form.bodyText,
      });
    } else {
      await createTemplate({
        type: form.type,
        name: form.name,
        subject: form.subject || null,
        bodyText: form.bodyText,
      });
    }
    setSaving(false);
    setModalOpen(false);
    refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl text-primary-700">配信テンプレート管理</h1>
        <button
          type="button"
          onClick={openCreate}
          className="flex h-10 items-center gap-1 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white"
        >
          <Plus size={16} />
          新規テンプレート作成
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="p-3">種別</th>
              <th className="p-3">名称</th>
              <th className="p-3">件名</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} className="border-b border-neutral-100 last:border-0">
                <td className="p-3">{TYPE_LABEL[t.type]}</td>
                <td className="p-3">{t.name}</td>
                <td className="p-3 text-neutral-500">{t.subject ?? "—"}</td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => openEdit(t)}
                    className="text-neutral-500 hover:text-primary-600"
                    aria-label="編集"
                  >
                    <Pencil size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {templates.length === 0 && (
          <p className="p-6 text-center text-sm text-neutral-500">テンプレートがありません。</p>
        )}
      </div>

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingId ? "テンプレートを編集" : "新規テンプレートを作成"}
      >
        <div className="flex flex-col gap-3">
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as DeliveryTemplateType })}
            disabled={editingId !== null}
            className="h-10 rounded-md border border-neutral-300 px-2"
          >
            <option value="segment">セグメント配信</option>
            <option value="birthday">誕生月メール</option>
            <option value="reminder">前日リマインド</option>
          </select>
          <input
            type="text"
            placeholder="テンプレート名"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <input
            type="text"
            placeholder="件名（メール用。LINEのみの場合は空欄可）"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <textarea
            placeholder="本文（差し込みタグ：{{氏名}} が利用できます）"
            value={form.bodyText}
            onChange={(e) => setForm({ ...form, bodyText: e.target.value })}
            rows={5}
            className="rounded-md border border-neutral-300 px-2 py-2"
          />
          <button
            type="button"
            disabled={saving || !form.name || !form.bodyText}
            onClick={handleSave}
            className="h-10 rounded-lg bg-primary-500 px-4 font-medium text-white disabled:opacity-50"
          >
            {editingId ? "更新する" : "作成する"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
