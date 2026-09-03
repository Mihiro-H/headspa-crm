import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="rounded-lg bg-neutral-0 p-6 shadow-md">
        <h1 className="font-heading text-2xl text-primary-700">フォレスパ</h1>
        <p className="mt-2 text-sm text-neutral-600">会員管理・予約システム seedページ</p>
        <Button className="mt-4 h-12 w-full rounded-lg bg-accent-500 text-white hover:bg-accent-600">
          予約する
        </Button>
      </div>
    </main>
  );
}
