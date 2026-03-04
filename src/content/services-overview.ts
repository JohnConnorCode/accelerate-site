import type { ServiceOverviewItem } from "@/lib/types";
import { services } from "./services";

export const serviceOverviewItems: ServiceOverviewItem[] = services.map(
  (s) => ({
    icon: s.icon,
    name: s.name,
    description: s.shortDescription,
  })
);
