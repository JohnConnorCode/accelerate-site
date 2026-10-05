/** Reject PR merge/partial/skipped receipts. Every required workflow must prove this exact source. */
export function verifyReleaseCi(sourceCommit, workflows, evidence) {
  if (!/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error("Exact release source is required");
  for (const workflow of workflows) {
    const receipt = evidence.find((e) => e.workflow === workflow);
    const run = receipt?.run;
    if (
      !run ||
      run.head_sha !== sourceCommit ||
      run.status !== "completed" ||
      run.conclusion !== "success" ||
      !["push", "workflow_dispatch"].includes(run.event) ||
      run.head_branch !== "main" ||
      run.path !== `.github/workflows/${workflow}` ||
      !Number.isSafeInteger(run.id)
    )
      throw new Error(`Missing exact-source CI for ${workflow}`);
    const required =
      workflow === "ci.yml"
        ? [
            "checks",
            "build",
            "full-product-fork (missing)",
            "full-product-fork (example)",
            "neutral-starter",
            "verify",
          ]
        : ["connected-fork"];
    if (
      !required.every((name) =>
        receipt.jobs.some(
          (j) => j.name === name && j.status === "completed" && j.conclusion === "success",
        ),
      )
    )
      throw new Error(`Incomplete required jobs for ${workflow}`);
  }
  return {
    sourceCommit,
    workflows: evidence.map((e) => ({ workflow: e.workflow, runId: e.run.id })),
  };
}
