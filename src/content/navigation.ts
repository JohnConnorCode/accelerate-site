import type { NavItem } from "@/lib/types";

export const navItems: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "Packages", href: "/packages" },
  {
    label: "Industries",
    href: "/industries",
    children: [
      { label: "Home Services", href: "/industries/home-services" },
      { label: "Law Firms", href: "/industries/law-firms" },
      { label: "Professional Services", href: "/industries/professional-services" },
      { label: "Real Estate", href: "/industries/real-estate" },
    ],
  },
  { label: "Learn", href: "/learn" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export const footerLinks: {
  heading: string;
  links: NavItem[];
}[] = [
  {
    heading: "Services",
    links: [
      { label: "AI Strategy & Roadmap", href: "/services#strategy" },
      { label: "Workflow Automation", href: "/services#automation" },
      { label: "Sales & Marketing", href: "/services#sales" },
      { label: "Customer Engagement", href: "/services#engagement" },
      { label: "Content Creation", href: "/services#content" },
      { label: "Data & Reporting", href: "/services#reporting" },
      { label: "Packages & Pricing", href: "/packages" },
    ],
  },
  {
    heading: "Industries",
    links: [
      { label: "Home Services", href: "/industries/home-services" },
      { label: "Law Firms", href: "/industries/law-firms" },
      { label: "Professional Services", href: "/industries/professional-services" },
      { label: "Real Estate", href: "/industries/real-estate" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Free Downloads", href: "/resources" },
      { label: "Learning Hub", href: "/learn" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Partners", href: "/partners" },
      { label: "Changelog", href: "/changelog" },
      { label: "Contact", href: "/contact" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];
