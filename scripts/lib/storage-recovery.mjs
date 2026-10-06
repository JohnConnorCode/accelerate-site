import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const limit = 100_000_000;
const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const objectFile = (bucket, path) => `${hash(`${bucket}\0${path}`)}.bin`;
export class RecoveryError extends Error {}
const fail = (message) => {
  throw new RecoveryError(message);
};
function identity(project, origin) {
  let url;
  try {
    url = new URL(origin);
  } catch {
    fail("Recovery API origin is invalid.");
  }
  if (
    !/^[a-z0-9-]{1,80}$/.test(project) ||
    url.origin !== origin ||
    !["http:", "https:"].includes(url.protocol) ||
    (url.protocol === "http:" && !loopback.has(url.hostname))
  )
    fail("Recovery project identity is invalid.");
  return url;
}

async function inventory(storage) {
  const { data: buckets, error } = await storage.listBuckets();
  if (error || !buckets)
    fail("Storage inventory failed. Check project access; no copy is complete.");
  const objects = [];
  for (const bucket of buckets) {
    const prefixes = [""];
    for (let index = 0; index < prefixes.length; index++) {
      const prefix = prefixes[index];
      for (let offset = 0; ; offset += 100) {
        const { data, error } = await storage.from(bucket.id).list(prefix, {
          limit: 100,
          offset,
          sortBy: { column: "name", order: "asc" },
        });
        if (error || !data) fail("Storage listing failed. Rerun after restoring provider access.");
        for (const entry of data) {
          const path = prefix ? `${prefix}/${entry.name}` : entry.name;
          if (!entry.id && !entry.metadata) {
            if (prefixes.includes(path) || path.split("/").length > 32)
              fail("Storage folder inventory is invalid.");
            prefixes.push(path);
          } else {
            const size = Number(entry.metadata?.size);
            if (!Number.isSafeInteger(size) || size < 0 || size > limit)
              fail(
                "Storage file exceeds the 100 MB recovery limit. Use the provider's S3 export for larger files.",
              );
            objects.push({
              bucket: bucket.id,
              path,
              size,
              contentType: entry.metadata?.mimetype || "application/octet-stream",
              updatedAt: entry.updated_at,
            });
          }
          if (prefixes.length + objects.length > 25_000)
            fail("Storage inventory exceeds the bounded recovery command. Use an S3 export.");
        }
        if (data.length < 100) break;
      }
    }
  }
  return {
    buckets: buckets
      .map(({ id, public: isPublic, file_size_limit, allowed_mime_types }) => ({
        id,
        public: isPublic,
        fileSizeLimit: file_size_limit ?? null,
        allowedMimeTypes: allowed_mime_types ?? null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    objects: objects.sort((a, b) => `${a.bucket}/${a.path}`.localeCompare(`${b.bucket}/${b.path}`)),
  };
}

async function bytes(storage, object) {
  const { data, error } = await storage.from(object.bucket).download(object.path);
  if (error || !data)
    fail(
      "Storage download failed. The backup is incomplete; retain it for diagnosis and use a new directory on retry.",
    );
  const value = Buffer.from(await data.arrayBuffer());
  if (value.length !== object.size || value.length > limit)
    fail("Storage changed during download. Pause uploads and create a new snapshot.");
  return value;
}

/** Private byte copy; project keys and file paths never enter the public receipt. */
export async function backupStorage(storage, project, directory, { origin = "" } = {}) {
  identity(project, origin);
  const root = resolve(directory);
  try {
    await mkdir(root, { mode: 0o700 }); // Refuse an existing or partial snapshot.
  } catch (error) {
    fail(
      error.code === "EEXIST"
        ? "Backup destination already exists. Retain the previous copy and select a new directory."
        : "Cannot create the private backup directory. Check its parent directory and write permission.",
    );
  }
  await mkdir(join(root, "objects"), { mode: 0o700 });
  const capturedAt = new Date().toISOString();
  const before = await inventory(storage);
  const objects = [];
  for (const object of before.objects) {
    const value = await bytes(storage, object);
    const file = objectFile(object.bucket, object.path);
    await writeFile(join(root, "objects", file), value, { flag: "wx", mode: 0o600 });
    objects.push({ ...object, file, sha256: hash(value) });
  }
  if (JSON.stringify(before) !== JSON.stringify(await inventory(storage)))
    fail("Storage inventory changed during backup. Pause uploads and create a new snapshot.");
  const manifest = {
    version: 1,
    project,
    origin,
    capturedAt,
    completedAt: new Date().toISOString(),
    buckets: before.buckets,
    objects,
  };
  await writeFile(join(root, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  return { files: objects.length, bytes: objects.reduce((sum, o) => sum + o.size, 0), capturedAt };
}

async function readManifest(directory) {
  const root = resolve(directory);
  const directoryInfo = await lstat(root);
  const manifestPath = join(root, "manifest.json");
  const info = await lstat(manifestPath);
  if (
    !directoryInfo.isDirectory() ||
    directoryInfo.isSymbolicLink() ||
    directoryInfo.mode & 0o077 ||
    !info.isFile() ||
    info.isSymbolicLink() ||
    info.size > 16_000_000 ||
    info.mode & 0o077
  )
    fail("Recovery copy must be a private directory with a private regular manifest.");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (
    manifest.version !== 1 ||
    typeof manifest.project !== "string" ||
    !manifest.project ||
    !Array.isArray(manifest.buckets) ||
    !Array.isArray(manifest.objects) ||
    manifest.objects.length > 25_000
  )
    fail("Unsupported or invalid Storage recovery manifest.");
  identity(manifest.project, manifest.origin);
  const buckets = new Set();
  for (const bucket of manifest.buckets) {
    if (
      typeof bucket.id !== "string" ||
      !bucket.id ||
      buckets.has(bucket.id) ||
      typeof bucket.public !== "boolean" ||
      (bucket.fileSizeLimit !== null &&
        (!Number.isSafeInteger(bucket.fileSizeLimit) || bucket.fileSizeLimit < 0)) ||
      (bucket.allowedMimeTypes !== null &&
        (!Array.isArray(bucket.allowedMimeTypes) ||
          bucket.allowedMimeTypes.some((v) => typeof v !== "string")))
    )
      fail("Invalid recovery bucket policy.");
    buckets.add(bucket.id);
  }
  const seen = new Set();
  for (const object of manifest.objects) {
    if (
      typeof object.path !== "string" ||
      !object.path ||
      !buckets.has(object.bucket) ||
      !Number.isSafeInteger(object.size) ||
      object.size < 0 ||
      object.size > limit ||
      typeof object.contentType !== "string" ||
      !object.contentType ||
      !/^[a-f0-9]{64}$/.test(object.sha256) ||
      object.file !== objectFile(object.bucket, object.path) ||
      seen.has(object.file)
    )
      fail("Invalid recovery file record.");
    seen.add(object.file);
    const path = join(root, "objects", object.file);
    const info = await lstat(path);
    const parent = await lstat(join(root, "objects"));
    if (
      !parent.isDirectory() ||
      parent.isSymbolicLink() ||
      parent.mode & 0o077 ||
      !info.isFile() ||
      info.isSymbolicLink() ||
      info.mode & 0o077 ||
      info.size !== object.size ||
      hash(await readFile(path)) !== object.sha256
    )
      fail("Recovery file is missing, unsafe or corrupt. No files were restored.");
  }
  return manifest;
}

/** Plans are read-only. Writes never upsert; a concurrent conflicting upload also fails. */
export async function restoreStorage(
  storage,
  project,
  directory,
  { apply = false, origin = "" } = {},
) {
  const destination = identity(project, origin);
  const manifest = await readManifest(directory);
  const source = identity(manifest.project, manifest.origin);
  if (
    project === manifest.project ||
    origin === manifest.origin ||
    (loopback.has(source.hostname) &&
      loopback.has(destination.hostname) &&
      source.protocol === destination.protocol &&
      source.port === destination.port)
  )
    fail("Restore requires a different explicitly selected project and API origin.");
  const target = await inventory(storage);
  for (const bucket of target.buckets) {
    const source = manifest.buckets.find((b) => b.id === bucket.id);
    if (!source || JSON.stringify(source) !== JSON.stringify(bucket))
      fail("Target bucket policy differs. Use the reviewed empty target; no policy was changed.");
  }
  const existing = new Set();
  for (const object of target.objects) {
    const source = manifest.objects.find(
      (o) => o.bucket === object.bucket && o.path === object.path,
    );
    if (!source || hash(await bytes(storage, object)) !== source.sha256)
      fail("Target contains conflicting files. No files were overwritten.");
    existing.add(source.file);
  }
  const pending = manifest.objects.filter((o) => !existing.has(o.file));
  if (apply) {
    for (const bucket of manifest.buckets) {
      if (target.buckets.some((b) => b.id === bucket.id)) continue;
      const { error } = await storage.createBucket(bucket.id, {
        public: bucket.public,
        fileSizeLimit: bucket.fileSizeLimit ?? undefined,
        allowedMimeTypes: bucket.allowedMimeTypes ?? undefined,
      });
      if (error)
        fail("Could not create the recovery bucket. Keep effects disabled and rerun the plan.");
    }
    for (const object of pending) {
      const { error } = await storage
        .from(object.bucket)
        .upload(object.path, await readFile(join(resolve(directory), "objects", object.file)), {
          contentType: object.contentType,
          upsert: false,
        });
      if (error)
        fail(
          "File restore stopped. Existing files were not overwritten; rerun the plan to inspect completed work.",
        );
      if (hash(await bytes(storage, object)) !== object.sha256)
        fail("Restored file verification failed. Keep the target isolated.");
    }
  }
  return {
    status: apply ? "files_verified" : "restore_plan",
    files: manifest.objects.length,
    bytes: manifest.objects.reduce((sum, o) => sum + o.size, 0),
    existing: existing.size,
    pending: pending.length,
    effectsResumeAllowed: false,
  };
}
