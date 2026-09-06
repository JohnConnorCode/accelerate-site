// Shared by full repository verification and the staged commit check.
export const textExtensions = new Set([
  "",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mdx",
  ".mjs",
  ".sql",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".yml",
  ".yaml",
]);
export const secretPatterns = [
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["Stripe secret key", /sk_(?:live|test)_[A-Za-z0-9]{16,}/],
  ["OpenRouter secret key", /sk-or-v1-[a-f0-9]{32,}/i],
  ["Anthropic secret key", /sk-ant-[A-Za-z0-9_-]{24,}/],
  ["Resend secret key", /re_[A-Za-z0-9]{24,}/],
  ["Google API key", /AIza[A-Za-z0-9_-]{24,}/],
  ["JWT", /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/],
];
