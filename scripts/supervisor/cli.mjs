#!/usr/bin/env node
// Lightweight supervisor CLI: plain node, no dependencies, small modules only
// so status checks stay usable while the machine is under memory pressure.
import { audit, installed, loadConfig, saveConfig, stateDir } from "./state.mjs";
import { queueStatus, requestTicket, admitTicket, releaseTicket, clearStaleLock } from "./queue.mjs";
import {
  registerSession,
  heartbeatSession,
  findSession,
  listSessions,
} from "./sessions.mjs";
import { enforceOverload, pauseProducer, resumeProducer } from "./policy.mjs";
import { applyRecovery, planRecovery } from "./recover.mjs";
import {
  coverageReport,
  detectAdapters,
  enrollRepo,
  inventoryHeavyProcesses,
  unenrollRepo,
} from "./adapters.mjs";
import { evaluatePressure, samplePressure } from "./pressure.mjs";

function usage() {
  return `supervisor <command> [options]
  status [--json]              Machine queue, sessions, pressure, unmanaged jobs
  admit --repo <path> --kind <label> [--json]
                               Request and immediately admit a heavy slot (non-blocking)
  release --ticket <uuid>      Release a held or waiting ticket
  register --provider <id> --thread <tid> --pid <n> [--repo <p> --task <t>]
  heartbeat --thread <tid> --pid <n>
  pause --thread <tid>         SIGSTOP an owned session (preserves memory)
  resume --thread <tid>        SIGCONT a paused session
  recover [--clear-stale-lock] Plan/apply restart recovery, one session at a time
  enroll --repo <path>         Opt a repository into supervision (config only)
  unenroll --repo <path>
  coverage [--json]            Exact adapter coverage and bypasses
  install                      Create per-user state and enable heavy-job management
  uninstall                    Disable management; never touches sessions or repos`;
}

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith("--")) out[token.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    else (out._ = out._ || []).push(token);
  }
  return out;
}

function emit(result, code = 0) {
  console.log(JSON.stringify(result));
  process.exitCode = code;
}

function fail(message, extra = {}) {
  emit({ ok: false, error: message, ...extra }, 1);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const opts = args(rest);
  try {
    switch (command) {
      case "status": {
        const status = queueStatus();
        const sessions = listSessions();
        emit(
          {
            ok: true,
            stateDir: stateDir(),
            installed: installed(),
            queue: { level: status.level, reasons: status.reasons, holder: status.holder, waiting: status.waiting },
            pressure: status.pressure,
            sessions,
            unmanaged: inventoryHeavyProcesses().filter((job) => !job.managed),
          },
        );
        break;
      }
      case "admit": {
        if (!opts.repo) return fail("--repo is required.");
        const { ticket } = requestTicket({ repo: opts.repo, kind: opts.kind || "heavy" });
        const decision = admitTicket(ticket);
        if (!decision.admitted) {
          releaseTicket(ticket);
          return fail(decision.reason, { recovery: decision.recovery, level: decision.level, position: decision.position });
        }
        emit({ ok: true, ticket, repo: opts.repo });
        break;
      }
      case "release": {
        if (!opts.ticket) return fail("--ticket is required.");
        emit({ ok: true, ...releaseTicket(opts.ticket) });
        break;
      }
      case "register": {
        if (!opts.provider || !opts.thread || !opts.pid) return fail("--provider, --thread, and --pid are required.");
        const session = registerSession({
          provider: opts.provider,
          threadId: opts.thread,
          repo: opts.repo,
          worktree: opts.worktree,
          task: opts.task,
          pid: Number(opts.pid),
        });
        emit({ ok: true, threadId: session.threadId, pid: session.pid });
        break;
      }
      case "heartbeat": {
        if (!opts.thread || !opts.pid) return fail("--thread and --pid are required.");
        heartbeatSession(opts.thread, Number(opts.pid));
        emit({ ok: true, threadId: opts.thread });
        break;
      }
      case "pause":
      case "resume": {
        if (!opts.thread) return fail("--thread is required.");
        // findSession returns the stored registry row, which carries the
        // start-time identity pause/resume validation requires.
        const session = findSession(opts.thread);
        if (!session) return fail(`No live session for thread ${opts.thread}.`);
        const result = command === "pause" ? pauseProducer(session) : resumeProducer(session);
        emit({ ok: true, ...result });
        break;
      }
      case "recover": {
        if (opts["clear-stale-lock"]) {
          emit({ ok: true, ...clearStaleLock() });
          break;
        }
        const applied = applyRecovery();
        emit({ ok: true, applied });
        break;
      }
      case "plan-recovery": {
        emit({ ok: true, plan: planRecovery() });
        break;
      }
      case "enforce": {
        const status = queueStatus();
        const config = loadConfig();
        const result = await enforceOverload({
          level: status.level,
          reasons: status.reasons,
          allowDisposableCancel: config.disposableCancel,
        });
        emit({ ok: true, ...result });
        break;
      }
      case "enroll": {
        if (!opts.repo) return fail("--repo is required.");
        emit({ ok: true, ...enrollRepo(opts.repo) });
        break;
      }
      case "unenroll": {
        if (!opts.repo) return fail("--repo is required.");
        emit({ ok: true, ...unenrollRepo(opts.repo) });
        break;
      }
      case "coverage": {
        emit({ ok: true, ...coverageReport() });
        break;
      }
      case "adapters": {
        emit({ ok: true, adapters: detectAdapters() });
        break;
      }
      case "pressure": {
        const config = loadConfig();
        const sample = samplePressure();
        emit({ ok: true, sample, evaluation: evaluatePressure(sample, config.pressure) });
        break;
      }
      case "install": {
        saveConfig({ manageHeavyJobs: true });
        audit("supervisor.installed", {});
        emit({ ok: true, stateDir: stateDir(), manageHeavyJobs: true });
        break;
      }
      case "uninstall": {
        saveConfig({ manageHeavyJobs: false });
        audit("supervisor.uninstalled", {});
        emit({ ok: true, manageHeavyJobs: false });
        break;
      }
      default:
        console.log(usage());
        process.exitCode = command ? 2 : 0;
    }
  } catch (error) {
    fail(error.message);
  }
}

main();
