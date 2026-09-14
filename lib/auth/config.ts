import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import LineProvider from "next-auth/providers/line";
import { authorizeMember } from "./member-credentials";
import { authorizeAdmin } from "./admin-credentials";
import { findOrFlagLineMember, linkLineToMember } from "./line-member";
import { prisma } from "@/lib/db";
import type { AdminRole } from "@prisma/client";

const ADMIN_ROLES = new Set<AdminRole>(["hq", "manager", "staff"]);

function isAdminRole(role: string): role is AdminRole {
  return ADMIN_ROLES.has(role as AdminRole);
}

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      id: "member-credentials",
      name: "会員ログイン",
      credentials: {
        email: { label: "メールアドレス", type: "email" },
        password: { label: "パスワード", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        return authorizeMember({
          email: credentials.email as string,
          password: credentials.password as string,
        });
      },
    }),
    Credentials({
      id: "admin-credentials",
      name: "管理者ログイン",
      credentials: {
        email: { label: "メールアドレス", type: "email" },
        password: { label: "パスワード", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        return authorizeAdmin({
          email: credentials.email as string,
          password: credentials.password as string,
        });
      },
    }),
    LineProvider({
      clientId: process.env.LINE_CLIENT_ID!,
      clientSecret: process.env.LINE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: string }).role;

        if (isAdminRole(token.role as string)) {
          const permissions = await prisma.rolePagePermission.findMany({
            where: { role: token.role as AdminRole },
          });
          token.hiddenPageKeys = permissions
            .filter((p) => p.level === "hidden")
            .map((p) => p.pageKey);
          token.viewOnlyPageKeys = permissions
            .filter((p) => p.level === "view")
            .map((p) => p.pageKey);
        } else {
          token.hiddenPageKeys = [];
          token.viewOnlyPageKeys = [];
        }
      }

      if (account?.provider === "line" && account.providerAccountId) {
        if (token.role === "member" && token.id) {
          // 既にメール/パスワードでログイン中の会員が「LINEと連携」した場合は、
          // 新規ログイン/会員登録ではなく、今ログイン中の会員へのLINEアカウント
          // 紐付けとして扱う（token.id/roleは変更せず、そのまま同じ会員でいる）。
          await linkLineToMember(Number(token.id), account.providerAccountId);
        } else {
          const result = await findOrFlagLineMember(
            account.providerAccountId,
            (profile as { name?: string } | undefined)?.name ?? "",
          );

          if (result.status === "existing") {
            token.id = result.id;
            token.role = "member";
            token.needsProfileCompletion = false;
          } else {
            token.needsProfileCompletion = true;
            token.pendingLineUserId = result.lineUserId;
            token.pendingLineName = result.name;
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = (token.id as string) ?? "";
      session.user.role = (token.role as string) ?? "";
      session.needsProfileCompletion = token.needsProfileCompletion as boolean | undefined;
      session.pendingLineUserId = token.pendingLineUserId as string | undefined;
      session.pendingLineName = token.pendingLineName as string | undefined;
      session.hiddenPageKeys = (token.hiddenPageKeys as string[] | undefined) ?? [];
      session.viewOnlyPageKeys = (token.viewOnlyPageKeys as string[] | undefined) ?? [];
      return session;
    },
  },
};
