import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** Current envelope. A rotation adds v2 and keeps decryptSecret able to read
 * prior versions until leftover tokens are re-encrypted. Unknown versions fail
 * closed and never fall back to plaintext. */
const VERSION = "v1";
const SUPPORTED_VERSIONS = new Set(["v1"]);
const SCOPED_VERSION = "v2";

function key(): Buffer {
  const rawKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  const secret = rawKey ? rawKey.trim() : "";
  if (!secret) throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY is not configured");
  return createHash("sha256").update(secret).digest();
}

export function isGoogleTokenEncryptionKeyConfigured(): boolean {
  return Boolean(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim());
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function isEncryptedSecret(value: string): boolean {
  const [version, ivValue, tagValue, encryptedValue] = value.split(".");
  return Boolean(
    version && SUPPORTED_VERSIONS.has(version) && ivValue && tagValue && encryptedValue,
  );
}

export function decryptSecret(value: string): string {
  if (!isEncryptedSecret(value)) throw new Error("Unsupported encrypted secret format");
  const [version, ivValue, tagValue, encryptedValue] = value.split(".");
  if (!version || !ivValue || !tagValue || !encryptedValue || !SUPPORTED_VERSIONS.has(version))
    throw new Error("Unsupported encrypted secret format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function tenantSecretScope(tenantId: string, provider: string, field: string): Buffer {
  if (!tenantId.trim() || !provider.trim() || !field.trim())
    throw new Error("Tenant secret scope is incomplete");
  return Buffer.from(`tenant:${tenantId}:provider:${provider}:field:${field}`, "utf8");
}

/**
 * Provider credentials use an authenticated v2 envelope. AES-GCM additional
 * authenticated data binds ciphertext to its tenant, provider, and field, so a
 * copied database value cannot be decrypted in another workspace or slot.
 */
export function encryptTenantSecret(
  value: string,
  tenantId: string,
  provider: string,
  field: string,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(tenantSecretScope(tenantId, provider, field));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    SCOPED_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function isTenantEncryptedSecret(value: string): boolean {
  const [version, ivValue, tagValue, encryptedValue] = value.split(".");
  return Boolean(version === SCOPED_VERSION && ivValue && tagValue && encryptedValue);
}

export function decryptTenantSecret(
  value: string,
  tenantId: string,
  provider: string,
  field: string,
): string {
  if (!isTenantEncryptedSecret(value)) throw new Error("Unsupported tenant secret format");
  const [, ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Unsupported tenant secret format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivValue, "base64url"));
  decipher.setAAD(tenantSecretScope(tenantId, provider, field));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
