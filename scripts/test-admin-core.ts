import assert from "node:assert/strict";
import { adminPageComposition } from "../src/lib/admin/page-composition";
const cases = [
  ["/admin/today", "overview"],
  ["live:/admin/settings", "settings"],
  ["hearthline-realty:/admin/contacts", "collection"],
  ["/t/example/admin/pipeline", "board"],
  ["/demo/command-center/hearthline-realty/conversations", "workspace"],
  ["/demo/command-center/hearthline-realty/contacts/person%40example.com?tab=notes", "workspace"],
  ["/t/example/admin/site/website", "settings"],
  ["/admin/new-app", "collection"],
] as const;
for (const [path, composition] of cases)
  assert.equal(adminPageComposition(path), composition, path);
console.log("Admin core: tenant, demo, detail, query and extension compositions pass.");
