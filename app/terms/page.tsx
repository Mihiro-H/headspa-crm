import { getTermsOfService } from "@/app/actions/terms-of-service";

// このページは認証済みセッションを読まないためNext.jsが静的にプリレンダリング
// できてしまうが、管理画面（/admin/terms）から内容を更新できる以上、
// ビルド時点の内容のまま固定表示されては困る。常にリクエスト時点の最新内容を
// 取得する。
export const dynamic = "force-dynamic";

export default async function TermsPage() {
  const bodyText = await getTermsOfService();

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-heading text-2xl text-primary-700">利用規約</h1>
      <pre className="mt-6 whitespace-pre-wrap font-sans text-sm text-neutral-700">
        {bodyText || "準備中です。"}
      </pre>
    </main>
  );
}
