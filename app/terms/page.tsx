import { getTermsOfService } from "@/app/actions/terms-of-service";

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
