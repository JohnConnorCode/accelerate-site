"use client";

import dynamic from "next/dynamic";
import type { ReactElement } from "react";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import type { CanvasViewProps } from "./CanvasView";

/** Loads the canvas and its graph library only when a canvas view is opened. */
export const LazyCanvasView = dynamic(
  () => import("./CanvasView").then((module) => module.CanvasView),
  {
    ssr: false,
    loading: () => <LoadingSkeleton variant="board" />,
  },
) as unknown as <T>(props: CanvasViewProps<T>) => ReactElement;
