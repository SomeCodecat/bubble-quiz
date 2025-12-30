import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";

// Ensure Auth.js trusts the host header, even in Edge/Middleware contexts
process.env.AUTH_TRUST_HOST = "true";

const loginSchema = z.object({
  email: z.string().min(1), // Allow username or email
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db) as any,
  trustHost: true,
  session: { strategy: "jwt" }, // Use JWT for flexibility with credentials
  providers: [
    {
      id: "authentik",
      name: "Authentik",
      type: "oidc",
      issuer: process.env.AUTHENTIK_ISSUER,
      clientId: process.env.AUTHENTIK_CLIENT_ID,
      clientSecret: process.env.AUTHENTIK_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    },
    Credentials({
      credentials: {
        email: { label: "Email or Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        try {
          const { email, password } = await loginSchema.parseAsync(credentials);

          const user = await db.user.findFirst({
            where: {
              OR: [{ email: email }, { username: email }],
            },
          });

          if (!user) {
            return null;
          }

          if (!user.password) {
            return null;
          }

          const passwordsMatch = await bcrypt.compare(password, user.password);
          if (!passwordsMatch) {
            return null;
          }

          return {
            ...user,
            username: user.username ?? undefined,
          };
        } catch (e) {
          console.error("Authorize error:", e);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      // Initial sign-in
      if (user) {
        token.role = (user as any).role;
        token.username = (user as any).username;
        token.id = user.id; // Explicitly save ID
      }
      // Update session trigger (e.g. after setting username or image)
      if (trigger === "update") {
        if (session?.username) token.username = session.username;
        if (session?.image) token.picture = session.image;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        (session.user as any).username = token.username as string;
        // Ensure ID is populated
        session.user.id = (token.id as string) || (token.sub as string);
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // If the url is the homepage, redirect to /questions
      if (url === baseUrl || url === `${baseUrl}/`) {
        return `${baseUrl}/lobby`;
      }
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  events: {
    async createUser({ user }) {
      const count = await db.user.count();
      if (count === 1) {
        await db.user.update({
          where: { id: user.id },
          data: { role: "ADMIN" },
        });
      }
    },
  },
});
