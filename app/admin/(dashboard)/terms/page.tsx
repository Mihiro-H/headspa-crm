"use client";

import { useEffect, useState } from "react";
import { getTermsOfService, updateTermsOfService } from "@/app/actions/terms-of-service";

export default function AdminTermsPage() {
  const [bodyText, setBodyText] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTermsOfService().then(setBodyText);
  }, []);

  async function handleSave() {
    setSaving(true);
    setSavedMessage(null);
    setError(null);
    try {
      await updateTermsOfService(bodyText);
      setSavedMessage("保存しました。");
    } catch {
      setError("保存に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}
      <textarea
        value={bodyText}
        onChange={(e) => setBodyText(e.target.value)}
        rows={20}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />
      {savedMessage && (
        <p role="status" aria-live="polite" className="text-sm text-neutral-700">
          {savedMessage}
        </p>
      )}
      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="h-12 w-40 rounded-lg bg-primary-500 font-medium text-white disabled:opacity-50"
      >
        保存する
      </button>
    </div>
  );
}
