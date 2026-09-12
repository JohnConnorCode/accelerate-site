#!/usr/bin/env node
/** Renew only while an explicitly bounded foreground job is alive. Never a detached lease daemon. */
import { spawn } from "node:child_process";
import { processStartTime } from "./supervisor/identity.mjs";
import { readFileSync } from "node:fs";
import { git, repositoryContext, repositoryIdentity } from "./lib/developer-workspace.mjs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2),
  divider = args.indexOf("--");
const options = args.slice(0, divider),
  command = args.slice(divider + 1);
const value = (name) => options[options.indexOf(name) + 1];
const card = options.includes("--card") ? value("--card") : null;
const attempt = options.includes("--attempt") ? value("--attempt") : null;
const duration = options.includes("--timeout-ms") ? Number(value("--timeout-ms")) : 30 * 60_000;
if (
  divider < 0 ||
  !command[0] ||
  !card ||
  !attempt ||
  !/^[a-f0-9-]{36}$/.test(attempt) ||
  !Number.isSafeInteger(duration) ||
  duration < 1 ||
  duration > 60 * 60_000 ||
  options.some((v, i) => i % 2 === 0 && !["--card", "--attempt", "--timeout-ms"].includes(v))
) {
  console.error(
    "Use agent:run -- --card KEY --attempt UUID [--timeout-ms 1800000] -- COMMAND [ARGS]. Maximum one hour.",
  );
  process.exit(1);
}
let workspace;
try {
  const caller = repositoryContext(process.cwd());
  const session = JSON.parse(
    readFileSync(resolve(caller.sessions, `attempt-${attempt}.json`), "utf8"),
  );
  if (
    session.attemptId !== attempt ||
    ![session.card.id, session.card.seed_key].includes(card) ||
    !session.worktree
  )
    throw new Error("The requested attempt has no matching retained workspace.");
  const retained = repositoryContext(session.worktree);
  const repository = session.card.work_spec?.repository;
  if (
    retained.common !== caller.common ||
    !repository ||
    !repositoryIdentity(repository.url) ||
    repositoryIdentity(repository.url) !==
      repositoryIdentity(git(retained.root, ["remote", "get-url", "origin"], true)) ||
    !/^[a-f0-9]{40}$/.test(repository.baseCommit ?? "") ||
    git(retained.root, ["merge-base", "--is-ancestor", repository.baseCommit, "HEAD"], true) ===
      null
  )
    throw new Error("Retained attempt workspace does not match its repository and approved base.");
  workspace = retained.root;
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Unable to resolve the attempt workspace.",
  );
  process.exit(1);
}
const lifecycle = (operation, extra = []) =>
  new Promise((done) => {
    const processHandle = spawn(
      process.execPath,
      [
        "--import",
        resolve(root, "node_modules/tsx/dist/loader.mjs"),
        resolve(root, "scripts/agent-dispatch.ts"),
        operation,
        "--card",
        card,
        "--attempt",
        attempt,
        "--full",
        ...extra,
      ],
      { cwd: workspace, stdio: ["ignore", "pipe", "pipe"], timeout: 60_000 },
    );
    let output = "",
      error = "";
    processHandle.stdout.on("data", (data) => {
      output += data;
    });
    processHandle.stderr.on("data", (data) => {
      error += data;
    });
    processHandle.on("error", () => done(null));
    processHandle.on("close", (code) => {
      if (code !== 0) {
        console.error(error.trim() || "Attempt lifecycle failed.");
        done(null);
        return;
      }
      try {
        done(JSON.parse(output));
      } catch {
        done(null);
      }
    });
  });
const heartbeat = async () => Boolean(await lifecycle("heartbeat"));
// Progress checkpoints current tracked source through the same canonical dispatcher.
// Explicit new files should be added in the checkpoint command emitted by pickup.
const saved = await lifecycle("progress", [
  "--message",
  "Source preserved before bounded verification; acceptance remains unverified.",
]);
if (!saved?.card?.work_checkpoint || saved.card.work_checkpoint.attemptId !== attempt) {
  console.error("Current source checkpoint could not be recorded; no verification job started.");
  process.exit(1);
}
const child = spawn(command[0], command.slice(1), {
  cwd: workspace,
  stdio: "inherit",
  detached: process.platform !== "win32",
});
const childStartTime = process.platform === "win32" ? null : processStartTime(child.pid);
let escalation;
let ended = false,
  renewing = false,
  stopped = false;
function stop() {
  if (ended || stopped) return;
  stopped = true;
  const pid = child.pid;
  if (!pid) return;
  escalation = setTimeout(() => {
    if (ended) return;
    try {
      if (process.platform === "win32") child.kill("SIGKILL");
      else if (childStartTime && processStartTime(pid) === childStartTime)
        process.kill(-pid, "SIGKILL");
    } catch {
      /* owned job has exited */
    }
  }, 5000);
  try {
    if (process.platform === "win32") child.kill("SIGTERM");
    else process.kill(-child.pid, "SIGTERM");
  } catch {
    /* already exited */
  }
}
const deadline = setTimeout(stop, duration);
const interval = setInterval(async () => {
  if (ended || stopped || renewing) return;
  renewing = true;
  const valid = await heartbeat();
  renewing = false;
  if (!valid) stop();
}, 5 * 60_000);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, stop);
child.on("error", () => {
  ended = true;
  clearTimeout(deadline);
  clearTimeout(escalation);
  clearInterval(interval);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  ended = true;
  clearTimeout(deadline);
  clearTimeout(escalation);
  clearInterval(interval);
  process.exitCode = stopped ? 1 : (code ?? 1);
});
