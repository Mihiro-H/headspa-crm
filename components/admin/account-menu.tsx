"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import type { AdminRole } from "@prisma/client";
import { getCurrentAdminInfo, type CurrentAdminInfo } from "@/app/actions/current-admin-info";

const ROLE_LABEL: Record<AdminRole, string> = {
  hq: "本部",
  manager: "店長",
  staff: "スタッフ",
};

function storeLabel(info: CurrentAdminInfo): string {
  if (info.role === "hq") return "全店舗";
  return info.storeNames.join("、") || "—";
}

export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<CurrentAdminInfo | null>(null);

  useEffect(() => {
    getCurrentAdminInfo().then(setInfo);
  }, []);

  // セッションが取得できるまで、あるいはAdmin行が見つからない異常系では何も表示しない
  // （通知ベルと違いバッジ等が無く、空表示でも違和感がないため単純にnullを返す）
  if (!info) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="アカウントメニュー"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-700 hover:bg-primary-200"
      >
        {info.name.charAt(0)}
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-64 rounded-lg border border-neutral-200 bg-neutral-0 shadow-lg">
          <div className="border-b border-neutral-100 p-3">
            <p className="text-sm font-medium text-neutral-800">{info.name}</p>
            <p className="mt-1 text-xs text-neutral-500">{storeLabel(info)}</p>
            <p className="text-xs text-neutral-500">{ROLE_LABEL[info.role]}</p>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="block w-full p-3 text-left text-sm text-error hover:bg-neutral-50"
          >
            ログアウト
          </button>
        </div>
      )}
    </div>
  );
}
