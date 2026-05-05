# F1 Esports League Manager - Prerequisites And Keys

Complete this list before starting S0.
Everything here is needed before the app can run locally or be deployed.

---

## 1. Accounts To Create

| Service | Purpose | URL | Free tier? |
|---------|---------|-----|------------|
| Supabase | Database, auth, storage | supabase.com | Yes |
| Vercel | App hosting and deploys | vercel.com | Yes |
| Upstash | Redis rate limiting | upstash.com | Yes |
| Sentry | Error monitoring | sentry.io | Yes |
| GitHub | Source control and CI | github.com | Yes |

> Discord is a stretch goal. You do not need a Discord account or webhook for MVP.

---

## 2. Local Developer Tools

Run `scripts/check-dev.ps1` to verify these are installed.

| Tool | Required? | How to get |
|------|----------|------------|
| Git | Required | `winget install --id Git.Git` |
| Node.js (LTS) | Required | `winget install --id OpenJS.NodeJS.LTS` |
| npm | Required | Included with Node.js |
| GitHub CLI | Recommended | `winget install --id GitHub.cli` |
| Vercel CLI | Recommended | `npm install -g vercel` |
| Supabase CLI | Recommended | `npm install -g supabase` |
| Docker Desktop | Recommended | `winget install --id Docker.DockerDesktop` (needed for local Supabase) |

After scaffolding the app (S0):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-dev.ps1 -InstallProjectDeps
powershell -ExecutionPolicy Bypass -File scripts/check-dev.ps1 -InstallPlaywright
```

---

## 3. Environment Variables

Create `.env.local` in the project root (never commit this file — it is gitignored).
Use `.env.example` as the template once S0 scaffolding is done.

### 3.1 Supabase

Go to your Supabase project → Settings → API.

| Variable | Where to find it | Scope |
|----------|-----------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | Public (browser-safe) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` key | Public (browser-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key | Server only — never expose |

> The service role key bypasses RLS. It must never appear in client code or be prefixed with `NEXT_PUBLIC_`.

### 3.2 Site

| Variable | Value | Scope |
|----------|-------|-------|
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally, your Vercel URL in production | Public |

### 3.3 CSRF

| Variable | How to generate | Scope |
|----------|----------------|-------|
| `CSRF_SECRET` | Run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` in terminal | Server only |

Generate a unique value for local and a separate unique value for production.

### 3.4 Upstash Redis

Go to your Upstash console → your Redis database → REST API section.

| Variable | Where to find it | Scope |
|----------|-----------------|-------|
| `UPSTASH_REDIS_REST_URL` | REST URL | Server only |
| `UPSTASH_REDIS_REST_TOKEN` | REST Token | Server only |

### 3.5 Sentry

Go to your Sentry project → Settings → Client Keys (DSN).

| Variable | Where to find it | Scope |
|----------|-----------------|-------|
| `SENTRY_DSN` | Project DSN | Mixed (public DSN is safe) |
| `SENTRY_AUTH_TOKEN` | Settings → Auth Tokens | Server/CI only |

### 3.6 Storage

| Variable | Value | Scope |
|----------|-------|-------|
| `SUPABASE_STORAGE_ASSET_BUCKET` | `league-assets` | Config |

You will create this bucket manually in the Supabase dashboard during S1.

### 3.7 Discord (Stretch Goal — Skip For MVP)

| Variable | Where to find it | Scope |
|----------|-----------------|-------|
| `DISCORD_WEBHOOK_URL` | Discord server → channel → Integrations → Webhooks | Server only |

---

## 4. Supabase Project Setup

After creating your Supabase account:

1. Create a new project. Note the region — choose the closest one to your users.
2. Save the database password somewhere safe. You will need it if you ever connect directly.
3. Enable Email Auth under Authentication → Providers.
4. Disable phone auth (not needed).
5. Under Storage, the `league-assets` and `team-assets` buckets will be created by the S1 migration scripts.
6. Enable Row Level Security — this will be done per-table in S1 migrations.

---

## 5. Vercel Project Setup

After creating your Vercel account:

1. Connect your GitHub repository.
2. Set the framework preset to Next.js.
3. Add all environment variables listed in Section 3 to the Vercel project settings.
4. Use separate values for Preview and Production environments.
5. The production Supabase project and local/dev Supabase project should be separate.

---

## 6. GitHub Repository And CI

1. Create a GitHub repository for the project.
2. Push the current planning docs.
3. The GitHub Actions CI workflow will be added during S0. It will need:
   - Repository secrets for `SUPABASE_SERVICE_ROLE_KEY`, `CSRF_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SENTRY_AUTH_TOKEN`.
   - Public env vars can be in the workflow file directly.

---

## 7. Keys Safety Checklist

Before writing any code, confirm:

- [ ] `.env.local` is listed in `.gitignore` (already done).
- [ ] The `service_role` key is never assigned to a variable prefixed with `NEXT_PUBLIC_`.
- [ ] The `CSRF_SECRET` is a random 32-byte hex string, not a word or phrase.
- [ ] Production secrets are different from local secrets.
- [ ] You have saved all secrets somewhere safe outside the repository (password manager recommended).

---

## 8. What You Need Before S1 Can Start

S0 (scaffolding) can begin with just local tools installed.

Before S1 (database and security), you need:

- [ ] Supabase project created.
- [ ] `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` ready.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` saved securely.
- [ ] `CSRF_SECRET` generated.
- [ ] Upstash Redis database created (can use free tier).
- [ ] `.env.local` created from `.env.example`.

Sentry and Vercel can be set up during S11 and S12 respectively, but earlier is fine.
