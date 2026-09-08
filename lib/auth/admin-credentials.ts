import { prisma } from "@/lib/db";
import { verifyPassword } from "./password";

export interface AuthorizedAdmin {
  id: string;
  email: string;
  name: string;
  role: "hq" | "manager" | "staff";
  storeIds: number[];
}

export async function authorizeAdmin(credentials: {
  email: string;
  password: string;
}): Promise<AuthorizedAdmin | null> {
  const admin = await prisma.admin.findUnique({
    where: { email: credentials.email },
    include: { stores: true },
  });

  if (!admin) {
    return null;
  }

  if (!admin.isActive) {
    return null;
  }

  // 招待メール送信済みだがまだパスワードを設定していない管理者はログイン不可。
  if (!admin.passwordHash) {
    return null;
  }

  const isValid = await verifyPassword(credentials.password, admin.passwordHash);
  if (!isValid) {
    return null;
  }

  return {
    id: String(admin.id),
    email: admin.email,
    name: admin.name,
    role: admin.role,
    storeIds: admin.stores.map((s) => s.storeId),
  };
}
