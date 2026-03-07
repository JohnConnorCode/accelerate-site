"use client";

import { useEffect } from "react";
import { captureUTMParams } from "@/lib/utm";

export function UTMCapture() {
  useEffect(() => {
    captureUTMParams();
  }, []);

  return null;
}
