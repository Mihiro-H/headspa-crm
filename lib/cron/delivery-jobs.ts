import { prisma } from "@/lib/db";
import { runCronJob } from "./run-job";
import { sendToMemberAndLog } from "@/lib/delivery/send-to-member";
import { minutesToLabel, dbTimeToMinutes } from "@/lib/reservation/time";

export async function runReminderJob(now: Date = new Date()): Promise<void> {
  await runCronJob(
    "reminder",
    async () => {
      const setting = await prisma.autoDeliverySetting.findFirst({
        where: { type: "reminder", isActive: true },
        include: { template: true },
      });
      if (!setting) return { targetCount: 0 };

      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const tomorrowDateOnly = new Date(
        Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate()),
      );

      const reservations = await prisma.reservation.findMany({
        where: { status: "confirmed", reservationDate: tomorrowDateOnly },
        include: { member: true, store: true },
      });

      let count = 0;
      for (const r of reservations) {
        if (!r.member) continue;
        await sendToMemberAndLog({
          member: r.member,
          channelMode: setting.channelMode,
          template: setting.template,
          templateType: "reminder",
          tags: {
            氏名: r.member.name,
            店舗名: r.store.name,
            予約時刻: minutesToLabel(dbTimeToMinutes(r.startTime)),
          },
          now,
        });
        count++;
      }
      return { targetCount: count };
    },
    now,
  );
}

export async function runBirthdayJob(now: Date = new Date()): Promise<void> {
  await runCronJob(
    "birthday",
    async () => {
      const setting = await prisma.autoDeliverySetting.findFirst({
        where: { type: "birthday", isActive: true },
        include: { template: true },
      });
      if (!setting) return { targetCount: 0 };

      const currentMonth = now.getUTCMonth() + 1;
      const targets = await prisma.member.findMany({ where: { birthMonth: currentMonth } });

      let count = 0;
      for (const member of targets) {
        await sendToMemberAndLog({
          member,
          channelMode: setting.channelMode,
          template: setting.template,
          templateType: "birthday",
          tags: { 氏名: member.name },
          now,
        });
        count++;
      }
      return { targetCount: count };
    },
    now,
  );
}

export async function runReminderRecheckJob(now: Date = new Date()): Promise<void> {
  await runCronJob(
    "reminder_recheck",
    async () => {
      const setting = await prisma.autoDeliverySetting.findFirst({
        where: { type: "reminder", isActive: true },
        include: { template: true },
      });
      if (!setting) return { targetCount: 0 };

      const todayStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const failedLogs = await prisma.emailLineLog.findMany({
        where: { templateType: "reminder", status: "failed", sentAt: { gte: todayStart } },
        include: { member: true },
      });

      let count = 0;
      for (const log of failedLogs) {
        await sendToMemberAndLog({
          member: log.member,
          channelMode: setting.channelMode,
          template: setting.template,
          templateType: "reminder",
          tags: { 氏名: log.member.name },
          now,
        });
        count++;
      }
      return { targetCount: count };
    },
    now,
  );
}
