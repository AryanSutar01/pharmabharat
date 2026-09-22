import "server-only";
import { z } from "zod";

const schema = z.object({
  BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 chars"),
  MONGODB_URI: z.string().startsWith("mongodb"),
  // Explicit so a URI without a /dbname path doesn't silently write to "test".
  MONGODB_DB: z.string().min(1).default("pharmabharat"),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  ADMIN_EMAILS: z.string().default(""),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  // Shared secret for /api/cron/* (sent as "Authorization: Bearer <secret>").
  CRON_SECRET: z.string().min(16).optional(),
  // Realtime chat service (optional: without it chat falls back to polling).
  REALTIME_URL: z.url().optional(),
  REALTIME_SECRET: z.string().min(16).optional(),
  MAIL_FROM: z.string().default("PharmaBharat <no-reply@pharmabharat.local>"),
});

type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Validated server env. Parsed lazily so `next build` works without secrets. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment variables:\n${issues}\nSee .env.example`);
  }
  cached = parsed.data;
  return cached;
}

export function adminEmails(): Set<string> {
  return new Set(
    env()
      .ADMIN_EMAILS.split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}
