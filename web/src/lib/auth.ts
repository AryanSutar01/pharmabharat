import "server-only";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { ObjectId } from "mongodb";
import { adminEmails, env } from "@/lib/env";
import { mongoClient } from "@/lib/db/mongo";

/**
 * Platform-level role. Business-level roles (owner, manager, ...) live on
 * Membership documents instead, because one user can belong to several
 * businesses with a different role in each.
 */
export const PLATFORM_ROLES = ["user", "support", "admin"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

function createAuth() {
  const e = env();
  const client = mongoClient();
  return betterAuth({
    baseURL: e.BETTER_AUTH_URL,
    secret: e.BETTER_AUTH_SECRET,
    database: mongodbAdapter(client.db(), { client }),
    socialProviders: {
      google: {
        clientId: e.GOOGLE_CLIENT_ID,
        clientSecret: e.GOOGLE_CLIENT_SECRET,
        prompt: "select_account",
      },
    },
    user: {
      additionalFields: {
        platformRole: { type: "string", defaultValue: "user", input: false },
        banned: { type: "boolean", defaultValue: false, input: false },
      },
    },
    session: {
      // Short-lived signed cookie cache avoids a DB hit on every request.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const role: PlatformRole = adminEmails().has(user.email.toLowerCase()) ? "admin" : "user";
            return { data: { ...user, platformRole: role } };
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            const u = await client
              .db()
              .collection("user")
              .findOne({ _id: toObjectId(session.userId) }, { projection: { banned: 1 } });
            if (u?.banned) return false;
            return { data: session };
          },
        },
      },
    },
    plugins: [nextCookies()],
  });
}

function toObjectId(id: string) {
  // better-auth stores ids as ObjectId in Mongo.
  return ObjectId.isValid(id) ? new ObjectId(id) : (id as unknown as ObjectId);
}

type Auth = ReturnType<typeof createAuth>;
const g = globalThis as unknown as { _auth?: Auth };

/** Lazily built so importing this module during `next build` needs no secrets. */
export function auth(): Auth {
  g._auth ??= createAuth();
  return g._auth;
}

export type Session = Auth["$Infer"]["Session"];
