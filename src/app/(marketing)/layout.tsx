import { MarketingChrome } from "@/components/layout/MarketingChrome";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <MarketingChrome>{children}</MarketingChrome>;
}
