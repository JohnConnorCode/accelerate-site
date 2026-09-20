// The chooser now shares the public platform QA: six real workspaces, recipes,
// responsive themes, keyboard navigation and isolated appearance preferences.
if (process.env.PLAYWRIGHT_BASE_URL) process.env.QA_BASE = process.env.PLAYWRIGHT_BASE_URL;
await import("./qa-public-platform-value.mjs");
