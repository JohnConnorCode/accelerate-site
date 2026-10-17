/**
 * Public marketing chrome belongs on every public page. Only the authenticated
 * admin and an entered full-admin demo workspace replace it with application
 * chrome. The demo launcher is a public selection page, not an admin route.
 */
export function isApplicationWorkspace(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/admin" || path.startsWith("/admin/")) return true;
  return /^\/demo\/command-center\/[^/]+(?:\/|$)/.test(path);
}

/** Guest admission links contain private order credentials. */
export function isTicketConfirmationPath(pathname: string) {
  return /^\/(?:t\/[^/]+\/)?events\/[^/]+\/confirmation\/?$/.test(pathname);
}

/** Withdraw focus and hit testing immediately, before React's animated exit. */
export function setPublicDockVisibility(visible: boolean) {
  for (const dock of document.querySelectorAll<HTMLElement>("[data-dock]")) {
    const focused = document.activeElement;
    if (!visible && focused instanceof HTMLElement && dock.contains(focused)) focused.blur();
    if (dock.inert !== !visible) dock.inert = !visible;
  }
  if (visible && document.body.dataset.mcta !== "on") document.body.dataset.mcta = "on";
  else if (!visible && document.body.dataset.mcta !== undefined) delete document.body.dataset.mcta;
}
