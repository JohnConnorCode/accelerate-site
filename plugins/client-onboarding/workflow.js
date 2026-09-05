(() => {
  const input = workflowInput();
  const source = readSource("opportunity")[0];
  if (!source) throw new Error("Select a stored business record");
  if (source.stage !== "won") throw new Error("Onboarding requires a won opportunity");
  return {
    title: "Client onboarding: " + source.name,
    summary:
      "Create " +
      input.tasks.length +
      " assigned follow-up tasks with reviewed dates. Completed tasks from the same plan are reused on replay.",
    action: { type: "create_task_batch", payload: input },
  };
})();
