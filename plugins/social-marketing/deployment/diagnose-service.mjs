// Bounded diagnostics for the disposable fixture stack only.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const args = ["compose", "-f", "compose.yaml", "-f", "verification.override.yaml"];
const secrets = [
  process.env.POSTIZ_DB_PASSWORD,
  process.env.TEMPORAL_DB_PASSWORD,
  process.env.POSTIZ_JWT_SECRET,
].filter(Boolean);
try {
  for (const fixture of JSON.parse(readFileSync("private-verification-fixtures.json", "utf8")))
    secrets.push(fixture.auth, fixture.key);
} catch {}
function clean(value) {
  let text = value;
  for (const secret of secrets) if (secret) text = text.split(secret).join("<redacted>");
  return text
    .replace(/(?:postgresql|redis):\/\/[^\s]+/g, "<redacted-connection>")
    .replace(/[A-Za-z0-9_-]{24,}/g, "<redacted>")
    .slice(0, 700);
}
function run(extra) {
  try {
    return execFileSync("docker", [...args, ...extra], {
      encoding: "utf8",
      timeout: 10000,
      maxBuffer: 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    return (error.stdout || "") + "\n" + (error.stderr || "");
  }
}
const probe = `
(async () => {
 let processes = [];
 try { processes = JSON.parse(require('child_process').execFileSync('pm2',['jlist'],{timeout:3000})).map(p=>({name:p.name,status:p.pm2_env?.status,restarts:p.pm2_env?.restart_time,uptimeSeconds:Math.floor((Date.now()-p.pm2_env?.pm_uptime)/1000)})); } catch {}
 const http = [];
 for(const [name,url] of [['frontend','http://localhost:5000'],['backend','http://localhost:3000/auth/can-register'],['temporal','http://localhost:3002/health/status']]) {
  try { const r=await fetch(url,{signal:AbortSignal.timeout(2000)}); http.push({name,status:r.status}); await r.body?.cancel(); } catch { http.push({name,status:'unreachable'}); }
 }
 console.log(JSON.stringify({processes,http}));
})()
`;
const state = run(["exec", "-T", "postiz", "node", "-e", probe]);
const errors = run(["logs", "--no-color", "--tail", "150", "postiz", "temporal"])
  .split("\n")
  .filter((line) => /error|fatal|exception|cannot|failed|invalid|unable/i.test(line))
  .slice(-50)
  .map(clean);
let health;
try {
  health = JSON.parse(state);
} catch {
  health = { probe: clean(state) };
}
const report = { health, errors };
writeFileSync("evidence/startup-diagnostics.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
