# Deploying PharmaBharat

The repository holds three things:

| Folder | What it is | Where it runs |
|---|---|---|
| `web/` | the Next.js app — everything the user sees | Vercel (or Render) |
| `realtime/` | Socket.io broadcaster for chat | Render free tier (optional) |
| `docs/` | the SRS and this guide | — |

`web/` is the only part that has to be deployed for the product to work. Without
`realtime/`, chat falls back to polling and everything else is unaffected.

---

## 0. Before you start

**Licence check.** Vercel's **Hobby plan is for non-commercial use only**. This is
a build for a paying client, so one of these has to be true before it is used
commercially:

- the client moves the project to **Vercel Pro** (about $20/month), or
- it is hosted on **Render** instead (their free and paid tiers allow commercial
  use), or
- the Vercel deployment stays a **demo / evaluation** deployment and the real one
  goes elsewhere.

Deploying to Hobby to show the client and to defend the capstone is fine. Taking
real orders on it is not.

---

## 1. GitHub

```bash
git remote add origin https://github.com/<you>/pharmabharat.git
git push -u origin main
```

Keep the repository **private**. It contains a client's product, and the commit
history is the record of how it was built.

No secrets are in the repository — `web/.env.local` and `realtime/.env` are
ignored, and the history has been checked. Only `.env.example` files, which hold
placeholders, are committed.

---

## 2. Vercel

### 2.1 Import

1. vercel.com → **Add New… → Project → Import Git Repository**.
2. Pick the repository.
3. **Root Directory: `web`** — this matters. The repository root is not the app,
   and the build fails without it.
4. Framework preset detects **Next.js**. Leave the build and output settings alone.

### 2.2 Environment variables

Add every one of these under **Settings → Environment Variables** (Production,
and Preview if you want preview deployments to work). The values are the ones in
your local `web/.env.local`, except where noted.

| Variable | Notes |
|---|---|
| `MONGODB_URI` | the Atlas connection string |
| `MONGODB_DB` | `pharmabharat` — the app reads this, not the database in the URI |
| `BETTER_AUTH_SECRET` | same long random string; changing it signs everyone out |
| `BETTER_AUTH_URL` | **the deployed URL**, e.g. `https://pharmabharat.vercel.app` — not localhost. On Vercel the app falls back to the project's production domain if this is unset, but set it explicitly once you have a custom domain |
| `GOOGLE_CLIENT_ID` | |
| `GOOGLE_CLIENT_SECRET` | |
| `ADMIN_EMAILS` | comma-separated; these accounts become platform admins on sign-in |
| `CLOUDINARY_CLOUD_NAME` | |
| `CLOUDINARY_API_KEY` | |
| `CLOUDINARY_API_SECRET` | |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Gmail app password, not the real password |
| `CRON_SECRET` | any long random string — see §2.5 |
| `REALTIME_URL`, `REALTIME_SECRET` | only if `realtime/` is deployed; leave unset for polling |
| `SUPPORT_EMAIL` | optional, shown on `/help` |

`BETTER_AUTH_URL` is a chicken-and-egg: you do not know the URL until the first
deploy. Deploy once, copy the URL, set the variable, then **redeploy** (a
redeploy is required — environment variables are read at build and run time).

**If sign-in sends people to localhost, this is why.** better-auth builds the
Google callback URL out of `BETTER_AUTH_URL`. When it is unset the app now falls
back to Vercel's own domain for the deployment rather than to localhost, so the
old silent failure is gone — but a custom domain still needs the variable set,
and either way the exact URL has to be registered with Google in §2.3.

### 2.3 Google sign-in

Sign-in fails until Google knows the new domain. In
**console.cloud.google.com → APIs & Services → Credentials → your OAuth client**:

- **Authorised JavaScript origins:** `https://<your-domain>`
- **Authorised redirect URIs:** `https://<your-domain>/api/auth/callback/google`

Keep the localhost entries so local development still works. Changes can take a
few minutes to take effect.

### 2.4 MongoDB Atlas

Vercel's functions do not have fixed IP addresses, so in
**Atlas → Network Access** add `0.0.0.0/0` (allow from anywhere). The database is
still protected by its username and password.

If that is too open for the client's comfort, the alternative is a paid Atlas
tier with a private endpoint — not available on the free M0.

### 2.5 The daily jobs

`web/vercel.json` already schedules them:

```json
{ "crons": [{ "path": "/api/cron/daily", "schedule": "30 3 * * *" }] }
```

03:30 UTC is 09:00 IST. Vercel sends `Authorization: Bearer $CRON_SECRET`
automatically **when a `CRON_SECRET` environment variable exists**, which is
exactly what `/api/cron/daily` checks — so setting the variable is all that is
needed.

That one run does: near-expiry alerts for sellers, overdue payment reminders,
drug-licence warnings and suspensions, and all the shop housekeeping (reorder
levels, expiry and low-stock alerts, refill reminders, loyalty expiry, DPDP
retention purge).

Two limits to know:

- Vercel's **Hobby plan allows one cron job, daily** — which is what this is.
- A function is capped at **60 seconds**. The job loops over every business, so
  it will outgrow that eventually. When it does, split it into separate cron
  paths (one per job) rather than making it faster.

### 2.6 Check it

1. Open the URL; the landing page should render in English, Hindi and Marathi.
2. Sign in with Google (this proves §2.3, the database, and the session cookie).
3. Complete onboarding for a test business.
4. `/app/catalog` — search proves Atlas Search is reachable from Vercel.
5. Trigger the cron by hand:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://<your-domain>/api/cron/daily
```

It should return `{"ok":true,...}`. A 401 means the secret does not match.

---

## 3. The realtime service (optional)

`render.yaml` at the repository root describes it. On Render: **New → Blueprint**,
point it at the repository, and set `REALTIME_SECRET` (the same value as the web
app) and `APP_ORIGIN` (the Vercel URL). Then set `REALTIME_URL` and
`REALTIME_SECRET` on Vercel and redeploy.

Render's free tier sleeps when idle, so the first chat message after a quiet
period takes a few seconds. The client falls back to polling, so nothing breaks.

---

## 4. If you host on Render instead

The app runs anywhere Node does; nothing is Vercel-specific except the cron
entry in `vercel.json`.

1. **New → Web Service**, root directory `web`, build `npm install && npm run build`,
   start `npm start`.
2. Add the same environment variables.
3. Replace the Vercel cron with Render's **Cron Job** service type, or a free
   external scheduler such as cron-job.org, calling:
   `GET https://<your-domain>/api/cron/daily` with the
   `Authorization: Bearer <CRON_SECRET>` header.

---

## 5. Production data

The database is shared between local development and production unless you point
them at different `MONGODB_DB` values. Before the client sees it:

- decide whether the demo businesses (`scripts/seed-demo.mts`) should exist there;
- if the shop module already holds real stock, run
  `node scripts/migrate-shop-units.mts --apply` once (see SRS §3.10);
- remember the medicine master is a Kaggle dataset — fine for development and the
  capstone, but its licence needs checking before commercial launch.
