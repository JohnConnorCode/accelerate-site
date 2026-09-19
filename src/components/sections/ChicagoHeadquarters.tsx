import Link from "next/link";
import { chicagoHeadquarters as headquarters } from "@/content/chicago";

export function ChicagoHeadquarters({ compact = false }: { compact?: boolean }) {
  return <div className={compact ? "mt-5 text-sm leading-relaxed" : "wrap py-12"}>
    <p className="label mb-3">Downtown Chicago headquarters</p>
    <address className="not-italic">{headquarters.name}<br />{headquarters.address}</address>
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
      <a className="underline underline-offset-4 py-2" href={headquarters.directions}>Directions</a>
      <a className="underline underline-offset-4 py-2" href={headquarters.url}>About Ferris</a>
      <Link className="underline underline-offset-4 py-2" href="/chicago">Chicago services</Link>
    </div>
  </div>;
}
