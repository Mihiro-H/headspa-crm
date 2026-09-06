import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Tag,
  PhoneCall,
  ListChecks,
  Percent,
  UserCog,
  Store,
  ChartColumn,
  Send,
  Repeat,
  FileText,
  Terminal,
} from "lucide-react";
import { NotificationBell } from "@/components/admin/notification-bell";

const NAV_ICON_SIZE = 16;

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/admin/calendar", label: "予約カレンダー", icon: CalendarDays },
  { href: "/admin/customers", label: "顧客管理", icon: Users },
  { href: "/admin/customer-statuses", label: "ステータス設定", icon: Tag },
  { href: "/admin/reservations/new", label: "電話予約登録", icon: PhoneCall },
  { href: "/admin/menu", label: "メニュー・料金管理", icon: ListChecks },
  { href: "/admin/campaigns", label: "キャンペーン管理", icon: Percent },
  { href: "/admin/staff", label: "スタッフ管理", icon: UserCog },
  { href: "/admin/stores", label: "店舗管理", icon: Store },
  { href: "/admin/reports", label: "売上・月報レポート", icon: ChartColumn },
  { href: "/admin/segment-campaigns", label: "メール／LINE配信管理", icon: Send },
  { href: "/admin/auto-delivery", label: "自動配信設定", icon: Repeat },
  { href: "/admin/templates", label: "配信テンプレート管理", icon: FileText },
  { href: "/admin/cron-logs", label: "Cronジョブ実行ログ", icon: Terminal },
] as const;

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-neutral-200 bg-neutral-0 p-4">
        <h1>
          <Image
            src="/logo/foresupa_logo_transparent.png"
            alt="フォレスパ"
            width={204}
            height={72}
            className="h-auto w-40"
            priority
          />
        </h1>
        <nav className="mt-6 flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
            >
              <Icon size={NAV_ICON_SIZE} className="shrink-0 text-neutral-500" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-neutral-200 bg-neutral-0 px-6 py-3">
          <NotificationBell />
        </header>
        <main className="flex-1 bg-neutral-50 p-6">{children}</main>
      </div>
    </div>
  );
}
