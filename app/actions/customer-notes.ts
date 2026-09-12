"use server";

import { prisma } from "@/lib/db";

export interface CustomerNoteDetail {
  id: number;
  noteText: string;
  createdAt: string;
}

/**
 * カルテ・メモは会員1名につき常に最新の1件のみを編集対象とする
 * （複数スタッフの履歴を積み上げるログではなく、単一の自由記述欄として扱う）。
 */
export async function getCustomerNote(memberId: number): Promise<CustomerNoteDetail | null> {
  const note = await prisma.customerNote.findFirst({
    where: { memberId },
    orderBy: { createdAt: "desc" },
  });
  if (!note) return null;

  return {
    id: note.id,
    noteText: note.noteText,
    createdAt: note.createdAt.toISOString(),
  };
}

export async function saveCustomerNote(memberId: number, noteText: string): Promise<void> {
  const existing = await prisma.customerNote.findFirst({
    where: { memberId },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    await prisma.customerNote.update({ where: { id: existing.id }, data: { noteText } });
  } else {
    await prisma.customerNote.create({ data: { memberId, noteText } });
  }
}
