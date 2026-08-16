export function normalizeAdminEmail(email: string | null | undefined): string {
  return (email || "").trim().toLowerCase();
}

export function isConfiguredAdmin(email: string | null | undefined): boolean {
  const configured = normalizeAdminEmail(process.env.ADMIN_EMAIL);
  return Boolean(configured) && normalizeAdminEmail(email) === configured;
}
