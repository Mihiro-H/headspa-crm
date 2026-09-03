import { prisma } from "@/lib/db";
import { verifyPassword } from "./password";

export interface AuthorizedAdmin {
  id: string;
  email: string;
  name: string;
  role: "hq" | "manager" | "staff";
  storeId: number | null;
}

export async function authorizeAdmin(credentials: {
  email: string;
  password: string;
}): Promise<AuthorizedAdmin | null> {
  const admin = await prisma.admin.findUnique({
    where: { email: credentials.email },
  });

  if (!admin) {
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
    storeId: admin.storeId,
  };
}
