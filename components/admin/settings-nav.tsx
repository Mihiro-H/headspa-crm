"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, ChevronDown, ChevronRight, Terminal, UserCog, ShieldCheck, FileText } from "lucide-react";

const NAV_ICON_SIZE = 16;

const SETTINGS_NAV_ITEMS = [
  { href: "/admin/cron-logs", label: "Cronジョブ実行ログ", icon: Terminal },
  { href: "/admin/accounts", label: "アカウント管理", icon: UserCog },
  { href: "/admin/permissions", label: "権限設定", icon: ShieldCheck },
  { href: "/admin/terms", label: "利用規約設定", icon: FileText },
] as const;

export function SettingsNav() {
  const pathname = usePathname();
  const isInSettings = SETTINGS_NAV_ITEMS.some((item) => pathname.startsWith(item.href));
  const [open, setOpen] = useState(isInSettings);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
      >
        <Settings size={NAV_ICON_SIZE} className="shrink-0 text-neutral-500" />
        設定
        {open ? (
          <ChevronDown size={14} className="ml-auto text-neutral-400" />
        ) : (
          <ChevronRight size={14} className="ml-auto text-neutral-400" />
        )}
      </button>
      {open && (
        <div className="ml-4 flex flex-col gap-1 border-l border-neutral-200 pl-2">
          {SETTINGS_NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
            >
              <Icon size={NAV_ICON_SIZE} className="shrink-0 text-neutral-500" />
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
