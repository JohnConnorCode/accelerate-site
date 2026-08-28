import assert from "node:assert/strict";
import {
  EMAIL_LAYOUTS,
  blocksFromPlainText,
  parseStoredEmailBlocks,
  renderEmailBlocks,
  serializeEmailBlocks,
  validateEmailBlocks,
} from "../src/lib/email/blocks";

const layout = EMAIL_LAYOUTS[0];
assert.ok(layout);
const blocks = layout.blocks;
assert.deepEqual(parseStoredEmailBlocks(serializeEmailBlocks(blocks)), blocks);
assert.equal(validateEmailBlocks([{ id: "bad", type: "button", text: "Go", url: "javascript:alert(1)" }]), null);
assert.equal(blocksFromPlainText("One\n\nTwo").length, 2);

void (async () => {
  const rendered = await renderEmailBlocks(blocks, { name: "Maya", message: "Review the operating context." }, layout.previewText);
  assert.ok(rendered.html.includes("Maya") || rendered.text.includes("Maya"));
  assert.ok(rendered.text.includes("Review the operating context."));
  assert.ok(rendered.html.toLowerCase().includes("accelerate"));
  console.log("email block renderer contract passed");
})();
