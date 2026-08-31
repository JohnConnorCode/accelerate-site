import { MarketingChrome } from "@/components/layout/MarketingChrome";
import { NotFoundBody } from "@/components/layout/NotFoundBody";

/** Unmatched URLs skip the marketing layout, so this file owns chrome. */
export default function NotFound() {
  return (
    <MarketingChrome>
      <NotFoundBody />
    </MarketingChrome>
  );
}
