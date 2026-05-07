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
  /sk_(live|test|proj)_[A-Za-z0-9_-]+/u,
  /xox[baprs]-[A-Za-z0-9-]+/u,
  /https:\/\/discord\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/u,
];

const findings = [];

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

    if (!/\.(cjs|js|json|md|mjs|ts|tsx|yml|yaml)$/u.test(entry.name)) {
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
