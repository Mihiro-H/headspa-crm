import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: string;
    };
    needsProfileCompletion?: boolean;
    pendingLineUserId?: string;
    pendingLineName?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    needsProfileCompletion?: boolean;
    pendingLineUserId?: string;
    pendingLineName?: string;
  }
}
