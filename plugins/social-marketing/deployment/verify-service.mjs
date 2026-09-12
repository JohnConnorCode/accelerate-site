import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
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
    fixtures.push({ auth, key: self.publicApi, org: self.orgId, media });
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
  assert.deepEqual(await json("/api/public/v1/integrations", { headers }), []);
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
writeFileSync(
  `evidence/${phase}.json`,
  JSON.stringify(
    {
      phase,
      testedAt: new Date().toISOString(),
      organizations: 2,
      authenticatedIdentity: true,
      invalidCredentialRefused: true,
      storedUploadBytesMatch: true,
      publicUploadURLsDenied: true,
      foreignMediaRefused: true,
      publicRegistrationDenied: true,
      productionReady: false,
      remaining: [
        "Real connected-page and publication isolation require provider fixtures.",
        "Temporal history and full host restoration remain unverified.",
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
