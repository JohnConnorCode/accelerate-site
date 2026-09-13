// Run on the chosen host with owner credentials supplied by its secret manager.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const bundled = process.argv.includes("--package");
process.chdir(fileURLToPath(new URL(bundled ? "../../../" : ".", import.meta.url)));
const email = process.env.POSTIZ_OWNER_EMAIL;
const password = process.env.POSTIZ_OWNER_PASSWORD;
const company = process.env.POSTIZ_OWNER_COMPANY;
if (
  !email ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
  !password ||
  password.length < 16 ||
  password.length > 64 ||
  !company ||
  company.length < 3 ||
  company.length > 128
) {
  throw new Error(
    "Supply POSTIZ_OWNER_EMAIL, POSTIZ_OWNER_COMPANY (3–128 characters), and POSTIZ_OWNER_PASSWORD (16–64 characters) through private environment configuration.",
  );
}
// Refuse an unresolved release before sending credentials to its container.
if (bundled)
  execFileSync(
    "docker",
    ["compose", "exec", "-T", "postiz", "node", "/opt/accelerate-healthcheck.mjs"],
    { stdio: "inherit", timeout: 15000 },
  );
else execFileSync("bash", ["./validate-release.sh"], { stdio: "inherit" });
const input = JSON.stringify({ email, password, company, provider: "LOCAL" });
const script = `
(async () => {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const response = await fetch('http://localhost:3000/auth/register', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: input,
    signal: AbortSignal.timeout(15000), redirect: 'error'
  });
  if (!response.ok) throw new Error('Owner registration refused; inspect registration configuration on the chosen host.');
  const result = await response.json();
  if (result.activate === true) console.log('Registration requires email activation. Complete activation before signing in.');
  else if (result.register === true) console.log('Owner registered. Sign in through the HTTPS setup interface; public registration remains denied.');
  else throw new Error('Registration returned an unrecognized receipt.');
})().catch(() => { console.error('Owner registration was not verified. Do not retry without checking the chosen host.'); process.exit(1); });
`;
// Password travels over stdin, never command arguments; JWT/cookies never leave the container.
try {
  const receipt = execFileSync(
    "docker",
    ["compose", "exec", "-T", "postiz", "node", "-e", script],
    { input, timeout: 20000, maxBuffer: 4096, stdio: ["pipe", "pipe", "pipe"] },
  );
  process.stdout.write(receipt);
} catch {
  throw new Error(
    "Owner registration was not verified. Check the chosen host before retrying; no credentials or provider response were logged.",
  );
}
