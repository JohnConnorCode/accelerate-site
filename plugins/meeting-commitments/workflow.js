(() => {
  const input = workflowInput();
  const source = readSource("meeting")[0];
  if (!source) throw new Error("Select a stored business record");

  return {
    title: "Meeting commitments: " + source.title,
    summary:
      "Create " +
      input.tasks.length +
      " assigned follow-up tasks with reviewed dates. Completed tasks from the same plan are reused on replay.",
    action: { type: "create_task_batch", payload: input },
  };
})();
