import assert from "node:assert/strict";
import {
  MAX_DRIVE_FOLDERS,
  isWithinAllowlist,
  normalizeDriveFolderIds,
  staleAllowlistIds,
} from "../src/lib/revenue-os/drive-sync-plan";

assert.equal(MAX_DRIVE_FOLDERS, 10);

// Valid IDs survive trimmed, in first-seen order.
assert.deepEqual(
  normalizeDriveFolderIds(["  1AbC-_xYz0123456789abcdefg  ", "second_folder-0123456789"]),
  {
    ids: ["1AbC-_xYz0123456789abcdefg", "second_folder-0123456789"],
    rejected: [],
  },
);

// Blanks, non-strings, and bad charsets are rejected with reasons.
assert.deepEqual(
  normalizeDriveFolderIds([
    "ok_folder_0123456789",
    "",
    "   ",
    42,
    null,
    "a'b",
    "has space here",
    "has/slash",
  ]).ids,
  ["ok_folder_0123456789"],
);
assert.deepEqual(
  normalizeDriveFolderIds(["ok_folder_0123456789", "", 42, "a'b"]).rejected.map(
    (entry) => entry.reason,
  ),
  ["blank", "not_a_string", "invalid_format"],
);

// Duplicates keep the first occurrence; the cap reports the overflow.
const eleven = Array.from({ length: 11 }, (_, i) => `folder_${String(i).padStart(8, "0")}`);
assert.deepEqual(normalizeDriveFolderIds([...eleven, eleven[0]]).ids, eleven.slice(0, 10));
assert.deepEqual(
  normalizeDriveFolderIds([...eleven, eleven[0]]).rejected.map((entry) => entry.reason),
  ["over_limit", "duplicate"],
);

// Too-short and too-long IDs never reach a Drive query.
assert.deepEqual(
  normalizeDriveFolderIds(["short", "x".repeat(257)]).rejected.map((entry) => entry.reason),
  ["invalid_format", "invalid_format"],
);

// Non-array input normalizes to empty rather than throwing the settings path.
assert.deepEqual(normalizeDriveFolderIds(undefined), { ids: [], rejected: [] });
assert.deepEqual(normalizeDriveFolderIds("not-an-array"), { ids: [], rejected: [] });

// Ancestry: a file is storable only when a Drive parent is allowlisted.
assert.equal(isWithinAllowlist(["folder_A123456789", "other"], ["folder_A123456789"]), true);
assert.equal(isWithinAllowlist(["unrelated"], ["folder_A123456789"]), false);
assert.equal(isWithinAllowlist([], ["folder_A123456789"]), false);
assert.equal(isWithinAllowlist("folder_A123456789", ["folder_A123456789"]), false);
assert.equal(isWithinAllowlist(["folder_A123456789"], []), false);

// Stale detection: stored folders that left the allowlist, deduplicated.
assert.deepEqual(
  staleAllowlistIds(
    ["kept_folder_01", "gone_folder_02", "gone_folder_02", null, ""],
    ["kept_folder_01"],
  ),
  ["gone_folder_02"],
);
assert.deepEqual(staleAllowlistIds(["kept_folder_01"], ["kept_folder_01"]), []);

console.log(JSON.stringify({ result: "passed", maxFolders: MAX_DRIVE_FOLDERS }));
