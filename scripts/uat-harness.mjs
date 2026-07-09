// Observe-then-act UAT harness for F1 League Manager.
// Playwright-based manual GUI-UAT tool. Artifacts go to repo-relative .uat-artifacts/.
// Usage (run from repo root, via PowerShell to avoid Git-Bash path mangling):
//   node scripts/uat-harness.mjs observe <url> [role]   -> dump rendered page (role=admin|racer|anon)
//   node scripts/uat-harness.mjs login <role>           -> (re)create cached session
//   node scripts/uat-harness.mjs flow <steps.json> [role] -> run ordered steps in one context
// Reads the REAL rendered DOM so we observe the actual UI, not guess it.
// NOTE: BASE must be localhost (not 127.0.0.1) — app pins Origin/CSRF to NEXT_PUBLIC_SITE_URL.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".uat-artifacts");
fs.mkdirSync(OUT, { recursive: true });

const CREDS = {
  admin: { email: process.env.UAT_ADMIN_EMAIL || "e2e-admin@test.local", password: process.env.UAT_ADMIN_PASSWORD || "E2eTestPassword!1" },
  racer: { email: process.env.UAT_RACER_EMAIL || "e2e-racer@test.local", password: process.env.UAT_RACER_PASSWORD || "E2eTestPassword!1" },
};
const statePath = (role) => path.join(OUT, `state-${role}.json`);

async function login(browser, role) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const c = CREDS[role];
  const emailEl = page.locator("#login-email");
  const pwEl = page.locator("#login-password");
  await emailEl.waitFor({ state: "visible" });
  await page.waitForTimeout(500);
  await emailEl.click();
  await emailEl.pressSequentially(c.email, { delay: 15 });
  await pwEl.click();
  await pwEl.pressSequentially(c.password, { delay: 15 });
  await page.getByRole("button", { name: /sign in|log ?in/i }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const landed = page.url();
  if (landed.includes("/login")) {
    const alerts = await page.$$eval('[role=alert],[class*="destructive"],[class*="error"],p', (els) =>
      [...new Set(els.map((e) => e.textContent.trim()).filter((t) => t && t.length < 160))].slice(0, 12));
    console.log(`[login ${role}] STILL ON LOGIN. Visible text/alerts:`, JSON.stringify(alerts));
  }
  await ctx.storageState({ path: statePath(role) });
  console.log(`[login ${role}] landed at ${landed}`);
  await ctx.close();
}

async function contextFor(browser, role) {
  if (role === "anon") return browser.newContext();
  if (!fs.existsSync(statePath(role))) await login(browser, role);
  return browser.newContext({ storageState: statePath(role) });
}

async function dump(page) {
  const out = {};
  out.url = page.url();
  out.title = await page.title();
  out.headings = await page.$$eval("h1,h2,h3", (els) =>
    els.map((e) => `${e.tagName}: ${e.textContent.trim()}`).filter((t) => t.length < 120));
  out.fields = await page.$$eval("input,select,textarea", (els) =>
    els.map((el) => {
      let label = "";
      if (el.id) { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) label = l.textContent.trim(); }
      if (!label) { const wrap = el.closest("label"); if (wrap) label = wrap.textContent.trim(); }
      if (!label) label = el.getAttribute("aria-label") || el.getAttribute("placeholder") || "";
      const base = { tag: el.tagName.toLowerCase(), type: el.getAttribute("type") || "", name: el.getAttribute("name") || "", id: el.id || "", label: label.slice(0, 80), value: (el.value || "").slice(0, 40) };
      if (el.tagName === "SELECT") base.options = Array.from(el.options).map((o) => o.textContent.trim()).slice(0, 40);
      return base;
    }));
  out.buttons = await page.$$eval("button,[role=button]", (els) =>
    [...new Set(els.map((e) => e.textContent.trim()).filter(Boolean))].slice(0, 40));
  out.links = await page.$$eval("a", (els) =>
    els.map((e) => `${e.textContent.trim()} -> ${e.getAttribute("href")}`).filter((t) => t.length > 4 && t.length < 120).slice(0, 60));
  out.paragraphs = await page.$$eval("p,li", (els) =>
    [...new Set(els.map((e) => e.textContent.trim()).filter((t) => t && t.length < 140))].slice(0, 20));
  out.tabs = await page.$$eval('[role=tab]', (els) =>
    [...new Set(els.map((e) => e.textContent.trim()).filter(Boolean))].slice(0, 20));
  out.tables = await page.$$eval("table", (tables) =>
    tables.slice(0, 4).map((t) => {
      const head = Array.from(t.querySelectorAll("thead th, thead td")).map((c) => c.textContent.trim());
      const rows = Array.from(t.querySelectorAll("tbody tr")).slice(0, 16).map((r) =>
        Array.from(r.querySelectorAll("th,td")).map((c) => c.textContent.trim().slice(0, 24)));
      return { head, rows };
    }));
  out.alerts = await page.$$eval('[role=alert],.error,[data-error],[class*="destructive"]', (els) =>
    [...new Set(els.map((e) => e.textContent.trim()).filter((t) => t && t.length < 200))].slice(0, 10));
  return out;
}

async function runFlow(browser, steps, role) {
  const ctx = await contextFor(browser, role);
  const page = await ctx.newPage();
  const results = [];
  const net = [];
  page.on("request", (r) => { if (r.method() !== "GET") net.push(`REQ ${r.method()} ${r.url().replace(BASE, "")}`); });
  page.on("response", (r) => { const s = r.status(); if (s >= 400) net.push(`RESP ${s} ${r.request().method()} ${r.url().replace(BASE, "")}`); });
  page.on("console", (m) => { if (m.type() === "error") net.push(`console.error: ${m.text().slice(0, 160)}`); });
  page.on("requestfailed", (r) => net.push(`REQFAIL ${r.method()} ${r.url().replace(BASE, "")} ${r.failure()?.errorText || ""}`));
  for (const step of steps) {
    const key = Object.keys(step)[0];
    try {
      if (step.goto) { const u = step.goto.startsWith("http") ? step.goto : `${BASE}${step.goto}`;
        const r = await page.goto(u, { waitUntil: "networkidle" }); results.push(`goto ${step.goto} -> ${r?.status()} @ ${page.url()}`); await page.waitForTimeout(400); }
      else if (step.selectName) { await page.selectOption(`[name="${step.selectName.name}"]`, { label: step.selectName.label });
        results.push(`select ${step.selectName.name}=${step.selectName.label}`); }
      else if (step.selectLabel) { const s = page.locator(`[aria-label="${step.selectLabel.label}"]`).first(); await s.selectOption(step.selectLabel.value);
        results.push(`selectLabel "${step.selectLabel.label}"=${step.selectLabel.value}`); }
      else if (step.fill) { const el = page.locator(step.fill.sel).first(); await el.click(); await el.fill("");
        await el.pressSequentially(String(step.fill.val), { delay: 8 }); const v = await el.inputValue();
        results.push(`fill ${step.fill.sel}="${v}"`); }
      else if (step.typeLabel) { const el = page.locator(`[aria-label="${step.typeLabel.label}"]`).first(); await el.click(); await el.fill("");
        await el.pressSequentially(String(step.typeLabel.val), { delay: 8 }); results.push(`typeLabel "${step.typeLabel.label}"="${await el.inputValue()}"`); }
      else if (step.checkLabel) { const el = page.locator(`[aria-label="${step.checkLabel}"]`).first(); await el.check(); results.push(`checkLabel "${step.checkLabel}"`); }
      else if (step.check) { const el = page.locator(`[name="${step.check.name}"]`).first();
        if (step.check.on) await el.check(); else await el.uncheck(); results.push(`check ${step.check.name}=${step.check.on}`); }
      else if (step.click) { await page.getByRole("button", { name: new RegExp(step.click.name, "i") }).first().click();
        await page.waitForTimeout(600); results.push(`click button "${step.click.name}" @ ${page.url()}`); }
      else if (step.clickLink) { await page.getByRole("link", { name: new RegExp(step.clickLink, "i") }).first().click();
        await page.waitForLoadState("networkidle").catch(()=>{}); await page.waitForTimeout(400); results.push(`clickLink "${step.clickLink}" @ ${page.url()}`); }
      else if (step.clickSel) { await page.locator(step.clickSel).first().click(); await page.waitForTimeout(500); results.push(`clickSel ${step.clickSel}`); }
      else if (step.waitUrl) { await page.waitForURL(new RegExp(step.waitUrl), { timeout: 12000 }); results.push(`waitUrl ${step.waitUrl} -> ${page.url()}`); }
      else if (step.wait) { await page.waitForTimeout(step.wait); results.push(`wait ${step.wait}`); }
      else if (step.expect) { const found = await page.getByText(new RegExp(step.expect.text, "i")).first().isVisible().catch(()=>false);
        results.push(`EXPECT "${step.expect.text}" -> ${found ? "VISIBLE OK" : "NOT FOUND FAIL"}`); }
      else if (step.evalJs) { const r = await page.evaluate(step.evalJs); results.push(`evalJs -> ${JSON.stringify(r)}`); }
      else if (step.dump) { const d = await dump(page); results.push("DUMP:\n" + JSON.stringify(d, null, 2)); }
    } catch (e) { results.push(`STEP ${key} ERROR: ${e.message.split("\n")[0]}`); }
  }
  const shot = path.join(OUT, "shot.png");
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  console.log(results.join("\n"));
  if (net.length) console.log(`\n[network/console issues]\n` + net.join("\n"));
  console.log(`\n[final url] ${page.url()}\n[screenshot] ${shot}`);
  await ctx.close();
}

async function main() {
  const [cmd, arg1, arg2] = process.argv.slice(2);
  const browser = await chromium.launch();
  try {
    if (cmd === "login") { await login(browser, arg1 || "admin"); return; }
    if (cmd === "flow") { const steps = JSON.parse(fs.readFileSync(arg1, "utf8")); await runFlow(browser, steps, arg2 || "admin"); return; }
    if (cmd === "observe") {
      const role = arg2 || "admin";
      const ctx = await contextFor(browser, role);
      const page = await ctx.newPage();
      const url = arg1.startsWith("http") ? arg1 : `${BASE}${arg1}`;
      const resp = await page.goto(url, { waitUntil: "domcontentloaded" }).catch((e) => ({ err: e.message }));
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(800);
      const shot = path.join(OUT, "shot.png");
      await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
      const data = await dump(page);
      data.httpStatus = resp && resp.status ? resp.status() : (resp && resp.err) || "?";
      console.log(JSON.stringify(data, null, 2));
      console.log(`\n[screenshot] ${shot}`);
      await ctx.close();
      return;
    }
    console.log("commands: observe <url> [role] | login <role> | flow <steps.json> [role]");
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error("HARNESS ERROR:", e); process.exit(1); });
