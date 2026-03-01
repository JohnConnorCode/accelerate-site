"use client";

import dynamic from "next/dynamic";

const PlanBuilderPage = dynamic(
  () => import("./PlanBuilderPage").then((m) => m.PlanBuilderPage),
  { ssr: false }
);

export function PlanBuilderShell() {
  return <PlanBuilderPage />;
}
