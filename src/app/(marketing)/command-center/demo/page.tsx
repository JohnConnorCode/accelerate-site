import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Command Center Demo",
  description: "Explore a safe, interactive Command Center workspace using fictional sample data.",
  robots: { index: false, follow: false },
};

export default function CommandCenterDemoPage() {
  permanentRedirect("/demo/command-center");
}
