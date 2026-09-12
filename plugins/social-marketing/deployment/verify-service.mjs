import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
const origin = "http://localhost:5080";
const privateOrigin = "http://localhost:5000";
const phase = process.argv[2];
assert.ok(["bootstrap", "restart", "restore"].includes(phase));
const fixtureFile = "private-verification-fixtures.json";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1sAAAAASUVORK5CYII=",
  "base64",
);
async function request(path, options = {}) {
  const { privateBootstrap, ...init } = options;
  const response = await fetch((privateBootstrap ? privateOrigin : origin) + path, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  return response;
}
async function json(path, options = {}) {
  const response = await request(path, options);
  assert.ok(response.ok, `${path.split("?")[0]} returned ${response.status}`);
  return response.json();
}
function seedChannel(org, name) {
  // Only synthetic, unusable provider records in this disposable Compose stack.
  // Org registration and all draft reads/writes still use the real service API.
  const script = `
(async () => {
 const { PrismaClient } = require('@prisma/client'); const db = new PrismaClient();
 try {
  let input=''; for await (const chunk of process.stdin) input+=chunk;
  const {org,name}=JSON.parse(input);
  const row=await db.integration.create({data:{organizationId:org,internalId:'fixture-'+name,name:'Fixture '+name+' page',providerIdentifier:'linkedin-page',type:'social',token:'controlled-fixture-not-a-real-provider-token'},select:{id:true}});
  console.log(JSON.stringify(row));
 } finally { await db.$disconnect(); }
})().catch(()=>{process.stderr.write('Fixture seed failed');process.exit(1)});
`;
  try {
    return JSON.parse(
      execFileSync(
        "docker",
        [
          "compose",
          "-f",
          "compose.yaml",
          "-f",
          "verification.override.yaml",
          "exec",
          "-T",
          "postiz",
          "node",
          "-e",
          script,
        ],
        {
          input: JSON.stringify({ org, name }),
          encoding: "utf8",
          timeout: 15000,
          stdio: ["pipe", "pipe", "pipe"],
        },
      ),
    ).id;
  } catch {
    throw new Error(
      "Synthetic channel fixture could not be created; use sanitized service diagnostics.",
    );
  }
}
function draftBody(channel, content) {
  return {
    type: "draft",
    shortLink: false,
    date: new Date().toISOString(),
    tags: [],
    posts: [
      {
        integration: { id: channel },
        value: [{ content, image: [] }],
        settings: { __type: "linkedin-page" },
      },
    ],
  };
}
async function postsFor(fixture) {
  const query = new URLSearchParams({
    startDate: new Date(Date.now() - 86400000).toISOString(),
    endDate: new Date(Date.now() + 86400000).toISOString(),
  });
  return (await json(`/api/public/v1/posts?${query}`, { headers: { authorization: fixture.key } }))
    .posts;
}
let fixtures;
if (phase === "bootstrap") {
  fixtures = [];
  for (const name of ["alpha", "beta"]) {
    const registration = await request("/api/auth/register", {
      privateBootstrap: true,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "LOCAL",
        company: `Fixture ${name}`,
        email: `${name}@example.test`,
        password: randomBytes(24).toString("hex"),
      }),
    });
    assert.ok(registration.ok, `Fixture registration returned ${registration.status}`);
    const auth = registration.headers.get("auth");
    assert.ok(auth, "Local isolated registration must return auth header");
    const self = await json("/api/user/self", { headers: { auth } });
    assert.ok(self.publicApi && self.orgId);
    const form = new FormData();
    form.append("file", new Blob([png], { type: "image/png" }), `${name}.png`);
    const media = await json("/api/public/v1/upload", {
      method: "POST",
      headers: { authorization: self.publicApi },
      body: form,
    });
    assert.ok(media.id && new URL(media.path).origin === origin);
    const channel = seedChannel(self.orgId, name);
    const content = `Fixture ${name} draft — never publish`;
    const created = await json("/api/public/v1/posts", {
      method: "POST",
      headers: { authorization: self.publicApi, "content-type": "application/json" },
      body: JSON.stringify(draftBody(channel, content)),
    });
    assert.equal(created.length, 1);
    assert.equal(created[0].integration, channel);
    fixtures.push({
      auth,
      key: self.publicApi,
      org: self.orgId,
      media,
      channel,
      post: created[0].postId,
      content,
    });
  }
  writeFileSync(fixtureFile, JSON.stringify(fixtures), { mode: 0o600 });
} else fixtures = JSON.parse(readFileSync(fixtureFile, "utf8"));
assert.notEqual(fixtures[0].org, fixtures[1].org);
const invalid = await request("/api/public/v1/is-connected", {
  headers: { authorization: "invalid-fixture-key" },
});
assert.ok([401, 403].includes(invalid.status), "Invalid API credential refused");
for (const fixture of fixtures) {
  const headers = { authorization: fixture.key };
  const identity = await json("/api/public/v1/is-connected", { headers });
  assert.equal(identity.organizationId, fixture.org);
  assert.equal(identity.accelerateProtocol, 2);
  assert.deepEqual(
    (await json("/api/public/v1/integrations", { headers })).map((channel) => channel.id),
    [fixture.channel],
  );
  const ownPosts = await postsFor(fixture);
  assert.equal(ownPosts.length, 1, "Draft list must contain only this organization's record");
  assert.equal(ownPosts[0].id, fixture.post);
  assert.equal(ownPosts[0].content, fixture.content);
  assert.equal(ownPosts[0].state, "DRAFT", "Fixture content must remain unpublished");
  const mediaPath = new URL(fixture.media.path).pathname;
  const publicImage = await request(mediaPath);
  assert.equal(publicImage.status, 403, "The public proxy must refuse draft image URLs");
  const image = await request(mediaPath, { privateBootstrap: true });
  assert.equal(image.status, 200, "Stored fixture media must survive restart and restore");
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
}
for (const path of ["/api/auth/register", "/api/auth/REGISTER", "/api/auth/register/"]) {
  const registration = await request(path, { method: "POST" });
  assert.equal(registration.status, 403, "Public first-owner bootstrap is forbidden");
}
const foreignImage = await request("/api/public/v1/posts", {
  method: "POST",
  headers: { authorization: fixtures[1].key, "content-type": "application/json" },
  body: JSON.stringify({
    type: "draft",
    posts: [
      {
        integration: { id: "unconnected-fixture" },
        value: [{ content: "Never publish this fixture", image: [fixtures[0].media] }],
      },
    ],
  }),
});
assert.equal(foreignImage.status, 400);
assert.match(await foreignImage.text(), /Media is unavailable to this organization/);
const foreignChannel = await request(`/api/public/v1/integration-settings/${fixtures[0].channel}`, {
  headers: { authorization: fixtures[1].key },
});
assert.equal(foreignChannel.status, 404);
const foreignDraft = await request("/api/public/v1/posts", {
  method: "POST",
  headers: { authorization: fixtures[1].key, "content-type": "application/json" },
  body: JSON.stringify(draftBody(fixtures[0].channel, "Refuse foreign destination")),
});
assert.equal(foreignDraft.status, 400);
const foreignDelete = await request(`/api/public/v1/posts/${fixtures[0].post}`, {
  method: "DELETE",
  headers: { authorization: fixtures[1].key },
});
assert.equal(
  foreignDelete.status,
  404,
  "Foreign post deletion must be a scoped not-found response",
);
for (const fixture of fixtures) {
  const retained = await postsFor(fixture);
  assert.equal(retained.length, 1);
  assert.equal(retained[0].id, fixture.post);
  assert.equal(retained[0].state, "DRAFT");
}
if (phase === "restore")
  assert.equal(
    JSON.parse(readFileSync("evidence/temporal-restore.json", "utf8")).historyMatches,
    true,
  );
writeFileSync(
  `evidence/${phase}.json`,
  JSON.stringify(
    {
      phase,
      testedAt: new Date().toISOString(),
      organizations: 2,
      authenticatedIdentity: true,
      syntheticChannelAndDraftIsolation: true,
      foreignPostDeleteRefused: true,
      realLinkedInConnection: false,
      temporalHistoryRestored: phase === "restore",
      invalidCredentialRefused: true,
      storedUploadBytesMatch: true,
      publicUploadURLsDenied: true,
      foreignMediaRefused: true,
      publicRegistrationDenied: true,
      productionReady: false,
      remaining: [
        "Real LinkedIn authorization and an exact approved publication remain unverified; channel fixtures use unusable synthetic credentials.",
        ...(phase === "restore"
          ? []
          : ["Temporal history restoration is not yet verified at this stage."]),
        "Persistent-host and encrypted off-host backup restoration remain unverified.",
        "LinkedIn access and persistent HTTPS host are not configured.",
      ],
    },
    null,
    2,
  ),
);
console.log(
  `${phase}: two organization identities and stored image bytes verified; public media and bootstrap refused; foreign media reference refused`,
);
