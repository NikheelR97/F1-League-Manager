// Point a custom domain at a git branch of a Vercel project, via the Vercel API.
// No deps (Node global fetch). Needs a Vercel access token.
//
// Usage (PowerShell):
//   $env:VERCEL_TOKEN="..."
//   node scripts/vercel-alias.mjs [project] [branch] [domain] [teamSlug]
//   node scripts/vercel-alias.mjs --assign-branch [project] [branch] [domain] [teamSlug]
// Defaults: f1-league-manager  staging  staging.nikheelr.com  nikheel-rajmans-projects
//
// Get a token at: https://vercel.com/account/tokens
//
// Default mode: pins the domain to the current latest READY deployment for the
// branch (a one-time fix — the next push to the branch won't update it).
//
// --assign-branch mode: permanently binds the domain to the git branch (Vercel
// Project -> Settings -> Domains -> Git Branch), so every future deployment of
// that branch auto-serves on the domain. This is the recommended, durable fix.

const token = process.env.VERCEL_TOKEN;
if (!token) { console.error("ERROR: set VERCEL_TOKEN env var first (https://vercel.com/account/tokens)."); process.exit(1); }

const rawArgs = process.argv.slice(2);
const assignBranch = rawArgs[0] === "--assign-branch";
if (assignBranch) rawArgs.shift();

const [
  project = "f1-league-manager",
  branch = "staging",
  domain = "staging.nikheelr.com",
  teamSlug = "nikheel-rajmans-projects",
] = rawArgs;

const H = { Authorization: `Bearer ${token}` };
const api = (p) => `https://api.vercel.com${p}`;
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return { _raw: t }; } };

// 1) Resolve the team id from the slug. If the token has no matching team, the
// project lives under the personal account — proceed with no teamId.
let teamId = "";
if (teamSlug) {
  const teams = await j(await fetch(api("/v2/teams"), { headers: H }));
  const team = (teams.teams || []).find((t) => t.slug === teamSlug);
  if (team) {
    teamId = team.id;
    console.log(`Team "${teamSlug}" -> ${teamId}`);
  } else {
    console.log(`No team "${teamSlug}" on this token — using the personal account scope.`);
  }
}
const tq = teamId ? `&teamId=${teamId}` : "";

if (assignBranch) {
  // Permanently bind the domain to the git branch.
  const res = await fetch(api(`/v9/projects/${project}/domains/${domain}${teamId ? `?teamId=${teamId}` : ""}`), {
    method: "PATCH",
    headers: { ...H, "Content-Type": "application/json" },
    body: JSON.stringify({ gitBranch: branch }),
  });
  const out = await j(res);
  console.log(`\nAssign ${domain} -> branch "${branch}": HTTP ${res.status}`);
  console.log(JSON.stringify({ name: out.name, gitBranch: out.gitBranch }));
  if (!res.ok) process.exit(1);
  console.log(`\nDone. Every future deployment of "${branch}" will auto-serve on https://${domain}`);
  process.exit(0);
}

// 2) Find the newest READY deployment for the branch.
const deps = await j(await fetch(api(`/v6/deployments?app=${project}&limit=40${tq}`), { headers: H }));
const list = deps.deployments || [];
const ready = list
  .filter((d) => d.meta?.githubCommitRef === branch && (d.readyState || d.state) === "READY")
  .sort((a, b) => b.created - a.created);
if (!ready.length) {
  console.error(`No READY deployment found for branch "${branch}" in project "${project}".`);
  console.error("Recent deployments seen:");
  for (const d of list.slice(0, 8)) console.error(`  ${d.meta?.githubCommitRef} ${d.readyState || d.state} ${d.uid} ${new Date(d.created).toISOString()}`);
  process.exit(1);
}
const latest = ready[0];
console.log(`Latest READY "${branch}" deployment: ${latest.uid}`);
console.log(`  url: https://${latest.url}  sha: ${(latest.meta?.githubCommitSha || "").slice(0, 7)}  at: ${new Date(latest.created).toISOString()}`);

// 3) Alias the domain to that deployment.
const res = await fetch(api(`/v2/deployments/${latest.uid}/aliases${teamId ? `?teamId=${teamId}` : ""}`), {
  method: "POST",
  headers: { ...H, "Content-Type": "application/json" },
  body: JSON.stringify({ alias: domain }),
});
const out = await j(res);
console.log(`\nAlias ${domain} -> ${latest.uid}: HTTP ${res.status}`);
console.log(JSON.stringify(out).slice(0, 500));
if (!res.ok) process.exit(1);
console.log(`\nDone. Verify: curl -I https://${domain}/forgot-password  (expect 200)`);
