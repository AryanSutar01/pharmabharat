# PharmaBharat

B2B pharma marketplace for medical stores, distributors and pharma companies.
Requirements and scope: [docs/SRS.md](docs/SRS.md).

```
web/            Next.js 16 app (UI + API + server actions)
realtime/       Socket.io broadcaster for live chat (stateless, no DB)
docs/SRS.md     Requirements, decisions, build plan
```

## Local setup

1. **Node 20+** (tested on Node 26).
2. `cd web && npm install`
3. `cp .env.example .env.local`, then fill it in:
   - **MongoDB Atlas (free M0):** create a cluster, add a database user, allow your IP, and copy the connection string. Put `/pharmabharat` before the `?` in the URI.
   - **Google OAuth:** Google Cloud Console → APIs & Services → Credentials → *OAuth client ID* (Web). Authorised redirect URI: `http://localhost:3000/api/auth/callback/google`.
   - **BETTER_AUTH_SECRET:** `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
   - **ADMIN_EMAILS:** your Google email. It becomes a platform admin the **first** time that account signs in.
   - **Cloudinary:** cloud name, API key and secret from the dashboard. Then Settings → Security → turn on *"Allow delivery of PDF and ZIP files"*.
   - **SMTP (optional):** a Gmail address and an [App password](https://myaccount.google.com/apppasswords). Without it, emails are printed to the server console.
4. `npm run dev` → http://localhost:3000
5. *(Optional, for live chat)* `cd ../realtime && npm install && cp .env.example .env`. Put the same `REALTIME_SECRET` in both `.env` files, set `REALTIME_URL=http://localhost:4000` in `web/.env.local`, then `npm run dev`. Without it, chat still works by polling every 15 s.

## Scripts (in `web/`)

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run typecheck` | Generate route types and run `tsc` |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests (offline) |
| `npm run test:integration` | Order/checkout tests against a throwaway `pharmabharat_test` database on your cluster |
| `npm run build` | Production build |
| `npm run import:medicines` | Import the medicine master from `web/.data/indian_medicine_data.csv` and create the Atlas Search index (re-runnable) |
| `npm run seed:demo` | Add two `[DEMO]` distributors with sample listings (`-- --remove` to delete) |

## Daily jobs

`/api/cron/daily` sends near-expiry alerts. Set `CRON_SECRET` in the environment, then either:
- **Vercel:** `web/vercel.json` already schedules it daily (09:00 IST); Vercel sends the secret automatically.
- **Render / elsewhere:** create a free daily job on cron-job.org that calls `GET https://<your-app>/api/cron/daily` with header `Authorization: Bearer <CRON_SECRET>`.

## Deploying the realtime service (Render, free)

1. Render dashboard → **New → Blueprint** → select this repo (it reads `render.yaml`).
2. Set `REALTIME_SECRET` (same as the web app's) and `APP_ORIGIN` (your web app URL).
3. In the web app's environment, set `REALTIME_URL` to the Render URL (e.g. `https://pharmabharat-realtime.onrender.com`).

The free instance sleeps after ~15 minutes idle. The first connection then takes about 30–50 s, and chat polls in the meantime.

