/**
 * The single owner for committed admin-route motion.
 *
 * The entrance state is part of the committed markup so the browser receives
 * it before first paint. Starting this sequence from an effect is racy: a fast
 * route can paint its final state before React runs the effect and appear to
 * pop in. CSS owns the bounded, compositor-friendly sequence instead.
 */
export function AdminRouteStage({
  routeKey,
  children,
}: {
  routeKey: string;
  children: React.ReactNode;
}) {
  return (
    <div
      key={routeKey}
      className="admin-route-stage"
      data-admin-route-stage
      data-admin-route-key={routeKey}
    >
      {children}
    </div>
  );
}
