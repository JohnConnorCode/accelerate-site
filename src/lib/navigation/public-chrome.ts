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

/** Guest payment and admission links contain private order credentials. */
export function isTicketConfirmationPath(pathname: string) {
  return /^\/(?:t\/[^/]+\/)?events\/[^/]+\/(?:checkout|confirmation)\/?$/.test(pathname);
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

/** Safari can defer scroll events and paint callbacks during fixed-layer
 * animation. Keep interaction withdrawal independent of that paint clock. */
export function observePublicDockScroll(update: () => void) {
  let timer = 0;
  let lastY = Number.NaN;
  const schedule = () => {
    if (!timer && !document.hidden && document.body.dataset.mcta === "on")
      timer = window.setTimeout(watch, 16);
  };
  const refresh = () => {
    lastY = window.scrollY;
    update();
    schedule();
  };
  const watch = () => {
    timer = 0;
    if (window.scrollY !== lastY) refresh();
    schedule();
  };
  timer = window.setTimeout(watch, 0);
  window.addEventListener("scroll", refresh, { passive: true });
  window.addEventListener("resize", refresh, { passive: true });
  document.addEventListener("visibilitychange", refresh);
  return {
    refresh,
    disconnect() {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", refresh);
      window.removeEventListener("resize", refresh);
      document.removeEventListener("visibilitychange", refresh);
    },
  };
}
