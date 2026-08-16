import { permanentRedirect } from "next/navigation";

/** Pricing is now scoped during a strategy session; preserve old links. */
export default function PackagesPage() {
  permanentRedirect("/services");
}
