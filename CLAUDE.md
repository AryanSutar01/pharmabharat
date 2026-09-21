# PharmaBharat — notes for Claude

Read `docs/SRS.md` for scope. App lives in `web/` (see `web/AGENTS.md`: Next.js 16 has breaking changes — check `web/node_modules/next/dist/docs/` before using an unfamiliar API; `middleware` is now `src/proxy.ts`).

## Conventions
- **Auth:** `better-auth` (Google only). Server code gets the user via `src/lib/session.ts`:
  `requireUser()`, `requirePlatformRole("admin")`, `requireBusiness({ permission })`. Every server action must call one of these first; the proxy is only an optimistic cookie check.
- **Permissions:** business roles → permissions in `src/lib/permissions.ts`. Never check role names directly in features; check a permission.
- **Data:** mongoose models in `src/lib/models/`, always `await connectDB()` first. better-auth's collections (`user`, `session`…) are read via the native driver (`src/lib/users.ts`).
- **Validation:** zod schemas in `src/lib/validation/`. Server actions return error *codes* (e.g. `"invalid_gstin"`); the UI translates them from the `errors` namespace via `useErrorText()`.
- **i18n:** every UI string goes into `web/messages/en.json`, `hi.json` **and** `mr.json` (a test enforces identical keys). Locale lives in the `NEXT_LOCALE` cookie; no locale in URLs.
- **UI:** primitives in `src/components/ui`. Mobile first; bottom nav under `lg`, sidebar at `lg+`. Keep inputs ≥16px on mobile (prevents iOS zoom).
- **Files:** KYC documents are Cloudinary `authenticated` assets, only served through `/api/kyc-documents/...` signed redirects.
- **Before committing:** `npm run typecheck && npm run lint && npm test && npm run build` in `web/`.
