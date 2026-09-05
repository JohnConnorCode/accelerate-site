"use client";
import { useAdminDemo } from "@/components/admin/AdminDemoBoundary";
import { DemoScenarioMark } from "@/components/admin/DemoScenarioMark";
import { useState } from "react";
import Image from "next/image";
import type { WorkspaceBrand } from "@/lib/revenue-os/branding-contract";
import { brandButtonInk } from "@/lib/revenue-os/branding-contract";
/** Failed remote assets retain a readable identity instead of a broken image. */
export function BusinessLogo({ brand }: { brand: WorkspaceBrand }) {
  const demo = useAdminDemo();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (demo && brand.logoUrl)
    return (
      <span
        role="img"
        aria-label={brand.name}
        className="mb-3 inline-flex size-12"
        style={{ color: brand.accentColor }}
      >
        <DemoScenarioMark scenarioId={demo.scenarioId} className="size-12" />
      </span>
    );
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
