import "server-only";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { ObjectId } from "mongodb";
import { adminEmails, env } from "@/lib/env";
import { mongoClient, mongoDb } from "@/lib/db/mongo";

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
    database: mongodbAdapter(mongoDb(), { client }),
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
      // No cookie cache: role changes, bans and the ADMIN_EMAILS promotion must
      // take effect on the very next request (a cached cookie kept the old role
      // for up to 5 minutes). Costs one indexed DB lookup per request.
      cookieCache: { enabled: false },
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
            const users = mongoDb().collection("user");
            const _id = toObjectId(session.userId);
            const u = await users.findOne({ _id }, { projection: { banned: 1, email: 1, platformRole: 1 } });
            if (u?.banned) return false;
            // Re-checked on every sign-in so adding an email to ADMIN_EMAILS later
            // promotes an existing account. Only promotes; demotion is a manual action.
            if (u && u.platformRole !== "admin" && adminEmails().has(String(u.email).toLowerCase())) {
              await users.updateOne({ _id }, { $set: { platformRole: "admin" } });
            }
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
