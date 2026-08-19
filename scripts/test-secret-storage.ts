import assert from "node:assert/strict";
import { maskSecret } from "@/lib/admin/settings";
import {
  decryptSecret,
  encryptSecret,
  isGoogleTokenEncryptionKeyConfigured,
} from "../src/lib/revenue-os/encryption";

const baseEnv = {
  GOOGLE_TOKEN_ENCRYPTION_KEY: process.env.GOOGLE_TOKEN_ENCRYPTION_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
};

function setEnv(key: "GOOGLE_TOKEN_ENCRYPTION_KEY" | "SUPABASE_SERVICE_ROLE_KEY" | "OPENROUTER_API_KEY", value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

function withEnv<T>(next: { GOOGLE_TOKEN_ENCRYPTION_KEY?: string; SUPABASE_SERVICE_ROLE_KEY?: string; OPENROUTER_API_KEY?: string }, body: () => T): T {
  const snapshot = {
    GOOGLE_TOKEN_ENCRYPTION_KEY: process.env.GOOGLE_TOKEN_ENCRYPTION_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  };
  setEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", next.GOOGLE_TOKEN_ENCRYPTION_KEY);
  setEnv("SUPABASE_SERVICE_ROLE_KEY", next.SUPABASE_SERVICE_ROLE_KEY);
  setEnv("OPENROUTER_API_KEY", next.OPENROUTER_API_KEY);
  try {
    return body();
  } finally {
    setEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", snapshot.GOOGLE_TOKEN_ENCRYPTION_KEY);
    setEnv("SUPABASE_SERVICE_ROLE_KEY", snapshot.SUPABASE_SERVICE_ROLE_KEY);
    setEnv("OPENROUTER_API_KEY", snapshot.OPENROUTER_API_KEY);
  }
}

assert.equal(
  isGoogleTokenEncryptionKeyConfigured(),
  Boolean(baseEnv.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim()),
  "Detected GOOGLE_TOKEN_ENCRYPTION_KEY presence should match helper behavior.",
);

const roundTrip = withEnv(
  {
    GOOGLE_TOKEN_ENCRYPTION_KEY: "unit-secret-key",
    SUPABASE_SERVICE_ROLE_KEY: "super-fallback",
    OPENROUTER_API_KEY: baseEnv.OPENROUTER_API_KEY,
  },
  () => {
    const encrypted = encryptSecret("provider-token-value");
    return {
      encrypted,
      decrypted: decryptSecret(encrypted),
    };
  },
);
assert.equal(roundTrip.decrypted, "provider-token-value", "Token encryption/decryption should be deterministic for a configured secret key.");

withEnv(
  {
    GOOGLE_TOKEN_ENCRYPTION_KEY: "",
    SUPABASE_SERVICE_ROLE_KEY: "still-service-role-key",
    OPENROUTER_API_KEY: baseEnv.OPENROUTER_API_KEY,
  },
  () => {
    assert.throws(
      () => {
        encryptSecret("provider-token-value");
      },
      (error) => {
        const message = error instanceof Error ? error.message : String(error);
        return message.includes("GOOGLE_TOKEN_ENCRYPTION_KEY is not configured");
      },
      "Encryption must not fall back to service-role key when GOOGLE_TOKEN_ENCRYPTION_KEY is absent.",
    );
  },
);

withEnv(
  {
    GOOGLE_TOKEN_ENCRYPTION_KEY: "   ",
    SUPABASE_SERVICE_ROLE_KEY: "still-service-role-key",
    OPENROUTER_API_KEY: baseEnv.OPENROUTER_API_KEY,
  },
  () => {
    assert.equal(
      isGoogleTokenEncryptionKeyConfigured(),
      false,
      "Whitespace-only key values should be treated as missing.",
    );
  },
);

assert.equal(
  isGoogleTokenEncryptionKeyConfigured(),
  Boolean(baseEnv.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim()),
  "Helper should restore to original environment value after test mutations.",
);

assert.equal(maskSecret(""), "", "Empty secret values should stay empty.");
assert.equal(maskSecret("a"), "****", "Very short secret values remain fully masked.");
assert.equal(maskSecret("short12"), "****", "Short secret values remain fully masked.");
assert.equal(maskSecret("very_long_secret_value"), "ver****lue", "Long secret masking should show first 3 and last 3 chars.");

console.log(JSON.stringify({ result: "secret-storage-hardening coverage added", checks: 6 }));
