# Developer Machine Checks

Use these scripts before starting project work on a new machine.

## Windows

Run from the project root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-dev.ps1
```

Install missing machine tools:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-dev.ps1 -Install
```

After the app is scaffolded, install project dependencies:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-dev.ps1 -InstallProjectDeps
```

After Playwright is installed, install browser binaries:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-dev.ps1 -InstallPlaywright
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

Install missing machine tools:

```bash
bash scripts/check-dev.sh --install
```

After the app is scaffolded, install project dependencies:

```bash
bash scripts/check-dev.sh --install-project-deps
```

After Playwright is installed, install browser binaries:

```bash
bash scripts/check-dev.sh --install-playwright
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

## Install Notes

The scripts are read-only unless you pass an install flag.

Windows installs use:

1. `winget` for Git, Node.js, GitHub CLI, and Docker Desktop.
2. `npm install -g` for Vercel CLI and Supabase CLI.

Linux/macOS installs use:

1. `apt-get`, `dnf`, `yum`, `pacman`, or `brew` when available.
2. `npm install -g` for Vercel CLI and Supabase CLI.

Some installers update `PATH`. If a tool installs successfully but the script still cannot find it, open a new terminal and run the script again.
