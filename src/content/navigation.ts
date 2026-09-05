import type { NavItem } from "@/lib/types";
import { verticals } from "@/content/verticals";
import { FEATURED_INDUSTRY_SLUGS } from "@/content/industry-visuals";

const industryLinks = verticals.map((vertical) => ({
  label: vertical.name,
  href: `/industries/${vertical.slug}`,
}));

const commandCenterLinks = [
  { label: "Overview", href: "/command-center" },
  { label: "Try the demo", href: "/demo/command-center" },
  { label: "Open source", href: "/open-source" },
  { label: "Roadmap", href: "/roadmap" },
  { label: "Changelog", href: "/changelog" },
];
const learningLinks = [
  { label: "Articles & guides", href: "/learn" },
  { label: "Free downloads", href: "/resources" },
];
const companyLinks = [
  { label: "About us", href: "/about" },
  { label: "Team", href: "/team" },
  { label: "Partners", href: "/partners" },
  { label: "Contact", href: "/contact" },
];

/** Shared by desktop and mobile. Footer destinations reuse these groups. */
export const navItems: NavItem[] = [
  { label: "Services", href: "/services" },
  { label: "Command Center", href: "/command-center", children: commandCenterLinks },
  {
    label: "Industries",
    href: "#",
    children: FEATURED_INDUSTRY_SLUGS.map((slug) => {
      const vertical = verticals.find((item) => item.slug === slug);
      return { label: vertical?.name ?? slug, href: `/industries/${slug}` };
    }),
  },
  { label: "Work", href: "/work" },
  { label: "Learn", href: "/learn", children: learningLinks },
  { label: "Company", href: "/about", children: companyLinks },
  { label: "Docs", href: "/docs" },
];

export const footerLinks = [
  {
    heading: "Services",
    links: [
      { label: "AI Strategy & Roadmap", href: "/services#strategy" },
      { label: "Workflow Automation", href: "/services#automation" },
      { label: "Sales & Marketing", href: "/services#sales" },
      { label: "Customer Engagement", href: "/services#engagement" },
      { label: "Content Creation", href: "/services#content" },
      { label: "Data & Reporting", href: "/services#reporting" },
    ],
  },
  {
    heading: "Command Center",
    links: [
      ...commandCenterLinks,
      { label: "Documentation", href: "/docs" },
      { label: "Self-hosting guide", href: "/docs/self-hosting" },
    ],
  },
  { heading: "Industries", links: industryLinks },
  { heading: "Learn", links: learningLinks },
  { heading: "Company", links: [{ label: "Our work", href: "/work" }, ...companyLinks] },
];
