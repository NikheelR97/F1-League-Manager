// Set a Supabase project's Auth Site URL + redirect allowlist via the Management API.
// No deps (uses Node's global fetch). Needs a Supabase Personal Access Token.
//
// Usage (PowerShell):
//   $env:SUPABASE_ACCESS_TOKEN="sbp_xxx"
//   node scripts/set-auth-urls.mjs <projectRef> "<siteUrl>" "<redirect1,redirect2,...>"
//
// Get a token at: https://supabase.com/dashboard/account/tokens
// Find a project ref at: https://supabase.com/dashboard/project/<ref>  (it's the <ref> in that URL)

const args = process.argv.slice(2);
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) { console.error("ERROR: set SUPABASE_ACCESS_TOKEN env var first."); process.exit(1); }

// Accept either a ref directly, or `--name <exactProjectName>` to resolve the ref.
let ref, siteUrl, allow;
if (args[0] === "--name") {
  const name = args[1];
  siteUrl = args[2];
  allow = args[3];
  if (!name || !siteUrl) { usage(); process.exit(1); }
  const list = await fetch("https://api.supabase.com/v1/projects", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!list.ok) { console.error(`Could not list projects: HTTP ${list.status} ${await list.text()}`); process.exit(1); }
  const projects = await list.json();
  const match = projects.filter((p) => p.name === name);
  if (match.length !== 1) {
    console.error(`Expected exactly one project named "${name}", found ${match.length}. Available projects:`);
    for (const p of projects) console.error(`  ${p.name}  (ref: ${p.id})`);
    process.exit(1);
  }
  ref = match[0].id;
  console.log(`Resolved "${name}" -> ref ${ref}`);
} else {
  [ref, siteUrl, allow] = args;
  if (!ref || !siteUrl) { usage(); process.exit(1); }
}

function usage() {
  console.error('Usage: node scripts/set-auth-urls.mjs (<projectRef> | --name <projectName>) "<siteUrl>" "<comma,separated,allowlist>"');
}

const body = { site_url: siteUrl };
if (allow) body.uri_allow_list = allow; // Supabase expects a comma-separated string

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const text = await res.text();
console.log(`HTTP ${res.status} ${res.statusText}`);
try {
  const j = JSON.parse(text);
  console.log("site_url      :", j.site_url);
  console.log("uri_allow_list:", j.uri_allow_list);
} catch { console.log(text.slice(0, 600)); }
if (!res.ok) process.exit(1);
console.log("\nDone. Re-send the password recovery — it should now redirect to the site_url above.");
