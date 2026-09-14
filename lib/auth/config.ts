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
      // 「LINEと連携」ボタンは、メール/パスワードで既にログイン中の会員セッションから
      // signIn("line", ...)を呼ぶことで実現している。このとき下のif(user)ブロックが
      // token.id/roleを今回のサインイン（LINE側のid・role未設定）の値で上書きして
      // しまうため、上書きされる前に「元々ログイン中だった会員か」を先に控えておく。
      const wasLoggedInAsMember = token.role === "member" && typeof token.id === "string";
      const previousMemberId = token.id as string | undefined;

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
        if (wasLoggedInAsMember && previousMemberId) {
          // 新規ログイン/会員登録ではなく、元々ログイン中だった会員へのLINEアカウント
          // 紐付けとして扱う。上のif(user)ブロックでtoken.id/roleがLINE側の値に
          // 上書きされてしまっているので、元の会員のセッションに戻す。
          await linkLineToMember(Number(previousMemberId), account.providerAccountId);
          token.id = previousMemberId;
          token.role = "member";
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
