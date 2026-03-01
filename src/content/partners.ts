import type { PartnerTier } from "@/lib/types";

export const partnerTiers: PartnerTier[] = [
  {
    name: "Referral Partner",
    commission: "15% of first-year revenue",
    benefits: [
      "15% commission on every referred client",
      "Dedicated referral tracking link",
      "Monthly commission reports",
      "Co-branded landing page option",
      "Priority support for your referrals",
    ],
    requirements: [
      "Complete partner application",
      "No minimum referral volume",
      "Active business or professional network",
    ],
  },
  {
    name: "Agency Partner",
    commission: "20% of first-year revenue + white-label pricing",
    benefits: [
      "20% commission on referred clients",
      "White-label service delivery",
      "Wholesale pricing on all packages",
      "Joint case studies and marketing",
      "Dedicated partner success manager",
      "Early access to new features",
      "Partner directory listing",
    ],
    requirements: [
      "Established agency or consultancy",
      "Minimum 3 referrals per quarter",
      "Maintain quality standards",
    ],
  },
  {
    name: "Technology Partner",
    commission: "Custom revenue share",
    benefits: [
      "Custom integration development",
      "Revenue share on mutual clients",
      "Joint go-to-market campaigns",
      "Technical documentation and API access",
      "Featured integration showcase",
      "Quarterly business reviews",
    ],
    requirements: [
      "Complementary technology product",
      "Active user base of 100+",
      "Technical integration capability",
    ],
  },
];
