import { execFileSync } from "node:child_process";
try {
  const processes = JSON.parse(
    execFileSync("pm2", ["jlist"], {
      timeout: 3000,
      maxBuffer: 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    }),
  );
  for (const name of ["frontend", "backend", "orchestrator"]) {
    if (
      !processes.some(
        (p) =>
          p.name === name &&
          p.pm2_env?.status === "online" &&
          Date.now() - p.pm2_env.pm_uptime > 15000,
      )
    )
      throw new Error("Process unavailable");
  }
  await Promise.all(
    ["http://localhost:5000", "http://localhost:3000/auth/can-register"].map(async (url) => {
      const response = await fetch(url, { signal: AbortSignal.timeout(3000), redirect: "follow" });
      if (!response.ok) throw new Error("HTTP unavailable");
      await response.body?.cancel();
    }),
  );
} catch {
  process.exit(1);
}
