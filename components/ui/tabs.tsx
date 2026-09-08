"use client";

import { useState } from "react";

export interface TabItem {
  key: string;
  label: string;
  content: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  defaultTabKey?: string;
}

export function Tabs({ tabs, defaultTabKey }: TabsProps) {
  const [activeKey, setActiveKey] = useState(defaultTabKey ?? tabs[0]?.key);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-neutral-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveKey(tab.key)}
            aria-current={activeKey === tab.key ? "page" : undefined}
            className={`px-4 py-2 text-sm ${
              activeKey === tab.key
                ? "border-b-2 border-primary-500 font-medium text-primary-700"
                : "text-neutral-500"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.find((tab) => tab.key === activeKey)?.content}
    </div>
  );
}
