"use client";
import { useState } from "react";
import Image from "next/image";
import type { WorkspaceBrand } from "@/lib/revenue-os/branding-contract";
import { brandButtonInk } from "@/lib/revenue-os/branding-contract";
/** Failed remote assets retain a readable identity instead of a broken image. */
export function BusinessLogo({ brand }: { brand: WorkspaceBrand }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return brand.logoUrl && failedUrl !== brand.logoUrl ? (
    <Image
      unoptimized
      src={brand.logoUrl}
      alt={brand.name}
      width={180}
      height={64}
      onError={() => setFailedUrl(brand.logoUrl)}
      className="mb-3 h-12 w-auto max-w-44 object-contain object-left"
    />
  ) : (
    <span
      className="mb-3 inline-flex size-11 items-center justify-center rounded-xl text-sm font-bold"
      style={{ backgroundColor: brand.accentColor, color: brandButtonInk(brand.accentColor) }}
    >
      {brand.logoMark}
    </span>
  );
}
