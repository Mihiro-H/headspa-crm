import { NextRequest, NextResponse } from "next/server";
import { runTempHoldReleaseJob, runNoShowDetectionJob } from "@/lib/cron/reservation-jobs";
import { runReminderJob, runBirthdayJob, runReminderRecheckJob } from "@/lib/cron/delivery-jobs";
import { runStatusUpdateJob, runMonthlyReportJob } from "@/lib/cron/reporting-jobs";

const JOB_HANDLERS: Record<string, () => Promise<void>> = {
  "temp-hold-release": () => runTempHoldReleaseJob(),
  "no-show-detection": () => runNoShowDetectionJob(),
  reminder: () => runReminderJob(),
  birthday: () => runBirthdayJob(),
  "reminder-recheck": () => runReminderRecheckJob(),
  "status-update": () => runStatusUpdateJob(),
  "monthly-report": () => runMonthlyReportJob(),
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobName: string }> },
) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { jobName } = await params;
  const handler = JOB_HANDLERS[jobName];
  if (!handler) {
    return NextResponse.json({ error: "unknown job" }, { status: 404 });
  }

  await handler();
  return NextResponse.json({ status: "ok" });
}
