import { prisma } from "@/lib/db";
import { verifyPassword } from "./password";

export interface AuthorizedMember {
  id: string;
  email: string;
  name: string;
  role: "member";
}

export async function authorizeMember(credentials: {
  email: string;
  password: string;
}): Promise<AuthorizedMember | null> {
  const member = await prisma.member.findUnique({
    where: { email: credentials.email },
  });

  if (!member || !member.passwordHash) {
    return null;
  }

  const isValid = await verifyPassword(credentials.password, member.passwordHash);
  if (!isValid) {
    return null;
  }

  return {
    id: String(member.id),
    email: member.email,
    name: member.name,
    role: "member",
  };
}
