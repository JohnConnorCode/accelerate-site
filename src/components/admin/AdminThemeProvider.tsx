"use client";
import { createContext, useContext } from "react";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import {
  themeDeclarations,
  validateAdminTheme,
  type AdminThemeDefinition,
} from "@/lib/admin/theme-definition";
import type { WorkspaceBrand } from "@/lib/revenue-os/branding-contract";

const ThemeContext = createContext<AdminThemeDefinition | null>(null);
export const useWorkspaceTheme = () => useContext(ThemeContext);

/** The same validated theme reaches shell, dialogs and notifications. */
export function AdminThemeProvider({
  initialTheme = null,
  children,
}: {
  initialTheme?: AdminThemeDefinition | null;
  children: React.ReactNode;
}) {
  const query = useAdminQuery<{ brand: WorkspaceBrand; revision: string }>(
    ["admin", "workspace-branding"],
    "/api/admin/tenant/branding",
  );
  let theme: AdminThemeDefinition | null = null;
  try {
    const raw = query.data ? query.data.brand.adminTheme : initialTheme;
    if (raw) theme = validateAdminTheme(raw);
  } catch {
    /* Invalid stored themes fall back to Paper. */
  }
  const css = theme
    ? `html[data-theme="workspace"] :is(.admin-shell,.admin-overlay-token-scope,body.admin-dialog-open,body.admin-notifications-open){${themeDeclarations(theme)}}`
    : "";
  return (
    <ThemeContext.Provider value={theme}>
      <style data-admin-workspace-theme data-admin-workspace-mode={theme?.mode ?? "light"}>
        {css}
      </style>
      {children}
    </ThemeContext.Provider>
  );
}
