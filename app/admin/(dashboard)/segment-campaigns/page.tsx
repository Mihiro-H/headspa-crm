"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/tabs";
import { SegmentSettingsTab } from "@/components/admin/segment-settings-tab";
import { AutoDeliveryTab } from "@/components/admin/auto-delivery-tab";
import { TemplatesTab } from "@/components/admin/templates-tab";

export default function SegmentCampaignsPage() {
  const [activeKey, setActiveKey] = useState("segment");

  return (
    <Tabs
      tabs={[
        {
          key: "segment",
          label: "セグメント配信設定",
          content: <SegmentSettingsTab onNavigateToTemplates={() => setActiveKey("templates")} />,
        },
        {
          key: "auto",
          label: "自動配信設定",
          content: <AutoDeliveryTab onNavigateToTemplates={() => setActiveKey("templates")} />,
        },
        { key: "templates", label: "テンプレート管理", content: <TemplatesTab /> },
      ]}
      activeKey={activeKey}
      onActiveKeyChange={setActiveKey}
    />
  );
}
