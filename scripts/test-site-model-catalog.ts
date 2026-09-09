import {
  siteJsonEnvelopeSchema,
  decodeSiteJsonEnvelope,
} from "../src/lib/site-studio/structured-output";
import assert from "node:assert/strict";
import {
  parseSiteModelCatalog,
  recommendedSiteModelIds,
  sitePriceCeilingSchema,
  enforceSitePriceCeiling,
  SITE_STUDIO_MODELS,
  SITE_MODEL_RECOMMENDATIONS,
  DEFAULT_SITE_MODEL,
} from "../src/lib/site-studio/models";
import { getSiteModelCatalog, resolveSiteModel } from "../src/lib/site-studio/model-catalog";
import { resolveModelForJob, registerModel } from "../src/lib/ai/model-registry";
import { MemorySupabase } from "./lib/memory-supabase";

const fixture = (patch: Record<string, unknown> = {}) => ({
  id: "fixture/future-model",
  name: "Fixture: Future Model",
  created: 1234,
  context_length: 64000,
  architecture: { input_modalities: ["text"], output_modalities: ["text"] },
  supported_parameters: ["structured_outputs", "response_format", "max_tokens", "reasoning"],
  pricing: { prompt: "0.0000002", completion: "0.0000004" },
  reasoning: { mandatory: false, supported_efforts: ["none", "high"] },
  ...patch,
});
async function main() {
  assert.equal(JSON.stringify(siteJsonEnvelopeSchema).includes("anyOf"), false);
  assert.deepEqual(decodeSiteJsonEnvelope({ documentJson: '{"root":[]}' }), { root: [] });
  assert.throws(() => decodeSiteJsonEnvelope({ documentJson: "not JSON" }));
  assert.throws(() => decodeSiteJsonEnvelope({ documentJson: "{}", unexpected: true }));
  assert.throws(() => decodeSiteJsonEnvelope({ documentJson: "x".repeat(120001) }));
  for (const id of SITE_MODEL_RECOMMENDATIONS)
    assert.ok(
      SITE_STUDIO_MODELS.some((model) => model.id === id),
      id,
    );
  assert.equal(DEFAULT_SITE_MODEL, "meta/muse-spark-1.3");
  const excluded = [
    fixture({ id: "fixture/batch:batch" }),
    fixture({ id: "fixture/contributor" }),
    fixture({ id: "fixture/no-json", supported_parameters: ["response_format", "max_tokens"] }),
    fixture({ id: "fixture/expired", expiration_date: "2020-01-01" }),
    fixture({ id: "fixture/negative", pricing: { prompt: "-1", completion: "0" } }),
    fixture({ id: "fixture/unknown-price", pricing: { prompt: "", completion: "NaN" } }),
    fixture({ id: "fixture/request-fee", pricing: { prompt: "0", completion: "0", request: "1" } }),
    fixture({
      id: "fixture/image",
      architecture: { input_modalities: ["text"], output_modalities: ["text", "image"] },
    }),
    fixture({ id: "fixture/tiny", context_length: 1000 }),
    fixture({ id: "fixture/short-output", top_provider: { max_completion_tokens: 1024 } }),
  ];
  const parsed = parseSiteModelCatalog({ data: [fixture(), ...excluded] });
  assert.equal(parsed.length, 1);
  const fixtureModel = parsed[0];
  assert.ok(fixtureModel);
  const futureOpus = {
    ...fixtureModel,
    id: "anthropic/claude-opus-future",
    created: Number.MAX_SAFE_INTEGER,
  };
  const recommendations = recommendedSiteModelIds([...SITE_STUDIO_MODELS, futureOpus]);
  assert.ok(recommendations.includes(futureOpus.id));
  assert.ok(!recommendations.includes("anthropic/claude-opus-5"));
  assert.equal(recommendations[0], DEFAULT_SITE_MODEL);
  assert.equal(fixtureModel.reasoningEffort, "none");
  assert.equal(fixtureModel.supportsTemperature, false);
  assert.equal(fixtureModel.prompt, 0.2);
  assert.throws(
    () => enforceSitePriceCeiling(fixtureModel, { prompt: 0.1, completion: 0.4, request: 0 }),
    /price increased/,
  );
  assert.equal(
    sitePriceCeilingSchema.safeParse({ prompt: Infinity, completion: 0, request: 0 }).success,
    false,
  );
  assert.equal(
    parseSiteModelCatalog({
      data: [fixture({ pricing: { prompt: "2e-7", completion: "4e-7" } })],
    })[0]?.prompt,
    0.2,
  );
  const realFetch = globalThis.fetch;
  const realNow = Date.now;
  let now = realNow();
  let calls = 0;
  Date.now = () => now;
  try {
    globalThis.fetch = async () => {
      calls++;
      throw new Error("offline");
    };
    assert.equal((await getSiteModelCatalog()).source, "bundled");
    assert.equal((await getSiteModelCatalog(true)).source, "bundled");
    assert.equal(calls, 1, "failed refresh has a cooldown");
    now += 31000;
    globalThis.fetch = async (url, init) => {
      calls++;
      assert.equal(String(url), "https://openrouter.ai/api/v1/models");
      assert.equal(init?.redirect, "error");
      assert.ok(init?.signal);
      assert.equal(init?.headers, undefined, "catalogue requests contain no tenant credentials");
      return new Response(JSON.stringify({ data: [fixture()] }));
    };
    const [a, b] = await Promise.all([getSiteModelCatalog(true), getSiteModelCatalog(true)]);
    assert.equal(a.source, "live");
    assert.deepEqual(a, b);
    assert.equal(calls, 2);
    const ceiling = { prompt: 0.2, completion: 0.4, request: 0 as const };
    const options = await resolveSiteModel("fixture/future-model", ceiling);
    assert.equal(options.model, "fixture/future-model");
    assert.equal(options.temperature, null);
    assert.deepEqual(options.reasoning, { effort: "none", exclude: true });
    await assert.rejects(() => resolveSiteModel("fixture/future-model"), /review its price/);
    await assert.rejects(
      () => resolveSiteModel(DEFAULT_SITE_MODEL),
      /unavailable or incompatible/,
      "retired models are not silently restored from the snapshot",
    );
    const db = new MemorySupabase({ admin_settings: [], activities: [] }).client as never;
    assert.equal(
      (await resolveModelForJob(db, "tenant-a", "site-page-draft", "fixture/future-model"))
        .resolved,
      "fixture/future-model",
    );
    await assert.rejects(
      () => resolveModelForJob(db, "tenant-a", "copilot-answer", "fixture/future-model"),
      /not registered/,
    );
    await registerModel(db, {
      tenantId: "tenant-a",
      id: "fixture/future-model",
      supportsJson: false,
      actorEmail: "owner@example.test",
    });
    await assert.rejects(
      () => resolveModelForJob(db, "tenant-a", "site-page-draft", "fixture/future-model"),
      /needs JSON mode/,
    );
    now += 301000;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          data: [fixture({ pricing: { prompt: "0.0000003", completion: "0.0000004" } })],
        }),
      );
    await assert.rejects(
      () => resolveSiteModel("fixture/future-model", ceiling),
      /price increased/,
    );
    now += 301000;
    globalThis.fetch = async () => new Response("x".repeat(4 * 1024 * 1024 + 1));
    const cached = await getSiteModelCatalog();
    assert.equal(cached.source, "cached");
    assert.equal(
      cached.models[0]?.prompt,
      0.3,
      "oversized refresh cannot replace validated metadata",
    );
  } finally {
    globalThis.fetch = realFetch;
    Date.now = realNow;
  }
  console.log(
    "PASS model catalogue: compatibility, current recommendations, dynamic new models, price review, retirement, bounded refresh, offline recovery, tenant restrictions and job isolation",
  );
}
void main();
