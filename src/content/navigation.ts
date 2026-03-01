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
  { label: "Results", href: "/results" },
  {
    label: "Tools",
    href: "/tools",
    children: [
      { label: "Website Grader", href: "/tools/website-grader" },
      { label: "ROI Calculator", href: "/tools/roi-calculator" },
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
      { label: "AI-Powered Websites", href: "/services#websites" },
      { label: "Automations & Workflows", href: "/services#automations" },
      { label: "AI Agents", href: "/services#agents" },
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
      { label: "Case Studies", href: "/results" },
      { label: "Website Grader", href: "/tools/website-grader" },
      { label: "ROI Calculator", href: "/tools/roi-calculator" },
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
