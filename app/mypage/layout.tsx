"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Home, Clock, Settings } from "lucide-react";

// お知らせ機能（A-09/A-10）は未実装のため遷移先が存在せず、ナビには含めない。
const NAV_ITEMS = [
  { href: "/reserve", label: "予約", icon: Calendar },
  { href: "/mypage", label: "マイページ", icon: Home },
  { href: "/mypage/history", label: "来店履歴", icon: Clock },
  { href: "/mypage/profile", label: "設定", icon: Settings },
];

export default function MypageLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex w-full min-h-dvh max-w-md flex-col pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <main className="flex-1 p-4">{children}</main>
      {/*
        min-h-screen(=100vh)はモバイルブラウザのアドレスバー分の高さ変動を
        考慮できず、fixed要素がツールバーの裏に隠れる/ビューポート外に
        押し出されることがあるためmin-h-dvhを使用。
        navにもsafe-area-inset-bottom分の余白とz-indexを明示し、
        ホームインジケーターとの重なりや他要素による被覆を防ぐ。
      */}
      <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t border-neutral-200 bg-neutral-0 pb-[env(safe-area-inset-bottom)]">
        <div className="flex">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs ${
                  isActive ? "text-primary-600" : "text-neutral-400"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 1.75} />
                <span className={isActive ? "font-medium" : undefined}>{item.label}</span>
                <span
                  className={`h-1 w-1 rounded-full ${isActive ? "bg-primary-600" : "bg-transparent"}`}
                />
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
