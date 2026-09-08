"use client";

import { useEffect, useState } from "react";
import {
  listAutoDeliverySettings,
  upsertAutoDeliverySetting,
  type AutoDeliveryType,
  type ChannelMode,
  type AutoDeliverySettingItem,
} from "@/app/actions/auto-delivery-settings";
import { listTemplates, type TemplateListItem } from "@/app/actions/manage-templates";

const TYPE_LABEL: Record<AutoDeliveryType, string> = {
  birthday: "誕生月メール",
  reminder: "前日リマインド",
};

interface SectionState {
  channelMode: ChannelMode;
  sendTiming: string;
  templateId: number | null;
  isActive: boolean;
}

function toSectionState(
  setting: AutoDeliverySettingItem | undefined,
  defaultTiming: string,
): SectionState {
  return {
    channelMode: setting?.channelMode ?? "auto",
    sendTiming: setting?.sendTiming ?? defaultTiming,
    templateId: setting?.templateId ?? null,
    isActive: setting?.isActive ?? true,
  };
}

export interface AutoDeliveryTabProps {
  onNavigateToTemplates: () => void;
}

export function AutoDeliveryTab({ onNavigateToTemplates }: AutoDeliveryTabProps) {
  const [settings, setSettings] = useState<AutoDeliverySettingItem[]>([]);
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [birthday, setBirthday] = useState<SectionState>(toSectionState(undefined, "month_start"));
  const [reminder, setReminder] = useState<SectionState>(
    toSectionState(undefined, "18:00_day_before"),
  );
  const [saving, setSaving] = useState<AutoDeliveryType | null>(null);

  function refresh() {
    listAutoDeliverySettings().then((all) => {
      setSettings(all);
      setBirthday(toSectionState(all.find((s) => s.type === "birthday"), "month_start"));
      setReminder(toSectionState(all.find((s) => s.type === "reminder"), "18:00_day_before"));
    });
  }

  useEffect(() => {
    refresh();
    listTemplates().then((all) =>
      setTemplates(all.filter((t) => t.type === "birthday" || t.type === "reminder")),
    );
  }, []);

  async function handleSave(type: AutoDeliveryType, state: SectionState) {
    if (!state.templateId) return;
    setSaving(type);
    await upsertAutoDeliverySetting({
      type,
      channelMode: state.channelMode,
      sendTiming: state.sendTiming,
      templateId: state.templateId,
      isActive: state.isActive,
    });
    setSaving(null);
    refresh();
  }

  function renderSection(
    type: AutoDeliveryType,
    state: SectionState,
    setState: (s: SectionState) => void,
    timingPlaceholder: string,
  ) {
    const relevantTemplates = templates.filter((t) => t.type === type);
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-0 p-4">
        <h2 className="text-sm font-medium text-neutral-600">{TYPE_LABEL[type]}</h2>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={state.isActive}
            onChange={(e) => setState({ ...state, isActive: e.target.checked })}
          />
          有効にする
        </label>
        <select
          value={state.channelMode}
          onChange={(e) => setState({ ...state, channelMode: e.target.value as ChannelMode })}
          className="h-10 rounded-md border border-neutral-300 px-2"
        >
          <option value="auto">両方（自動振り分け）</option>
          <option value="email">メール</option>
          <option value="line">LINE</option>
        </select>
        <input
          type="text"
          placeholder={timingPlaceholder}
          value={state.sendTiming}
          onChange={(e) => setState({ ...state, sendTiming: e.target.value })}
          className="h-10 rounded-md border border-neutral-300 px-2"
        />
        <select
          value={state.templateId ?? ""}
          onChange={(e) =>
            setState({ ...state, templateId: e.target.value ? Number(e.target.value) : null })
          }
          className="h-10 rounded-md border border-neutral-300 px-2"
        >
          <option value="">テンプレートを選択</option>
          {relevantTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onNavigateToTemplates}
          className="text-left text-sm text-primary-600 underline"
        >
          ＋新しいテンプレートを作成する
        </button>
        <button
          type="button"
          disabled={saving === type || !state.templateId}
          onClick={() => handleSave(type, state)}
          className="h-10 w-32 rounded-lg bg-primary-500 font-medium text-white disabled:opacity-50"
        >
          保存する
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-neutral-500">
        実際の送信はCronジョブ（A-13）による定期実行が必要です。ここでは設定の保存のみ行います。
      </p>
      {renderSection("birthday", birthday, setBirthday, "例：month_start")}
      {renderSection("reminder", reminder, setReminder, "例：18:00_day_before")}
      {settings.length === 0 && (
        <p className="text-sm text-neutral-500">
          まだ設定がありません。テンプレートを選択して保存してください。
        </p>
      )}
    </div>
  );
}
