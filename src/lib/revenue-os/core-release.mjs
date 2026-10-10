import { createHash } from "node:crypto";
import { z } from "zod";
import policy from "../../../release-policy.json" with { type: "json" };

export const RELEASE_UPSTREAM = policy.upstream;
export const RELEASE_ASSET = "accelerate-release.json";
const sha = z.string().regex(/^[a-f0-9]{40}$/);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const version = z.string().regex(/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/);
const runtimeVersion = z.string().regex(/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/);
const migration = z
  .object({
    file: z.string().regex(/^(?:supabase|migrations)\/[a-zA-Z0-9_-]+\.sql$/),
    checksum: digest,
  })
  .strict();
export const releaseMetadataSchema = z
  .object({
    schemaVersion: z.literal(1),
    upstream: z.literal(RELEASE_UPSTREAM),
    version,
    sourceCommit: sha,
    notes: z.string().trim().min(1).max(16000),
    runtime: z
      .object({
        nodeMinimum: runtimeVersion,
        npmMinimum: runtimeVersion,
        postgresMinimum: runtimeVersion,
      })
      .strict(),
    migrations: z.object({ digest, catalog: z.array(migration).min(1).max(1000) }).strict(),
    extensions: z
      .object({ contractVersion: z.number().int().positive(), schemaDigest: digest })
      .strict(),
    supportedSourceVersions: z.array(version).max(100),
  })
  .strict();

export function catalogDigest(catalog) {
  return createHash("sha256").update(JSON.stringify(catalog)).digest("hex");
}

export function compareVersions(a, b) {
  const av = a.replace(/^v/, "").split(".").map(Number);
  const bv = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) if (av[i] !== bv[i]) return av[i] < bv[i] ? -1 : 1;
  return 0;
}

export function parseReleaseMetadata(raw) {
  const data = releaseMetadataSchema.parse(raw);
  if (
    catalogDigest(data.migrations.catalog) !== data.migrations.digest ||
    new Set(data.migrations.catalog.map((m) => m.file)).size !== data.migrations.catalog.length ||
    new Set(data.supportedSourceVersions).size !== data.supportedSourceVersions.length ||
    data.supportedSourceVersions.some((v) => compareVersions(v, data.version) >= 0)
  )
    throw new Error("Invalid migration identity or supported source versions");
  return data;
}

const apiRoot = `https://api.github.com/repos/${RELEASE_UPSTREAM}`;
const releaseRoot = `https://github.com/${RELEASE_UPSTREAM}/releases`;

/** Fixed public upstream only. No installation identity, credentials or telemetry is sent. */
export function githubReader(fetcher = fetch) {
  const budget = AbortSignal.timeout(20000);
  return async (path, { binary = false } = {}) => {
    let url = `${apiRoot}${path}`;
    for (let redirects = 0; redirects < 3; redirects++) {
      const response = await fetcher(url, {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.any([budget, AbortSignal.timeout(8000)]),
        headers: {
          Accept: binary ? "application/octet-stream" : "application/vnd.github+json",
          "X-GitHub-Api-Version": "2026-03-10",
        },
      });
      if (binary && [301, 302, 307, 308].includes(response.status)) {
        const target = new URL(response.headers.get("location") ?? "");
        if (
          target.protocol !== "https:" ||
          target.username ||
          target.password ||
          !["release-assets.githubusercontent.com", "objects.githubusercontent.com"].includes(
            target.hostname,
          )
        )
          throw new Error("Untrusted release asset redirect");
        url = target.href;
        continue;
      }
      if (!response.ok)
        throw new Error(
          [403, 429].includes(response.status) ? "rate_limited" : "upstream_unavailable",
        );
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Missing release response");
      const chunks = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 1000000) throw new Error("Release response exceeds limit");
          chunks.push(Buffer.from(value));
        }
      } finally {
        await reader.cancel();
      }
      const bytes = Buffer.concat(chunks);
      return binary ? bytes : JSON.parse(bytes.toString("utf8"));
    }
    throw new Error("Release redirect limit exceeded");
  };
}

export async function resolveReleaseCommit(read, tag) {
  version.parse(tag);
  const ref = await read(`/git/ref/tags/${encodeURIComponent(tag)}`);
  if (ref.ref !== `refs/tags/${tag}`) throw new Error("Unexpected release tag");
  let object = ref.object;
  for (let i = 0; i < 5 && object?.type === "tag"; i++) {
    sha.parse(object.sha);
    const annotated = await read(`/git/tags/${object.sha}`);
    if (annotated.sha !== object.sha) throw new Error("Unexpected annotated tag");
    object = annotated.object;
  }
  if (object?.type !== "commit") throw new Error("Release tag does not resolve to a commit");
  return sha.parse(object.sha);
}

export async function verifyPublishedRelease(read, release) {
  if (
    release.draft !== false ||
    release.prerelease !== false ||
    !release.published_at ||
    !Number.isFinite(Date.parse(release.published_at))
  )
    throw new Error("Unpublished release");
  version.parse(release.tag_name);
  if (
    release.html_url !== `${releaseRoot}/tag/${release.tag_name}` ||
    !Array.isArray(release.assets)
  )
    throw new Error("Release is outside the trusted upstream");
  const assets = release.assets.filter((a) => a.name === RELEASE_ASSET);
  const asset = assets[0];
  if (
    assets.length !== 1 ||
    !Number.isSafeInteger(asset.id) ||
    asset.id < 1 ||
    asset.state !== "uploaded" ||
    asset.size < 1 ||
    asset.size > 250000 ||
    asset.url !== `${apiRoot}/releases/assets/${asset.id}` ||
    !/^sha256:[a-f0-9]{64}$/.test(asset.digest ?? "")
  )
    throw new Error("Missing or malformed release metadata asset");
  const bytes = await read(`/releases/assets/${asset.id}`, { binary: true });
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.length !== asset.size ||
    `sha256:${createHash("sha256").update(bytes).digest("hex")}` !== asset.digest
  )
    throw new Error("Release asset checksum mismatch");
  const metadata = parseReleaseMetadata(JSON.parse(bytes.toString("utf8")));
  if (
    metadata.version !== release.tag_name ||
    metadata.sourceCommit !== (await resolveReleaseCommit(read, metadata.version))
  )
    throw new Error("Moved or mismatched release tag");
  return metadata;
}

function compatible(from, to, nodeVersion) {
  return (
    to.supportedSourceVersions.includes(from.version) &&
    to.extensions.contractVersion === from.extensions.contractVersion &&
    compareVersions(nodeVersion, to.runtime.nodeMinimum) >= 0 &&
    to.migrations.catalog.length >= from.migrations.catalog.length &&
    from.migrations.catalog.every(
      (m, i) =>
        m.file === to.migrations.catalog[i].file &&
        m.checksum === to.migrations.catalog[i].checksum,
    )
  );
}

/** Exact versions form a forward-only graph; no inferred semver compatibility. */
export function planReleaseUpgrade(installed, releases, nodeVersion) {
  if (!installed)
    return {
      status: "unknown",
      message: "Adopt a verified core release before checking an upgrade path.",
      path: [],
    };
  const current = releases.find((r) => r.version === installed.version);
  if (!current || JSON.stringify(current) !== JSON.stringify(installed))
    return {
      status: "unknown",
      message: "The installed core identity could not be verified against upstream.",
      path: [],
    };
  const sorted = [...releases].sort((a, b) => compareVersions(a.version, b.version));
  const latest = sorted.at(-1);
  if (!latest || compareVersions(latest.version, current.version) <= 0)
    return { status: "current", message: "No newer stable core release is published.", path: [] };
  const queue = [{ release: current, path: [] }];
  const visited = new Set([current.version]);
  while (queue.length) {
    const entry = queue.shift();
    for (const next of sorted) {
      if (visited.has(next.version) || !compatible(entry.release, next, nodeVersion)) continue;
      const path = [...entry.path, next.version];
      if (next.version === latest.version)
        return {
          status: "available",
          message:
            path.length > 1
              ? "A supported core path requires the listed bridge releases. Review backups and each release before updating."
              : "A supported core path is available. Review backups, runtime requirements and local changes before updating.",
          path,
        };
      visited.add(next.version);
      queue.push({ release: next, path });
    }
  }
  return {
    status: "incompatible",
    message:
      "The latest stable release has no supported path for this core version, migration history or runtime.",
    path: [],
  };
}

export async function discoverCoreReleases(
  identity,
  { read = githubReader(), now = () => new Date() } = {},
) {
  const checkedAt = now().toISOString();
  const base = {
    checkedAt,
    upstream: RELEASE_UPSTREAM,
    installed: identity,
    channel: "stable",
    releasesUrl: releaseRoot,
    target: null,
    path: [],
  };
  try {
    const feed = await read("/releases?per_page=100");
    if (!Array.isArray(feed) || feed.length >= 100) throw new Error("Release listing incomplete");
    const stable = feed.filter(
      (r) => r.draft === false && r.prerelease === false && version.safeParse(r.tag_name).success,
    );
    if (stable.length > 20) throw new Error("Release listing exceeds bounded discovery");
    const releases = [];
    for (const release of stable) releases.push(await verifyPublishedRelease(read, release));
    if (new Set(releases.map((r) => r.version)).size !== releases.length)
      throw new Error("Duplicate release version");
    if (identity.core && !releases.some((r) => r.version === identity.core.version))
      releases.push(
        await verifyPublishedRelease(read, await read(`/releases/tags/${identity.core.version}`)),
      );
    if (!releases.length)
      return {
        ...base,
        status: "unknown",
        message: "No verified stable core release is published yet.",
      };
    const plan = planReleaseUpgrade(identity.core, releases, identity.nodeVersion);
    const target = releases.find((r) => r.version === plan.path.at(-1));
    return {
      ...base,
      ...plan,
      target: target
        ? {
            version: target.version,
            sourceCommit: target.sourceCommit,
            url: `${releaseRoot}/tag/${target.version}`,
            runtime: target.runtime,
            migrationDigest: target.migrations.digest,
            extensionContract: target.extensions.contractVersion,
          }
        : null,
    };
  } catch (error) {
    return {
      ...base,
      status: "unavailable",
      message:
        error?.message === "rate_limited"
          ? "Upstream rate limit reached. Retry later; no update was verified."
          : "Release information could not be verified. Retry later or inspect the upstream releases.",
    };
  }
}
