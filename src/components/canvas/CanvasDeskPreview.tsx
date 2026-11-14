"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useAdminNavigation } from "@/components/admin/AdminLink";
import { ADMIN_APPEARANCES } from "@/lib/admin/appearances";
import { sampleDeskNodes, type DeskDatum } from "@/lib/admin/canvas-desk";
import type { CanvasNode } from "@/lib/admin/canvas-model";
import { CanvasComposer } from "./CanvasComposer";
import { DeskCanvasContent } from "./DeskCanvasContent";
import { LazyCanvasView } from "./LazyCanvasView";

/** Development-only preview of the shared canvas with the fictional sample desk. */
export function CanvasDeskPreview() {
  const { setTheme } = useTheme();
  const search = useSearchParams();
  const router = useAdminNavigation();
  const nodes = useMemo(() => sampleDeskNodes(), []);
  const station = search.get("station");
  const selected = nodes.find((node) => node.id === station && node.kind === "station");
  const href = (change: (params: URLSearchParams) => void) => {
    const next = new URLSearchParams(search.toString());
    change(next);
    return `/dev/canvas${next.size ? `?${next}` : ""}`;
  };
  return (
    <main className="admin-shell min-h-screen p-4 sm:p-8">
      <div className="admin-route-frame admin-content-stack">
        <header className="admin-toolbar justify-between">
          <div>
            <p className="admin-eyebrow">Canvas · Development preview</p>
            <h1 className="admin-page-title">Sample desk</h1>
          </div>
          <label className="admin-field-label">
            Appearance
            <select
              className="admin-field"
              aria-label="Preview appearance"
              onChange={(event) => setTheme(event.target.value)}
              defaultValue="light"
            >
              {ADMIN_APPEARANCES.map((appearance) => (
                <option key={appearance.id} value={appearance.id}>
                  {appearance.label}
                </option>
              ))}
            </select>
          </label>
        </header>
        <LazyCanvasView<DeskDatum>
          label="Sample desk canvas"
          nodes={nodes}
          visibility="path"
          maxFrameZoom={1.5}
          renderNode={DeskCanvasContent}
          selectedId={selected?.id ?? null}
          scopeId={search.get("scope") ?? "desk:mlivm"}
          hrefFor={({ scopeId }) =>
            href((params) => {
              params.delete("station");
              params.set("scope", scopeId ?? "");
            })
          }
          onOpen={(node: CanvasNode<DeskDatum>) =>
            router.push(href((params) => params.set("station", node.id)), "preserve")
          }
          read={{ loading: false, hasData: true, onRetry: () => undefined }}
          empty={null}
          detail={
            selected
              ? {
                  title: selected.label,
                  onClose: () =>
                    router.push(href((params) => params.delete("station")), "preserve"),
                  content: (
                    <div className="admin-content-stack">
                      <p className="admin-copy">{selected.data.subtitle}</p>
                      <dl className="space-y-3">
                        {(selected.data.rows ?? []).map((row) => (
                          <div key={row.label}>
                            <dt className="admin-field-label">{row.label}</dt>
                            <dd className="text-sm text-[var(--admin-ink)]">{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ),
                }
              : null
          }
          overlay={
            <CanvasComposer
              label="Ask about this desk"
              placeholder="Ask your data..."
              onSubmit={() => undefined}
            />
          }
        />
      </div>
    </main>
  );
}
