"use client";

import { useState } from "react";
import type { WorkspaceBrand } from "@/lib/revenue-os/branding-contract";
import { brandButtonInk } from "@/lib/revenue-os/branding-contract";

export function PublicBrandMark({ brand }: { brand: WorkspaceBrand }) {
  const [failed, setFailed] = useState(false);
  if (brand.logoUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={brand.logoUrl}
        alt=""
        width={42}
        height={42}
        onError={() => setFailed(true)}
        className="size-10 rounded-xl object-contain object-center"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="grid size-10 shrink-0 place-items-center rounded-xl text-xs font-bold tracking-[0.08em]"
      style={{ backgroundColor: brand.accentColor, color: brandButtonInk(brand.accentColor) }}
    >
      {brand.logoMark}
    </span>
  );
}
