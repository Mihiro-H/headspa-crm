import Link from "next/link";

const NAV_ITEMS = [
  { href: "/reserve", label: "予約する" },
  { href: "/mypage", label: "マイページ" },
  { href: "/mypage/history", label: "来店履歴" },
  { href: "/mypage/profile", label: "設定" },
];

export default function MypageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col pb-20">
      <main className="flex-1 p-4">{children}</main>
      <nav className="fixed bottom-0 left-1/2 flex w-full max-w-md -translate-x-1/2 border-t border-neutral-200 bg-neutral-0">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 py-3 text-center text-xs text-neutral-600 hover:text-primary-600"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
