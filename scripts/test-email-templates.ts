#!/usr/bin/env tsx
/**
 * None of the seven modules under `src/lib/email/` had an executing test, and
 * this is the code that writes what a prospect actually reads.
 *
 * The two failure modes worth catching:
 *
 *   - **Placeholder leakage.** `replaceEmailVariables` leaves `{{key}}` in the
 *     body when a variable is missing. That is a defensible choice (a visible
 *     `{{name}}` is at least noticeable, where a silently empty greeting is
 *     not) but only if it can never reach a real inbox. The way it reaches one
 *     is drift: a body uses a variable the definition does not declare, so no
 *     caller ever passes it and every send of that template leaks. That is
 *     checkable statically, across every registered template, and it is what
 *     most of this file does.
 *   - **A blank transactional email.** `resolveEmailTemplate` prefers the
 *     database-published version and falls back to the built-in one. The whole
 *     point of that fallback is that a database failure must not blank
 *     transactional mail, so the fallback needs to be exercised rather than
 *     assumed.
 */
import assert from "node:assert/strict";
import {
  EMAIL_TEMPLATE_DEFINITIONS,
  getEmailTemplateDefinition,
  renderDefinition,
  replaceEmailVariables,
} from "../src/lib/email/registry";

/** Every `{{placeholder}}` appearing in a string. */
function placeholders(template: string): string[] {
  return [...template.matchAll(/\{\{([A-Za-z0-9_]+)\}\}/g)].map((match) => match[1]!);
}

async function main() {
  assert.ok(EMAIL_TEMPLATE_DEFINITIONS.length > 0, "no email templates registered, so nothing below is being checked");

  const drift: string[] = [];
  const leaks: string[] = [];

  for (const definition of EMAIL_TEMPLATE_DEFINITIONS) {
    const declared = new Set(definition.variables);
    const used = new Set([...placeholders(definition.subjectTemplate), ...placeholders(definition.bodyTemplate)]);

    // A variable the body uses but the definition does not declare is never
    // offered in the editor and never passed by a caller, so every send of this
    // template ships a literal `{{key}}` to whoever receives it.
    for (const key of used) {
      if (!declared.has(key)) drift.push(`${definition.key}: uses {{${key}}} but does not declare it in variables[], so no caller passes it and it leaks into the sent email`);
    }

    // The reverse is milder but still wrong: a declared variable nothing uses
    // is a stale contract that misleads whoever edits the template next.
    for (const key of declared) {
      if (!used.has(key)) drift.push(`${definition.key}: declares "${key}" in variables[] but no template uses it`);
    }

    assert.ok(definition.subjectTemplate.trim(), `${definition.key} has an empty subject; a blank subject line reads as spam`);
    assert.ok(definition.bodyTemplate.trim(), `${definition.key} has an empty body`);

    // Rendering with the full declared set must leave nothing behind. This is
    // the property that matters at send time.
    const complete = Object.fromEntries([...used].map((key) => [key, `value-${key}`]));
    const rendered = renderDefinition(definition, complete);
    for (const [field, value] of [["subject", rendered.subject], ["text", rendered.text], ["html", rendered.html]] as const) {
      const remaining = placeholders(value);
      if (remaining.length) leaks.push(`${definition.key}: ${field} still contains ${remaining.map((key) => `{{${key}}}`).join(", ")} after rendering with every declared variable`);
    }

    // sampleData drives the template preview in the admin editor. If it does
    // not cover the template, the founder approves a preview full of raw
    // placeholders and has no idea what the real email looks like.
    const preview = renderDefinition(definition);
    const previewLeaks = [...placeholders(preview.subject), ...placeholders(preview.text)];
    if (previewLeaks.length) {
      drift.push(`${definition.key}: sampleData does not cover ${[...new Set(previewLeaks)].map((key) => `{{${key}}}`).join(", ")}, so the admin preview shows raw placeholders`);
    }
  }

  if (drift.length || leaks.length) {
    console.error(`Email template contract failed with ${drift.length + leaks.length} issue(s):`);
    for (const issue of [...leaks, ...drift]) console.error(`- ${issue}`);
    process.exitCode = 1;
    return;
  }

  // ---- The substitution itself -----------------------------------------

  assert.equal(replaceEmailVariables("Hi {{name}}, re {{topic}}.", { name: "Dana", topic: "intake" }), "Hi Dana, re intake.");
  assert.equal(
    replaceEmailVariables("Hi {{name}}.", {}),
    "Hi {{name}}.",
    "a missing variable deliberately leaves the placeholder visible rather than silently blanking the sentence; the drift checks above are what stop that reaching an inbox",
  );
  assert.equal(replaceEmailVariables("Hi {{name}}.", { name: "" }), "Hi .", "an explicitly empty value is a caller's decision and is honoured");
  assert.equal(replaceEmailVariables("Cost is $1,000 {{note}}", { note: "" }), "Cost is $1,000 ", "text around a placeholder must be preserved exactly");
  assert.equal(replaceEmailVariables("No placeholders here.", {}), "No placeholders here.");
  assert.equal(
    replaceEmailVariables("{{name}} and {{name}} again", { name: "Dana" }),
    "Dana and Dana again",
    "every occurrence must be replaced, not just the first",
  );

  // ---- The registry lookup ---------------------------------------------

  assert.equal(getEmailTemplateDefinition("definitely-not-a-template"), null, "an unknown key must return null so the caller can fail loudly");
  const known = EMAIL_TEMPLATE_DEFINITIONS[0]!;
  assert.equal(getEmailTemplateDefinition(known.key)?.key, known.key);

  const keys = EMAIL_TEMPLATE_DEFINITIONS.map((definition) => definition.key);
  assert.equal(new Set(keys).size, keys.length, `duplicate template keys: lookup returns the first match, so a duplicate silently shadows another template. Keys: ${keys.join(", ")}`);

  // ---- The built-in fallback --------------------------------------------

  // resolveEmailTemplate is imported lazily: it pulls in the Supabase server
  // client, which throws at import time without credentials. With none present
  // the published lookup fails and the built-in path is what answers, which is
  // exactly the database-failure case the fallback exists for.
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { resolveEmailTemplate } = await import("../src/lib/email/runtime-template");

  const fallback = await resolveEmailTemplate("contact-confirmation", { name: "Dana" });
  assert.equal(fallback.source, "built_in", "with no database reachable the built-in template must answer");
  assert.equal(fallback.versionId, null, "a built-in render has no published version to attribute");
  assert.ok(fallback.subject.trim(), "a transactional email must never go out with a blank subject, database or not");
  assert.ok(fallback.text.trim(), "a transactional email must never go out with a blank body; that is the entire purpose of this fallback");
  assert.ok(fallback.html.trim(), "the HTML part must be populated too");
  assert.match(fallback.subject, /Dana/, "the fallback must still substitute variables, not just return the raw template");
  assert.deepEqual(placeholders(fallback.text), [], "the fallback body must not leak placeholders");

  await assert.rejects(
    () => resolveEmailTemplate("definitely-not-a-template", {}),
    /Unknown email template/,
    "an unknown template must throw rather than sending an empty email",
  );

  console.log(JSON.stringify({
    templates: EMAIL_TEMPLATE_DEFINITIONS.length,
    checks: ["no-undeclared-variables", "no-stale-declarations", "renders-without-leakage", "sample-data-covers-preview", "substitution-semantics", "unique-keys", "unknown-key-throws", "built-in-fallback-never-blank"],
    result: "passed",
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
