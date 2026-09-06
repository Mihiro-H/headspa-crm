"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import {
  previewSegmentAudience,
  type SegmentChannelMode,
  type AudiencePreview,
} from "@/app/actions/segment-audience";
import {
  createSegmentCampaign,
  listSegmentCampaigns,
  type SegmentCampaignListItem,
} from "@/app/actions/segment-campaigns";
import { listTemplates, type TemplateListItem } from "@/app/actions/manage-templates";
import { listCustomerStatuses, type CustomerStatusItem } from "@/app/actions/customer-statuses";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { Modal } from "@/components/ui/modal";

const CHANNEL_LABEL: Record<SegmentChannelMode, string> = {
  email: "メール",
  line: "LINE",
  auto: "両方（自動振り分け）",
};

export default function SegmentCampaignsPage() {
  const [statuses, setStatuses] = useState<CustomerStatusItem[]>([]);
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [history, setHistory] = useState<SegmentCampaignListItem[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [statusId, setStatusId] = useState<number | null>(null);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [channelMode, setChannelMode] = useState<SegmentChannelMode>("auto");
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  function refreshHistory() {
    listSegmentCampaigns().then(setHistory);
  }

  useEffect(() => {
    listCustomerStatuses().then(setStatuses);
    listStores().then(setStores);
    listTemplates().then((all) => setTemplates(all.filter((t) => t.type === "segment")));
    refreshHistory();
  }, []);

  async function handlePreview() {
    setPreviewing(true);
    const result = await previewSegmentAudience(
      { name: name || undefined, statusId: statusId ?? undefined, storeId: storeId ?? undefined },
      channelMode,
    );
    setPreview(result);
    setPreviewing(false);
  }

  async function handleSend() {
    if (!templateId) return;
    setSending(true);
    setResultMessage(null);
    const result = await createSegmentCampaign({
      name: campaignName,
      condition: {
        name: name || undefined,
        statusId: statusId ?? undefined,
        storeId: storeId ?? undefined,
      },
      channelMode,
      templateId,
      scheduledAt: scheduledAt || null,
    });
    setSending(false);

    if (result.status === "unauthorized") {
      setResultMessage("権限がありません。");
    } else if (result.status === "scheduled") {
      setResultMessage(`${result.targetCount}名への配信を予約しました。`);
      setModalOpen(false);
    } else {
      setResultMessage(
        `配信完了：成功${result.sentCount}件／失敗${result.failedCount}件（対象${result.targetCount}件）`,
      );
      setModalOpen(false);
    }
    refreshHistory();
  }

  function openModal() {
    setName("");
    setStatusId(null);
    setStoreId(null);
    setChannelMode("auto");
    setTemplateId(null);
    setCampaignName("");
    setScheduledAt("");
    setPreview(null);
    setResultMessage(null);
    setModalOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl text-primary-700">メール／LINE配信管理</h1>
        <button
          type="button"
          onClick={openModal}
          className="flex h-10 items-center gap-1 rounded-lg bg-accent-500 px-4 text-sm font-medium text-white"
        >
          <Plus size={16} />
          配信設定
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-neutral-600">配信履歴</h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="p-3">配信名</th>
                <th className="p-3">チャネル</th>
                <th className="p-3">テンプレート</th>
                <th className="p-3">対象人数</th>
                <th className="p-3">予約日時</th>
                <th className="p-3">送信日時</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-b border-neutral-100 last:border-0">
                  <td className="p-3">{h.name}</td>
                  <td className="p-3">{CHANNEL_LABEL[h.channelMode]}</td>
                  <td className="p-3">{h.templateName}</td>
                  <td className="p-3">{h.targetCount}名</td>
                  <td className="p-3">{h.scheduledAt ?? "—"}</td>
                  <td className="p-3">{h.sentAt ?? "未送信"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {history.length === 0 && (
            <p className="p-6 text-center text-sm text-neutral-500">配信履歴がありません。</p>
          )}
        </div>
      </div>

      <Modal open={modalOpen} onOpenChange={setModalOpen} title="配信設定">
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-medium text-neutral-600">配信対象の条件</h3>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="氏名で絞り込み"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 rounded-md border border-neutral-300 px-2"
            />
            <select
              value={statusId ?? ""}
              onChange={(e) => setStatusId(e.target.value ? Number(e.target.value) : null)}
              className="h-10 rounded-md border border-neutral-300 px-2"
            >
              <option value="">すべてのステータス</option>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={storeId ?? ""}
              onChange={(e) => setStoreId(e.target.value ? Number(e.target.value) : null)}
              className="h-10 rounded-md border border-neutral-300 px-2"
            >
              <option value="">全店舗</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <h3 className="text-sm font-medium text-neutral-600">配信チャネル</h3>
          <select
            value={channelMode}
            onChange={(e) => setChannelMode(e.target.value as SegmentChannelMode)}
            className="h-10 w-60 rounded-md border border-neutral-300 px-2"
          >
            <option value="auto">両方（自動振り分け）</option>
            <option value="email">メール</option>
            <option value="line">LINE</option>
          </select>

          <button
            type="button"
            onClick={handlePreview}
            disabled={previewing}
            className="h-10 w-40 rounded-lg border border-primary-500 text-primary-600 disabled:opacity-50"
          >
            対象人数を確認
          </button>
          {preview && (
            <p className="text-sm text-neutral-700">
              {preview.totalCount}名に配信されます（うちLINE {preview.lineCount}名／メール{" "}
              {preview.emailCount}名）
            </p>
          )}

          <h3 className="text-sm font-medium text-neutral-600">配信内容</h3>
          <select
            value={templateId ?? ""}
            onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : null)}
            className="h-10 rounded-md border border-neutral-300 px-2"
          >
            <option value="">テンプレートを選択</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <a href="/admin/templates" className="text-sm text-primary-600 underline">
            ＋新しいテンプレートを作成する
          </a>
          <input
            type="text"
            placeholder="配信名（管理用）"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">配信日時（空欄の場合は即時配信）</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="h-10 w-64 rounded-md border border-neutral-300 px-2"
            />
          </div>

          {resultMessage && <p className="text-sm text-neutral-700">{resultMessage}</p>}

          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !templateId || !campaignName}
            className="h-12 rounded-lg bg-accent-500 px-4 font-medium text-white disabled:opacity-50"
          >
            {scheduledAt ? "配信を予約する" : "今すぐ配信する"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
