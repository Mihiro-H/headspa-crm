import Link from "next/link";

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-neutral-200 bg-neutral-0 p-4">
        <h1 className="font-heading text-lg text-primary-700">フォレスパ</h1>
        <nav className="mt-6 flex flex-col gap-1">
          <Link
            href="/admin/dashboard"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            ダッシュボード
          </Link>
          <Link
            href="/admin/calendar"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            予約カレンダー
          </Link>
          <Link
            href="/admin/customers"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            顧客管理
          </Link>
          <Link
            href="/admin/customer-statuses"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            ステータス設定
          </Link>
          <Link
            href="/admin/reservations/new"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            電話予約登録
          </Link>
          <Link
            href="/admin/menu"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            メニュー・料金管理
          </Link>
          <Link
            href="/admin/campaigns"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            キャンペーン管理
          </Link>
          <Link
            href="/admin/staff"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            スタッフ管理
          </Link>
          <Link
            href="/admin/stores"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            店舗管理
          </Link>
        </nav>
      </aside>
      <main className="flex-1 bg-neutral-50 p-6">{children}</main>
    </div>
  );
}
