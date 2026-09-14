"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export type DeliveryTemplateType = "birthday" | "reminder" | "segment" | "confirmation";

// Server Actionはページのミドルウェアガードに関わらず直接呼び出せるため、
// 管理者向けアクションは必ずそれぞれの関数内でセッションを検証する。
const ADMIN_ROLES = new Set(["hq", "manager", "staff"]);

export interface TemplateListItem {
  id: number;
  type: DeliveryTemplateType;
  name: string;
  subject: string | null;
  bodyText: string;
}

export async function listTemplates(): Promise<TemplateListItem[]> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  const templates = await prisma.deliveryTemplate.findMany({ orderBy: { id: "desc" } });
  return templates.map((t) => ({
    id: t.id,
    type: t.type,
    name: t.name,
    subject: t.subject,
    bodyText: t.bodyText,
  }));
}

export interface CreateTemplateParams {
  type: DeliveryTemplateType;
  name: string;
  subject: string | null;
  bodyText: string;
}

export async function createTemplate(
  params: CreateTemplateParams,
): Promise<{ templateId: number }> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  const template = await prisma.deliveryTemplate.create({
    data: {
      type: params.type,
      name: params.name,
      subject: params.subject,
      bodyText: params.bodyText,
    },
  });
  return { templateId: template.id };
}

export interface UpdateTemplateParams {
  templateId: number;
  name: string;
  subject: string | null;
  bodyText: string;
}

export async function updateTemplate(params: UpdateTemplateParams): Promise<void> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  await prisma.deliveryTemplate.update({
    where: { id: params.templateId },
    data: { name: params.name, subject: params.subject, bodyText: params.bodyText },
  });
}

const TEMPLATE_PAGE_SIZE = 20;

export interface ListTemplatesPageResult {
  items: TemplateListItem[];
  totalCount: number;
}

export async function listTemplatesPage(page = 1): Promise<ListTemplatesPageResult> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  const [templates, totalCount] = await Promise.all([
    prisma.deliveryTemplate.findMany({
      orderBy: { id: "desc" },
      skip: (page - 1) * TEMPLATE_PAGE_SIZE,
      take: TEMPLATE_PAGE_SIZE,
    }),
    prisma.deliveryTemplate.count(),
  ]);

  const items = templates.map((t) => ({
    id: t.id,
    type: t.type,
    name: t.name,
    subject: t.subject,
    bodyText: t.bodyText,
  }));

  return { items, totalCount };
}
