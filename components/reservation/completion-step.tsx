interface CompletionStepProps {
  reservationId: number;
}

export function CompletionStep({ reservationId }: CompletionStepProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <h2 className="font-heading text-xl text-primary-700">ご予約が完了しました</h2>
      <p className="text-neutral-600">予約番号：{reservationId}</p>
      <p className="text-sm text-neutral-500">確認メールをお送りしましたのでご確認ください。</p>
      <a
        href="/mypage"
        className="mt-2 h-12 w-full max-w-xs rounded-lg bg-primary-500 px-4 py-3 text-center font-medium text-white"
      >
        マイページへ
      </a>
    </div>
  );
}
