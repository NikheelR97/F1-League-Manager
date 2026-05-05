# Developer Machine Checks

Use these scripts before starting project work on a new machine.

## Windows

Run from the project root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-dev.ps1
```

Strict mode fails on warnings too:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-dev.ps1 -Strict
```

## Linux Or macOS

Run from the project root:

```bash
bash scripts/check-dev.sh
```

Strict mode fails on warnings too:

```bash
bash scripts/check-dev.sh --strict
```

## What The Scripts Check

They check:

1. Required tools: Git, Node.js, npm.
2. Recommended tools: GitHub CLI, Vercel CLI, Supabase CLI, Docker.
3. Project files: `package.json`, `.env.local`, `node_modules`.
4. Required npm scripts after S0 setup.
5. Playwright availability after dependencies are installed.

Warnings are acceptable before S0 because the app has not been scaffolded yet.
