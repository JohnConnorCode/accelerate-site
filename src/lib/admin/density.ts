"use client";
import { useSyncExternalStore } from "react";
export type AdminDensity = "comfortable" | "compact";
export const ADMIN_DENSITY_KEY = "accelerate:admin:density:v1";
const eventName = "admin:density-change";
export function readAdminDensity(): AdminDensity {
  return document.documentElement.dataset.adminDensity === "compact" ? "compact" : "comfortable";
}
export function setAdminDensity(density: AdminDensity) {
  document.documentElement.dataset.adminDensity = density;
  try {
    localStorage.setItem(ADMIN_DENSITY_KEY, density);
  } catch {
    /* Session still works. */
  }
  window.dispatchEvent(new Event(eventName));
}
function subscribe(callback: () => void) {
  function storage(event: StorageEvent) {
    if (event.key !== ADMIN_DENSITY_KEY && event.key !== null) return;
    document.documentElement.dataset.adminDensity =
      event.newValue === "compact" ? "compact" : "comfortable";
    callback();
  }
  window.addEventListener(eventName, callback);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(eventName, callback);
    window.removeEventListener("storage", storage);
  };
}
export function useAdminDensity() {
  return useSyncExternalStore(subscribe, readAdminDensity, () => "comfortable" as AdminDensity);
}
