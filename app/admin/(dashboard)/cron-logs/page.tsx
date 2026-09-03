"use client";

import { useEffect, useState } from "react";
import { listCronJobLogs, type CronJobLogItem } from "@/app/actions/cron-logs";

const JOB_LABEL: Record<string, string> = {
  temp_hold_release: "仮予約枠の自動解放",
  reminder: "前日リマインド送信",
  birthday: "誕生月メール送信",
  status_update: "顧客ステータス自動更新",
  monthly_report: "月報集計バッチ",
  reminder_recheck: "リマインド未読チェック（再送）",
  no_show_detection: "No-show自動検知",
};

export default function CronLogsPage() {
  const [logs, setLogs] = useState<CronJobLogItem[]>([]);

  useEffect(() => {
    listCronJobLogs().then(setLogs);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl text-primary-700">Cronジョブ実行ログ</h1>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="p-3">ジョブ</th>
              <th className="p-3">実行日時</th>
              <th className="p-3">結果</th>
              <th className="p-3">対象件数</th>
              <th className="p-3">エラー内容</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-neutral-100 last:border-0">
                <td className="p-3">{JOB_LABEL[l.jobName] ?? l.jobName}</td>
                <td className="p-3">{l.executedAt}</td>
                <td className="p-3">
                  <span
                    className={
                      l.status === "success"
                        ? "rounded-full bg-success/10 px-2 py-1 text-xs text-success"
                        : "rounded-full bg-error/10 px-2 py-1 text-xs text-error"
                    }
                  >
                    {l.status === "success" ? "成功" : "失敗"}
                  </span>
                </td>
                <td className="p-3">{l.targetCount}件</td>
                <td className="p-3 text-neutral-500">{l.errorMessage ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {logs.length === 0 && (
        <p className="text-sm text-neutral-500">
          まだ実行ログがありません。Vercel Cronの設定後、初回実行をお待ちください。
        </p>
      )}
    </div>
  );
}
