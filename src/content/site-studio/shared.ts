import { tenant } from "@/config/tenant";
import { navItems, footerLinks } from "../navigation";
import type { WebsiteHeader, WebsiteFooter, WebsiteDock } from "@/lib/site-studio/website-chrome";

export const websiteHeaderContent: WebsiteHeader = { ctaLabel: "Book a call", ctaHref: "/contact" };
export const websiteNavigationContent = navItems.map((item) => ({
  ...item,
  ...(item.children ? { children: item.children.map(({ label, href }) => ({ label, href })) } : {}),
}));
export const websiteFooterContent: WebsiteFooter = {
  text: "AI systems for small businesses. We find where it fits, build it, and run it.",
  links: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
  ],
  columns: footerLinks.map((column) => ({
    heading: column.heading,
    links: column.links.map((link) => ({ ...link })),
  })),
  email: tenant.founder.email,
  social: [{ label: "LinkedIn", href: "https://www.linkedin.com/company/acceleratewith/" }],
  rights: "All rights reserved.",
  newsletter: {
    visible: true,
    heading: "One email a week",
    description: "No spam. Unsubscribe anytime.",
    placeholder: "your@email.com",
    inputLabel: "Email address",
    buttonLabel: "Subscribe",
    successText: "You’re subscribed!",
  },
};
export const websiteDockContent: WebsiteDock = {
  visible: true,
  heading: "Free 30-minute strategy session",
  detail: "You leave with a written plan",
  ctaLabel: "Book",
  ctaHref: "/contact",
};
