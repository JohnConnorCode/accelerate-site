/** Read-only canonical schema/connection probe. Never claims or prints card contents. */
import { createLocalWorkRequest, localWorkActor } from "./lib/local-work-board";
import { requireBoardProtocol } from "./lib/developer-workspace.mjs";
async function main() {
  const project = process.argv[2];
  const result = await createLocalWorkRequest(project)("?limit=1");
  requireBoardProtocol(result);
  console.log(
    JSON.stringify({
      protocolVersion: 2,
      schemaReady: true,
      features: [],
      transport: "local-operator",
      access: { scopes: localWorkActor(project).scopes },
      canonicalWrites: true,
    }),
  );
}
main().catch(() => {
  console.error(
    "The configured local board did not pass its read-only schema/connection check; no card was claimed.",
  );
  process.exitCode = 1;
});
