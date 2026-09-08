/** One resource-gated job owns its dev server and browser, and closes both. */
import { spawn } from "node:child_process";
const port = process.env.ADMIN_POLISH_PORT || "3045";
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--webpack", "-p", port],
  { stdio: ["ignore", "pipe", "pipe"], env: process.env },
);
let ready;
const started = new Promise((resolve, reject) => {
  ready = resolve;
  server.once("exit", (code) => reject(new Error(`Server exited ${code}`)));
});
server.stdout.on("data", (chunk) => {
  const text = String(chunk);
  if (text.includes("Ready in")) ready();
  if (text.includes("Error")) process.stderr.write(text);
});
server.stderr.on("data", (chunk) => process.stderr.write(chunk));
try {
  await started;
  process.env.PLAYWRIGHT_BASE_URL = `http://localhost:${port}`;
  const focus = process.env.QA_FOCUS;
  for (const [name, file] of [
    ["themes", "./qa-admin-polish.mjs"],
    ["interactions", "./qa-admin-polish-interactions.mjs"],
    ["touch", "./qa-admin-polish-touch.mjs"],
    ["editor", "./qa-admin-polish-theme-editor.mjs"],
    ["navigation", "./qa-admin-polish-navigation.mjs"],
  ])
    if (!focus || focus.split(",").includes(name)) await import(file);
  if (focus?.split(",").includes("api"))
    await new Promise((resolve, reject) => {
      const check = spawn(
        process.execPath,
        ["--conditions=react-server", "--import", "tsx", "scripts/test-api-contract-basics.ts"],
        { stdio: "inherit", env: process.env },
      );
      check.once("exit", (code) =>
        code === 0 ? resolve() : reject(new Error(`API check exited ${code}`)),
      );
    });
} finally {
  server.kill("SIGTERM");
}
