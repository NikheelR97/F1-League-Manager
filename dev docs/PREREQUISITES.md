# F1 Esports League Manager - Junior Setup Guide

Use this document to prepare a new developer machine and create the two Supabase cloud projects.

Follow the steps in order. Do not skip ahead.

---

## Phase 0 - What You Are Setting Up

You are setting up the services needed before development starts.

The project uses:

1. GitHub for source code.
2. Supabase for database, auth, storage, and realtime.
3. Vercel for hosting.
4. Upstash for rate limiting.
5. Sentry for error monitoring.

Discord is a stretch goal. Do not set it up for MVP unless a senior asks you to.

---

## Phase 1 - Create Required Accounts

### Step 1. Create A GitHub Account

1. Go to `https://github.com`.
2. Create an account or sign in.
3. Ask the project owner for access to the repo.
4. Confirm you can see the repo in GitHub.

Done when:

- [x] You can open the GitHub repo in your browser.

### Step 2. Create A Supabase Account

1. Go to `https://supabase.com`.
2. Create an account or sign in.
3. Create or join the project organization.

Done when:

- [x] You can open the Supabase dashboard.

### Step 3. Create A Vercel Account

1. Go to `https://vercel.com`.
2. Create an account or sign in.
3. Connect your GitHub account if prompted.

Done when:

- [x] You can open the Vercel dashboard.

### Step 4. Create An Upstash Account

1. Go to `https://upstash.com`.
2. Create an account or sign in.

Done when:

- [x] You can open the Upstash dashboard.

### Step 5. Create A Sentry Account

1. Go to `https://sentry.io`.
2. Create an account or sign in.

Done when:

- [x] You can open the Sentry dashboard.

---

## Phase 2 - Install Local Developer Tools

### Step 1. Open The Project Folder

Open PowerShell in the project root:

```powershell
cd d:\Development\F1-League-Manager
```

Linux/macOS:

```bash
cd /path/to/F1-League-Manager
```

### Step 2. Run The Machine Check

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-dev.ps1
```

Linux/macOS:

```bash
bash scripts/check-dev.sh
```

### Step 3. Install Missing Tools

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-dev.ps1 -Install
```

Linux/macOS:

```bash
bash scripts/check-dev.sh --install
```

If a tool installs but still shows as missing, close the terminal, open a new one, and run the check again.

### Step 4. Confirm Required Tools

You need these tools:

| Tool | Required | Why |
|------|----------|-----|
| Git | Yes | Source control. |
| Node.js 20.9 or newer | Yes | Required by the Next.js version used by this project. |
| npm | Yes | Installs packages. |
| Supabase CLI | Yes | Installed as a local dev dependency and run with `npx supabase`. |
| Docker Desktop | Recommended | Needed for local Supabase. |
| GitHub CLI | Recommended | Easier GitHub login. |
| Vercel CLI | Recommended | Easier deploy checks. |

Done when:

- [x] The machine check has no required-tool failures.

---

## Phase 3 - Configure GitHub Branch And PR Rules

The repo uses protected long-lived branches.

Long-lived branches:

1. `dev`
2. `staging`
3. `prod`

Do not commit directly to these branches. Use pull requests.

### Step 1. Confirm Branches Exist

In GitHub:

1. Open the repository.
2. Go to `Code`.
3. Open the branch dropdown.
4. Confirm these branches exist:
   - `dev`
   - `staging`
   - `prod`

Done when:

- [x] `dev` exists.
- [x] `staging` exists.
- [x] `prod` exists.

### Step 2. Create Branch Protection Rules

In GitHub:

1. Open the repository.
2. Go to `Settings`.
3. Go to `Branches`.
4. Add a branch protection rule for `dev`.
5. Repeat for `staging`.
6. Repeat for `prod`.

Recommended settings for `dev`:

1. Require a pull request before merging.
2. Do not require approval for solo-owner velocity.
3. Require status checks to pass before merging.
4. Require branches to be up to date before merging.
5. Do not allow force pushes.
6. Do not allow deletions.

Recommended settings for `staging`:

1. Require a pull request before merging.
2. Require at least one approval.
3. Require status checks to pass before merging.
4. Require branches to be up to date before merging.
5. Do not allow force pushes.
6. Do not allow deletions.

Recommended settings for `prod`:

1. Require a pull request before merging.
2. Require at least one senior approval.
3. Require status checks to pass before merging.
4. Require branches to be up to date before merging.
5. Require conversation resolution before merging.
6. Do not allow force pushes.
7. Do not allow deletions.
8. Restrict who can push if the repository plan supports it.

Done when:

- [x] `dev` is protected.
- [x] `staging` is protected.
- [x] `prod` is protected.

### Step 3. Use The Correct PR Flow

| Work type | Work branch | PR target |
|-----------|-------------|-----------|
| Feature | `feature/short-description` from `dev` | `dev` |
| Bug fix | `fix/short-description` from `dev` | `dev` |
| Release candidate | `release/yyyy-mm-dd` from `dev` | `staging` |
| Production promotion | `promote/yyyy-mm-dd` from `staging` | `prod` |
| Hotfix | `hotfix/short-description` from `prod` | `prod`, then back-merge |

Rules:

1. Every code change uses a PR.
2. `dev` PR review is recommended but not enforced; `staging` and `prod` PRs need review before merge.
3. CI must pass before merge.
4. PR descriptions must include test evidence.
5. Production PRs must already be tested on staging.
6. Hotfixes must be back-merged to `staging` and `dev`.

Done when:

- [x] Team understands the PR flow.
- [x] No one plans to push directly to protected branches.

---

## Phase 4 - Create Supabase Projects

The GitHub repo has three long-lived branches:

1. `dev`
2. `staging`
3. `prod`

Supabase only supports two cloud projects for our current setup, so we use two cloud projects plus local Supabase.

| GitHub branch | Supabase target | Purpose | Reset allowed |
|---------------|-----------------|---------|---------------|
| `dev` | Local Supabase by default. Dev previews may use `f1-league-manager-nonprod`. | Daily development and disposable testing. | Yes. |
| `staging` | `f1-league-manager-nonprod` | Release testing before production. | Yes, with team warning. |
| `prod` | `f1-league-manager-prod` | Real league production data. | No. |

Important:

```text
Never use production Supabase keys in normal local development.
```

This mapping is permanent project context. Developers and AI assistants must check it before changing code, docs, migrations, seeds, imports, CI, Vercel settings, or environment variables.

### Step 1. Create The Non-Production Project

1. Open Supabase.
2. Click `New project`.
3. Select the correct organization.
4. Project name: `f1-league-manager-nonprod`.
5. Generate a strong database password.
6. Save the password in a password manager.
7. Choose the closest available region to the league users.
8. Choose the Free plan.
9. Click `Create new project`.
10. Wait for Supabase to finish provisioning.

Done when:

- [x] The non-production project opens in Supabase.

Use non-production for:

1. `staging` branch deployments.
2. Shared dev preview deployments.
3. Testing migrations before production.
4. Final acceptance testing before release.

Daily `dev` work should still use local Supabase where possible.

### Step 2. Create The Production Project

Repeat the same steps, but use:

```text
f1-league-manager-prod
```

Production rules:

1. Do not reset production.
2. Do not test unfinished features against production.
3. Do not use production keys locally unless doing a controlled production smoke test.
4. Only approved migrations go to production.

Done when:

- [x] The production project opens in Supabase.

### Step 3. Save Project Details

Save these for both Supabase cloud projects in a password manager or secure project vault:

| Value | Where to find it | Why |
|-------|------------------|-----|
| Project name | Supabase dashboard | Human reference. |
| Project ref | Project settings or project URL | Needed by CLI. |
| Region | Project settings | Operations notes. |
| Database password | From project creation | Direct DB access and CLI linking. |

Do not save these in Git.

Done when:

- [x] Non-production project details are saved securely.
- [x] Production project details are saved securely.

---

## Phase 5 - Get Supabase URL And Keys

Repeat this phase for both cloud Supabase projects.

You need one cloud key set for non-production and one cloud key set for production.

| Environment | GitHub branch | Supabase target |
|-------------|---------------|-----------------|
| Local development | `dev` | Local Supabase by default. |
| Dev preview | `dev` | `f1-league-manager-nonprod` |
| Staging | `staging` | `f1-league-manager-nonprod` |
| Production | `prod` | `f1-league-manager-prod` |

### Step 1. Open API Keys

1. Open the correct Supabase project.
2. Go to `Project Settings`.
3. Go to `API Keys`.

### Step 2. Copy The Project URL

Copy the Project URL.

It looks like:

```text
https://your-project-ref.supabase.co
```

This becomes:

```env
NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
```

### Step 3. Copy The Public Browser Key

Use the newer publishable key if Supabase shows one.

It usually looks like:

```text
sb_publishable_...
```

If your dashboard only shows legacy keys, use the `anon` public key.

This becomes:

```env
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-publishable-or-anon-key"
```

This key is browser-safe.

### Step 4. Copy The Server Secret Key

Use the newer secret key if Supabase shows one.

It usually looks like:

```text
sb_secret_...
```

If your dashboard only shows legacy keys, use the `service_role` key.

This becomes:

```env
SUPABASE_SERVICE_ROLE_KEY="your-secret-or-service-role-key"
```

This key is not browser-safe.

Never:

1. Put this key in client components.
2. Prefix this key with `NEXT_PUBLIC_`.
3. Commit this key to Git.
4. Paste this key into chat, screenshots, or docs.

Done when:

- [x] Non-production Project URL, public key, and secret key are saved.
- [x] Production Project URL, public key, and secret key are saved.

### Step 5. Label Keys Clearly

In the password manager, label keys like this:

```text
F1 League Manager - Supabase NONPROD - URL
F1 League Manager - Supabase NONPROD - Public Key
F1 League Manager - Supabase NONPROD - Secret Key
F1 League Manager - Supabase PROD - URL
F1 League Manager - Supabase PROD - Public Key
F1 League Manager - Supabase PROD - Secret Key
```

This prevents mixing environments.

---

## Phase 6 - Configure Supabase Auth

### Step 1. Open Auth Providers

Go to:

```text
Authentication -> Providers
```

### Step 2. Enable Email Auth

1. Open the Email provider.
2. Enable Email login.
3. Save changes.

Use email auth for admins and racers.

Done when:

- [x] Email Auth is enabled.

### Step 3. Disable Phone Auth

1. Open Phone provider.
2. Disable it.
3. Save changes.

Done when:

- [x] Phone Auth is disabled.

### Step 4. Disable Anonymous Sign-Ins

1. Find anonymous sign-in settings.
2. Disable anonymous sign-ins.
3. Save changes.

Reason:

```text
Every admin and racer action must belong to a real user account.
```

Done when:

- [x] Anonymous sign-ins are disabled.

### Step 5. Disable OAuth Providers For MVP

Disable these unless the project owner approves them:

1. Google.
2. GitHub.
3. Discord.
4. Any other OAuth provider.

Reason:

```text
Email login is simpler and safer for MVP.
```

Done when:

- [x] OAuth providers are disabled.

### Step 6. Configure Signup Rules

For dev:

1. Disable public self-signup if possible.
2. Use invited or manually created users.

For production:

1. Disable public self-signup at launch.
2. Enable email confirmation.
3. Enable secure email change if available.
4. Enable double confirmation for email changes if available.

Reason:

```text
Admins should control who becomes an admin or racer.
```

Done when:

- [x] Public self-signup is disabled for launch.
- [x] Production email confirmation plan is recorded.

---

## Phase 7 - Configure Auth URLs

Do this in both cloud Supabase projects.

### Step 1. Open URL Configuration

Go to:

```text
Authentication -> URL Configuration
```

### Step 2. Set Local Dev URLs

Do this in the non-production Supabase project.

Set:

| Field | Value |
|-------|-------|
| Site URL | `http://localhost:3000` |
| Redirect URL | `http://localhost:3000/**` |

Done when:

- [x] Local Site URL is set.
- [x] Local redirect URL is added.

### Step 3. Add Vercel Preview URL

Do this in the non-production Supabase project.

Add this redirect URL:

```text
https://*.vercel.app/**
```

Reason:

```text
Vercel preview deployments need login and password reset redirects.
```

Done when:

- [x] Vercel preview redirect URL is added.

### Step 4. Add Production URL Later

Do this only in the production Supabase project.

When you know the production domain, set:

| Field | Value |
|-------|-------|
| Site URL | `https://your-production-domain.com` |
| Redirect URL | `https://your-production-domain.com/**` |

Production rule:

```text
Use exact production domains. Keep wildcards only for local dev and preview deploys.
```

Done when:

- [ ] Production URL task is recorded for launch.

### Step 5. Use Environment-Specific Redirects

Use this mapping:

| Supabase project | Allowed app URLs |
|------------------|------------------|
| Non-production | `http://localhost:3000`, dev preview URLs, staging URL, and staging custom domain if used. |
| Production | Production domain only. |

Do not add localhost redirect URLs to the production Supabase project unless a senior approves a controlled production smoke test.

---

## Phase 8 - Configure Database Rules

Do not build final tables manually in the dashboard.

Tables must come from migrations during S1.

### Step 1. Understand The Rule

Every app table in the `public` schema must have RLS enabled.

Migration example:

```sql
alter table public.table_name enable row level security;
```

### Step 2. Understand Public Data

Public visitors may read:

1. Public standings.
2. Public results.
3. Public calendars.
4. Public penalties.
5. Public teams.
6. Public drivers.
7. Public wheel history.

Public visitors must not write anything.

### Step 3. Understand Private Data

Racers may read and write only their own:

1. Profile-owned private setup data.
2. Garage notes.
3. Setup metadata.

### Step 4. Understand Admin Data

Admin writes must go through protected server routes.

Admin routes must:

1. Check login.
2. Read role from `profiles`.
3. Validate CSRF.
4. Validate input with Zod.
5. Write audit logs.

### Step 5. Do Not Trust User Metadata For Roles

Do not use browser-editable user metadata for admin roles.

Roles belong in:

```text
public.profiles.role
```

Done when:

- [ ] Everyone understands tables are created by migrations.
- [ ] Everyone understands RLS is mandatory.

---

## Phase 9 - Configure Storage

Do this in both cloud Supabase projects:

1. `f1-league-manager-nonprod`
2. `f1-league-manager-prod`

Local Supabase storage setup will be handled by local configuration and migrations during development.

### Step 1. Open Storage

Go to:

```text
Storage -> Buckets
```

### Step 2. Create League Assets Bucket

Create bucket:

| Setting | Value |
|---------|-------|
| Name | `league-assets` |
| Public | Yes |
| Max file size | 2 MB |
| Allowed MIME types | `image/png`, `image/jpeg`, `image/webp` |

Use this bucket for:

1. League logos.
2. League hero images.

Done when:

- [x] `league-assets` bucket exists.

### Step 3. Create Team Assets Bucket

Create bucket:

| Setting | Value |
|---------|-------|
| Name | `team-assets` |
| Public | Yes |
| Max file size | 2 MB |
| Allowed MIME types | `image/png`, `image/jpeg`, `image/webp` |

Use this bucket for:

1. Team logos.
2. Team car images.

Done when:

- [x] `team-assets` bucket exists.

### Step 4. Disable SVG Uploads

Do not allow SVG uploads for MVP.

Reason:

```text
SVG files can contain script-like content. We can support them later only with sanitization.
```

Done when:

- [x] SVG is not in allowed MIME types.

### Step 5. Understand Storage Access

Public read is okay for these buckets because branding images are meant to be public.

Writes are not public.

Only admins may:

1. Upload.
2. Replace.
3. Delete.
4. Move.

Storage policies are added during S1 migrations.

Done when:

- [x] Buckets exist.
- [x] Upload rules are understood.

---

## Phase 10 - Configure Realtime

Do not enable Realtime everywhere.

### Step 1. Keep Realtime Limited At First

Leave Realtime disabled for most tables until the related feature exists.

### Step 2. Enable Realtime Later Only For Public Update Tables

Approved tables later:

| Table | Enable when |
|-------|-------------|
| `driver_standings` | Public standings are built. |
| `team_standings` | Constructor standings are built. |
| `race_sessions` | Public calendar is built. |
| `wheel_spins` | Wheel history is built. |

### Step 3. Never Enable Realtime For Private/Admin Tables

Do not enable Realtime for:

1. `vehicle_setups`
2. `audit_logs`
3. `workbook_migrations`
4. Private admin tables
5. Import tables

Reason:

```text
Realtime increases the risk of data leakage if a policy is wrong.
```

Done when:

- [ ] Realtime is not enabled broadly.
- [ ] Approved Realtime table list is understood.

---

## Phase 11 - Set Up Upstash Redis

Upstash is used for rate limiting admin and auth endpoints.

### Step 1. Create Redis Database

1. Open Upstash.
2. Create a new Redis database.
3. Choose the free tier.
4. Choose the closest region available.

### Step 2. Get REST Credentials

Copy:

| Env var | Upstash value |
|---------|---------------|
| `UPSTASH_REDIS_REST_URL` | REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | REST token |

Done when:

- [x] Upstash Redis database exists.
- [x] REST URL is saved securely.
- [x] REST token is saved securely.

---

## Phase 12 - Set Up Sentry

Sentry is for error monitoring.

This can wait until beta, but setting it up early is helpful.

### Step 1. Create Sentry Project

1. Open Sentry.
2. Create a project.
3. Choose Next.js if asked for platform.

### Step 2. Get Sentry Values

Copy:

| Env var | Sentry value |
|---------|--------------|
| `SENTRY_DSN` | Client/project DSN |
| `SENTRY_AUTH_TOKEN` | Auth token for source maps/CI |

Done when:

- [ ] Sentry project exists or is scheduled for beta.

---

## Phase 13 - Set Up Vercel

Vercel is needed before deployment, not before early planning.

Vercel must follow the GitHub branch mapping:

| GitHub branch | Vercel environment | Supabase target |
|---------------|--------------------|-----------------|
| `dev` | Preview or development deployment | `f1-league-manager-nonprod` for shared previews. |
| `staging` | Preview/staging deployment | `f1-league-manager-nonprod` |
| `prod` | Production deployment | `f1-league-manager-prod` |

### Step 1. Connect GitHub Repo

1. Open Vercel.
2. Import the GitHub repo.
3. Choose Next.js as the framework.

### Step 2. Configure Branch Deployments

In Vercel project settings:

1. Confirm the production branch is `prod`.
2. Keep `dev` and `staging` as non-production deployments.
3. Use preview deployments for pull requests.

If Vercel defaults production to `main`, change it before first production release.

Done when:

- [ ] Vercel production branch is `prod`.
- [ ] `dev` does not deploy to production.
- [ ] `staging` does not deploy to production.

### Step 3. Add Environment Variables

Add these to Vercel later:

1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. `SUPABASE_SERVICE_ROLE_KEY`
4. `NEXT_PUBLIC_SITE_URL`
5. `CSRF_SECRET`
6. `UPSTASH_REDIS_REST_URL`
7. `UPSTASH_REDIS_REST_TOKEN`
8. `SENTRY_DSN`
9. `SENTRY_AUTH_TOKEN`
10. `DISCORD_WEBHOOK_URL` only if the stretch goal is enabled

Use different values for:

1. Dev preview deployments.
2. Staging branch deployments.
3. Production branch deployments.

Environment mapping:

| Vercel env/branch | Supabase env values to use |
|-------------------|----------------------------|
| `dev` branch preview | Non-production Supabase URL, public key, secret key. |
| `staging` branch | Non-production Supabase URL, public key, secret key. |
| `prod` branch | Production Supabase URL, public key, secret key. |

Never put production Supabase keys in the dev or staging Vercel environments.

Done when:

- [ ] Vercel project exists before deployment sprint.
- [ ] Branch-to-environment mapping is documented in Vercel.
- [ ] Env vars use the matching Supabase project for each branch.

---

## Phase 14 - Create Local `.env.local`

Do this after S0 scaffolding creates `.env.example`.

### Step 1. Create File

Create this file in the project root:

```text
.env.local
```

### Step 2. Add Values

Use this shape:

```env
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-local-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-local-service-role-key"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
CSRF_SECRET="generate-a-random-32-byte-hex-string"
UPSTASH_REDIS_REST_URL="your-upstash-url"
UPSTASH_REDIS_REST_TOKEN="your-upstash-token"
SENTRY_DSN=""
SENTRY_AUTH_TOKEN=""
DISCORD_WEBHOOK_URL=""
SUPABASE_STORAGE_ASSET_BUCKET="league-assets"
```

For normal `dev` branch work, prefer local Supabase values.

Use non-production cloud values only when you are testing a shared dev preview or staging deployment.

### Step 3. Generate CSRF Secret

Run:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the result into:

```env
CSRF_SECRET="paste-generated-value-here"
```

### Step 4. Confirm Git Ignores The File

Run:

```powershell
git status --short
```

`.env.local` must not appear.

If it appears, stop and fix `.gitignore` before continuing.

Done when:

- [ ] `.env.local` exists.
- [ ] `.env.local` does not show in Git status.

---

## Phase 15 - Link Supabase CLI Later

Do this during S1 when migrations start.

Default local development uses local Supabase.

### Step 1. Log In To Supabase CLI

```powershell
npx supabase login
```

Linux/macOS:

```bash
npx supabase login
```

### Step 2. Link The Non-Production Project Only When Needed

Use the non-production project ref from Supabase only when you are preparing shared integration or staging work.

```powershell
npx supabase link --project-ref your-project-ref
```

### Step 3. Confirm Link

```powershell
npx supabase status
```

Done when:

- [ ] Supabase CLI is linked to local Supabase for daily work, or non-production Supabase for shared integration work.

Do not link local development to production unless a senior specifically asks you to.

Branch rule:

```text
Normal local work happens from dev branch against local Supabase.
Shared dev previews and release testing happen against f1-league-manager-nonprod.
Production deploys happen from prod branch against f1-league-manager-prod.
```

---

## Phase 16 - Create First Super Admin Later

Do this only after S1 migrations create the `profiles` table.

### Step 1. Create User

1. Open Supabase.
2. Go to `Authentication -> Users`.
3. Click `Add user` or `Invite user`.
4. Enter the super admin email.
5. Save.

### Step 2. Copy User UUID

1. Open the new user row.
2. Copy the user's UUID.

### Step 3. Add Profile Row

Go to `SQL Editor` and run:

```sql
insert into public.profiles (id, display_name, role)
values (
  'paste-user-uuid-here',
  'League Super Admin',
  'super_admin'
);
```

Rules:

1. Start with only one `super_admin`.
2. Normal admins use `admin`.
3. Racers use `racer`.
4. Do not store roles in browser-editable metadata.

Done when:

- [ ] Super admin can log in.
- [ ] Super admin has a matching `profiles` row.

---

## Phase 17 - Enable And Disable Checklist

### Enable Now

- [x] Supabase Email Auth.
- [x] Local auth Site URL.
- [x] Local auth redirect URL.
- [x] Storage bucket `league-assets`.
- [x] Storage bucket `team-assets`.
- [x] Upstash Redis database.

### Enable During S1

- [ ] RLS on every public schema table.
- [ ] Public read policies for safe public tables.
- [ ] Owner policies for racer setup tables.
- [ ] Admin-only write policies.
- [ ] Storage upload/update/delete policies.

### Enable Later

- [ ] Confirm email in production.
- [ ] Vercel preview redirect URL.
- [ ] Production auth Site URL.
- [ ] Production auth redirect URL.
- [ ] Sentry monitoring.
- [ ] Realtime for approved public update tables.

### Disable Now

- [x] Phone Auth.
- [x] Anonymous sign-ins.
- [x] OAuth providers.
- [x] Public self-signup at launch.
- [x] SVG uploads.
- [ ] Realtime on private/admin/import/audit tables.
- [ ] Database webhooks.
- [ ] Edge Functions unless a sprint explicitly adds them.

---

## Phase 18 - Final S1 Ready Check

Before S1 starts, confirm every item below.

As items are completed, keep the checklist current. If an item cannot be completed yet, leave it unchecked and add the reason in the project notes or sprint tracker.

Status rule:

```text
Checked means done. Unchecked means outstanding. Outstanding items need a reason.
```

### Accounts

- [x] GitHub access works.
- [x] GitHub `dev`, `staging`, and `prod` branches exist.
- [x] GitHub branch protection is configured for `dev`, `staging`, and `prod`.
- [x] GitHub PR review is enforced on `staging` and `prod`; `dev` review is recommended but not enforced.
- [x] Supabase access works.
- [x] Upstash access works.
- [ ] Vercel access works or is scheduled.
- [ ] Sentry access works or is scheduled.

### Local Machine

- [x] Git installed.
- [x] Node.js 20.9 or newer installed.
- [x] npm installed.
- [ ] Supabase CLI installed locally with `npm install -D supabase`.
- [ ] Docker Desktop installed or scheduled.
- [x] Dev check script has no required-tool failures.

### Supabase

- [ ] Local Supabase is available for daily `dev` work.
- [x] Non-production project exists for shared dev previews and the `staging` branch.
- [x] Production project exists for the `prod` branch.
- [x] Non-production Project URL, public key, secret key, and database password are saved.
- [x] Production Project URL, public key, secret key, and database password are saved.
- [x] Email Auth enabled.
- [x] Phone Auth disabled.
- [x] Anonymous sign-ins disabled.
- [x] OAuth providers disabled.
- [x] Local Site URL set to `http://localhost:3000`.
- [x] Local redirect URL includes `http://localhost:3000/**`.
- [x] Storage bucket plan completed.

### Branch Mapping

- [x] GitHub `dev` branch uses local Supabase by default.
- [x] GitHub `dev` branch previews may use `f1-league-manager-nonprod`.
- [x] GitHub `staging` branch maps to `f1-league-manager-nonprod`.
- [x] GitHub `prod` branch maps to `f1-league-manager-prod`.
- [ ] Vercel production branch is `prod`.
- [ ] Dev preview deploys use non-production Supabase keys.
- [ ] Staging deploys use non-production Supabase keys.
- [ ] Production deploys use production Supabase keys.

### Environment

- [ ] `.env.local` exists after S0.
- [ ] `.env.local` is ignored by Git.
- [ ] `CSRF_SECRET` generated.
- [x] Upstash REST URL saved.
- [x] Upstash REST token saved.

If any item is unchecked, finish it before starting S1.

---

## Phase 19 - Official References

Use official docs if the dashboard labels change.

1. Supabase API keys: `https://supabase.com/docs/guides/getting-started/api-keys`
2. Supabase Auth redirect URLs: `https://supabase.com/docs/guides/auth/redirect-urls`
3. Supabase Auth configuration: `https://supabase.com/docs/guides/auth/general-configuration`
4. Supabase Row Level Security: `https://supabase.com/docs/guides/database/postgres/row-level-security`
5. Supabase Storage buckets: `https://supabase.com/docs/guides/storage/buckets/fundamentals`
6. Supabase Storage access control: `https://supabase.com/docs/guides/storage/security/access-control`
7. Supabase database connections: `https://supabase.com/docs/guides/database/connecting-to-postgres`

When in doubt, ask a senior before changing auth, keys, RLS, storage policies, or production settings.
