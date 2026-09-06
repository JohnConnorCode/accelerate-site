/**
 * Team template system.
 *
 * To add, remove, or reorder a member, edit TEAM_MEMBERS only. The /team
 * index grid, the /team/[slug] bio pages, search entries, and the sitemap
 * all derive from this file, so a new headshot plus one block here is the
 * entire operation. Photos live in public/images/team/.
 *
 * Bios must stay factual: no invented clients, numbers, or claims
 * (see scripts/test-no-fabricated-claims.ts).
 */
export type TeamPortraitShape = "portrait" | "circle";

export interface TeamMember {
  /** URL slug for /team/[slug]. */
  slug: string;
  name: string;
  role: string;
  /** Short group label shown on the card, e.g. "Leadership" or "Advisors". */
  group: "Leadership" | "Advisors";
  /** One or two sentences shown on the card. */
  summary: string;
  /** Longer bio paragraphs for the detail page. */
  bio: string[];
  /** Verifiable highlights for the detail page. */
  highlights: string[];
  /** Portrait path under public/. */
  image: string;
  imageAlt: string;
  /** Circle-cropped portraits (pre-cropped sources) vs full-bleed ones. */
  portraitShape?: TeamPortraitShape;
  linkedin?: string;
}

export const TEAM_MEMBERS: TeamMember[] = [
  {
    slug: "john-connor",
    name: "John Connor",
    role: "Founder",
    group: "Leadership",
    summary:
      "Founder of Accelerate and SuperDebate. He builds systems that help people think, collaborate, and grow.",
    bio: [
      "John is the founder of SuperDebate, rebuilding competitive debate for adults through local clubs, a technology platform, and championship tournaments, and the founder of Accelerate, where he helps small businesses figure out where AI fits, then builds and manages the systems that make it happen.",
      "His track record includes CEO of Sparkblox, a no-code NFT platform that secured over $1M in funding, and product and live operations at Uplandme, where monthly revenue grew more than 15x and daily active users passed 100,000. He advises WORK+SHELTER on web strategy and partnerships, consulted on ecosystem growth at Thrive Protocol, and started out instructing competitive policy debate to high school students.",
      "He takes on a limited number of clients so the team can operate alongside each one. He advises and he delivers, and he stays on the hook after launch.",
    ],
    highlights: [
      "Founder, SuperDebate and Accelerate",
      "CEO, Sparkblox, past $1M in funding",
      "Product and live operations, Uplandme",
      "Strategic advisor, WORK+SHELTER",
      "Ecosystem consultant, Thrive Protocol",
    ],
    image: "/images/team/john.jpg",
    imageAlt: "John Connor, Founder of Accelerate",
    linkedin: "https://www.linkedin.com/in/jtconnor/",
  },
  {
    slug: "matthew-rolnick",
    name: "Matthew Rolnick",
    role: "Advisor, Partnerships",
    group: "Advisors",
    summary:
      "Partnerships and live events veteran. SVP of Partnerships and Events at Real American Beer, formerly VP of Strategy and Innovation at Yaymaker.",
    bio: [
      "Matt is SVP of Partnerships and Events at Real American Beer, where he develops partnerships across sports, music, entertainment, athletes, and distributors. Before that he served as VP of Strategy and Innovation at Yaymaker, growing new revenue streams through experiences and partnerships, and earlier built and led Groupon sales teams that generated over $10 million in revenue.",
      "Across his career he has helped orchestrate partnerships with Fortune 500 companies including Google, Salesforce, LinkedIn, Meta, and Procter & Gamble. He is a Forbes Business Development Council member and contributing writer, an Amazon bestselling author of two books on entrepreneurship and leadership, and was named a 2023 LinkedIn Top Voice in Entrepreneurship. His courses have reached over 140,000 students.",
      "As an Accelerate advisor, Matt focuses on partnership and sponsorship strategy: building the relationships and playbooks that turn strong work into durable revenue.",
    ],
    highlights: [
      "SVP of Partnerships and Events, Real American Beer",
      "Former VP of Strategy and Innovation, Yaymaker",
      "Built and led Groupon sales teams past $10 million in revenue",
      "Forbes Business Development Council member and contributing writer",
      "Amazon bestselling author, two books on entrepreneurship and leadership",
      "2023 LinkedIn Top Voice in Entrepreneurship",
    ],
    image: "/images/team/matthew-rolnick.jpg",
    imageAlt: "Matthew Rolnick, Advisor at Accelerate",
    linkedin: "https://www.linkedin.com/in/mattrolnick/",
  },
  {
    slug: "martin-dabrowski",
    name: "Martin Dabrowski",
    role: "Workflow, UX and Automation Specialist",
    group: "Leadership",
    summary:
      "Chicago-based UX and product delivery lead with 10+ years turning ambiguous digital problems into clear priorities, now focused on AI-enabled workflow automation.",
    bio: [
      "Martin is a Chicago-based UX and product delivery lead with more than ten years helping teams clarify ambiguous digital problems, align around priorities, and deliver usable products and web experiences. His background spans UX strategy, product discovery, digital project management, enterprise UX, SaaS, eCommerce, custom applications, accessibility, analytics-informed optimization, and, since 2024, AI-enabled workflow automation.",
      "He has worked across agency, consulting, startup, and enterprise environments, including UX and front-end work for Northern Trust, enterprise experience design at Melon/DEPT for clients like Legrand and Thrivent Charitable, and over a hundred SMB projects at Comrade Digital. As co-founder, COO, and UX Architect at Sparkblox, and as Product Lead and UX Architect at the Greenpill Dev Guild, he has led operations and design across both studio and SaaS work.",
      "At Accelerate, Martin owns how the work feels and flows: workflows, interfaces, and automations that fit the business, from outcome-based UX research to AI workflows that compress week-long processes into a single review step.",
    ],
    highlights: [
      "10+ years UX and product delivery across agency, consulting, startup, and enterprise",
      "UX design and front-end development, Northern Trust",
      "Enterprise experience design, Melon/DEPT",
      "Co-founder, COO, and UX Architect, Sparkblox",
      "Product Lead and UX Architect, Greenpill Dev Guild",
      "Awwwards Site of the Day nominee",
    ],
    image: "/images/team/martin-dabrowski.jpg",
    imageAlt: "Martin Dabrowski, Workflow, UX and Automation Specialist at Accelerate",
    linkedin: "https://www.linkedin.com/in/mklaudiusz/",
  },
  {
    slug: "theresa-vandermeer",
    name: "Theresa VanderMeer",
    role: "Business Process and Sales Specialist",
    group: "Leadership",
    summary:
      "Founder-operator with 16+ years turning mission-driven ideas into durable systems. Founder of WORK+SHELTER, Kellogg EMBA.",
    bio: [
      "Theresa is a founder-operator with more than sixteen years turning mission-driven ideas into durable systems across the United States and India. She founded WORK+SHELTER, an ethical manufacturing enterprise that has empowered over 200 women through dignified employment and fair wages across 14+ years.",
      "Her background spans offshore strategy and operations at Publicis/VivaKi, a $2.4M yearly digital ad book at Google, mobile programs for major brands, and top revenue performance in enterprise sales. She holds an Executive MBA from Northwestern Kellogg, alongside Generative AI for Business study and recognition including the Kellogg Dean's Leadership Award.",
      "At Accelerate, Theresa owns how the business runs: sales process, operational discipline, and the follow-through that turns inquiries into revenue.",
    ],
    highlights: [
      "Founder and CEO, WORK+SHELTER, 14+ years",
      "200+ women trained and employed through dignified work",
      "Top revenue performer in enterprise sales",
      "Northwestern Kellogg Executive MBA",
      "Kellogg Dean's Leadership Award",
    ],
    image: "/images/team/theresa-vandermeer.jpg",
    imageAlt: "Theresa VanderMeer, Business Process and Sales Specialist at Accelerate",
    portraitShape: "circle",
    linkedin: "https://linkedin.com/in/theresavandermeer",
  },
];

export function getTeamMember(slug: string): TeamMember | null {
  return TEAM_MEMBERS.find((member) => member.slug === slug) ?? null;
}
