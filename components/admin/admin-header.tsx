"use client";

import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/admin/notification-bell";

const PAGE_TITLES: Record<string, string> = {
  "/admin/dashboard": "ダッシュボード",
  "/admin/calendar": "予約カレンダー",
  "/admin/customers": "顧客管理",
  "/admin/customer-statuses": "ステータス設定",
  "/admin/reservations/new": "電話予約登録",
  "/admin/menu": "メニュー・料金管理",
  "/admin/campaigns": "キャンペーン管理",
  "/admin/staff": "スタッフ管理",
  "/admin/stores": "店舗管理",
  "/admin/reports": "売上・月報レポート",
  "/admin/segment-campaigns": "メール／LINE配信管理",
  "/admin/cron-logs": "Cronジョブ実行ログ",
};

function resolvePageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) {
    return PAGE_TITLES[pathname];
  }
  if (pathname.startsWith("/admin/customers/")) {
    return "顧客詳細";
  }
  if (pathname.startsWith("/admin/reservations/")) {
    return "予約詳細";
  }
  return "";
}

export function AdminHeader() {
  const pathname = usePathname();
  const title = resolvePageTitle(pathname);

  return (
    <header className="flex items-center justify-between border-b border-neutral-200 bg-neutral-0 px-6 py-3">
      <h1 className="font-heading text-lg text-primary-700">{title}</h1>
      <NotificationBell />
    </header>
  );
}
