import { spawn } from "node:child_process";

const nextBin = process.platform === "win32" ? "npx.cmd" : "npx";
const command =
  process.platform === "win32"
    ? `${nextBin} next start -H 127.0.0.1`
    : nextBin;
const args =
  process.platform === "win32" ? [] : ["next", "start", "-H", "127.0.0.1"];

const child = spawn(command, args, {
  env: {
    ...process.env,
    E2E_SESSION_ENABLED: "true",
    NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000",
  },
  shell: process.platform === "win32",
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
