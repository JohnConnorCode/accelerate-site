import assert from "node:assert/strict";
import { getPublicRoadmapCards, getPublicRoadmapState } from "../src/lib/roadmap";
import { POST } from "../src/app/api/roadmap/route";
import { NextRequest } from "next/server";
async function main() {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    globalThis.fetch = async () => {
      calls++;
      throw new Error("No network expected");
    };
    assert.deepEqual(await getPublicRoadmapCards(), []);
    assert.deepEqual(await getPublicRoadmapState(), { cards: [], availability: "unconfigured" });
    const result = await POST(
      new NextRequest("http://localhost/api/roadmap", {
        method: "POST",
        body: JSON.stringify({ title: "Example", description: "Example" }),
      }),
    );
    assert.equal(result.status, 503);
    assert.equal(calls, 0);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://configured.example";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-key";
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify([
          {
            seed_key: "example",
            title: "Example",
            description: "A real configured record",
            status: "planned",
            priority: "high",
            labels: ["category:platform"],
            acceptance_criteria: "Actual acceptance",
          },
          {
            seed_key: "private",
            title: "Untriaged",
            status: "backlog",
            priority: "low",
            labels: [],
          },
        ]),
        { headers: { "content-type": "application/json" } },
      );
    const ready = await getPublicRoadmapState();
    assert.equal(ready.availability, "ready");
    assert.equal(ready.cards.length, 1);
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: "unavailable" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    assert.deepEqual(await getPublicRoadmapState(), { cards: [], availability: "unavailable" });
    console.log(
      "PASS public roadmap: no-credential/no-network state, submission refusal, configured filtering and honest outage state.",
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
}
void main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
