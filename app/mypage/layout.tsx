"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Clock, Bell, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/mypage", label: "ホーム", icon: Home },
  { href: "/mypage/history", label: "来店履歴", icon: Clock },
  { href: "/mypage/notifications", label: "お知らせ", icon: Bell },
  { href: "/mypage/profile", label: "設定", icon: Settings },
];

export default function MypageLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex w-full min-h-dvh max-w-md flex-col pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {/*
        固定ヘッダー。ロゴのみを左揃えで表示する。
        pt-[env(safe-area-inset-top)]でノッチ等との重なりを避ける。
      */}
      <header className="fixed top-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-b border-neutral-200 bg-neutral-0 px-4 pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center">
          <Image
            src="/logo/foresupa_logo_tight.png"
            alt="フォレスパ"
            width={1206}
            height={600}
            className="h-auto w-28"
            priority
          />
        </div>
      </header>

      <main className="flex-1 p-4 pt-[calc(3.5rem+env(safe-area-inset-top)+1rem)]">
        {children}
      </main>

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
