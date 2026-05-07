import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ignoredDirs = new Set([
  ".git",
  ".next",
  "coverage",
  "node_modules",
  "playwright-report",
  "test-results",
]);

const secretPatterns = [
  /sb_secret_[A-Za-z0-9_-]+/u,
  /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["']?eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/u,
  /sk_(live|test|proj)_[A-Za-z0-9_-]+/u,
  /xox[baprs]-[A-Za-z0-9-]+/u,
  /https:\/\/discord\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/u,
  /UPSTASH_REDIS_REST_TOKEN\s*[:=]\s*["']?[A-Za-z0-9_-]{20,}/u,
];

const findings = [];

function shouldScanFile(fileName) {
  if (fileName === ".env.example") {
    return true;
  }

  if (fileName.endsWith(".env.example")) {
    return true;
  }

  if (/^\.env.*\.example$/u.test(fileName)) {
    return true;
  }

  return /\.(cjs|js|json|md|mjs|ts|tsx|yml|yaml)$/u.test(fileName);
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    const relativePath = path.relative(process.cwd(), fullPath);

    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        await walk(fullPath);
      }
      continue;
    }

    if (!shouldScanFile(entry.name)) {
      continue;
    }

    const content = await readFile(fullPath, "utf8");
    for (const pattern of secretPatterns) {
      if (pattern.test(content)) {
        findings.push(relativePath);
      }
    }
  }
}

await walk(process.cwd());

if (findings.length > 0) {
  console.error("Potential secret values found:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log("No secret values found.");
