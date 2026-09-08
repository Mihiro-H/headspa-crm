"use client";

import { useState } from "react";

export interface TabItem {
  key: string;
  label: string;
  content: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeKey?: string;
  defaultTabKey?: string;
  onActiveKeyChange?: (key: string) => void;
}

export function Tabs({ tabs, activeKey, defaultTabKey, onActiveKeyChange }: TabsProps) {
  const [internalKey, setInternalKey] = useState(defaultTabKey ?? tabs[0]?.key);
  const currentKey = activeKey ?? internalKey;

  function selectKey(key: string) {
    setInternalKey(key);
    onActiveKeyChange?.(key);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-neutral-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => selectKey(tab.key)}
            aria-current={currentKey === tab.key ? "page" : undefined}
            className={`px-4 py-2 text-sm ${
              currentKey === tab.key
                ? "border-b-2 border-primary-500 font-medium text-primary-700"
                : "text-neutral-500"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.find((tab) => tab.key === currentKey)?.content}
    </div>
  );
}
