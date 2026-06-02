/**
 * Proof Points Reference
 *
 * Maps each case study to relevant article categories, key metrics,
 * and ready-to-use proof point one-liners for article authors.
 *
 * Usage: Check this file before writing any article. Find the best
 * matching case study and drop the proof point into your content.
 */

export interface ProofPoint {
  clientName: string;
  slug: string;
  relevantCategories: string[];
  relevantTopics: string[];
  metricsBefore: Record<string, string>;
  metricsAfter: Record<string, string>;
  keyImprovements: string[];
  oneLiner: string;
  extendedProofPoint: string;
  timeline: string;
}

export const PROOF_POINTS: ProofPoint[] = [
  {
    clientName: "Farrell Roofing",
    slug: "farrell-roofing",
    relevantCategories: [
      "industry",
      "lead-generation",
      "automation",
      "local-seo",
    ],
    relevantTopics: [
      "home services",
      "contractors",
      "roofing",
      "AI intake",
      "AI chatbot",
      "follow-up sequences",
      "website redesign",
      "local SEO",
      "after-hours capture",
      "response time",
    ],
    metricsBefore: {
      onlineInquiries: "10/month",
      responseTime: "Hours to days",
      followUpRate: "~30%",
      afterHoursCapture: "Zero",
    },
    metricsAfter: {
      onlineInquiries: "50+/month",
      responseTime: "Under 2 minutes",
      followUpRate: "100%",
      afterHoursCapture: "Active 24/7",
    },
    keyImprovements: [
      "5x increase in online inquiries",
      "Response time from hours to under 2 minutes",
      "75% revenue increase within 90 days",
      "After-hours coverage from zero to 24/7",
      "Follow-up rate from 30% to 100%",
    ],
    oneLiner:
      "We set up AI chat + automated follow-up for Farrell Roofing. They went from 10 online inquiries/mo to 50+, with response times under 2 minutes. Revenue up 75%.",
    extendedProofPoint:
      "When we started working with Farrell Roofing, they were a 14-year-old roofing company generating just 10 online inquiries per month. Inquiries going unanswered during job hours, zero after-hours capture, and manual follow-up on maybe 30% of estimates. We deployed an AI chat agent trained on their services and service areas, built automated follow-up sequences for every estimate, and rebuilt their website for local SEO. Four weeks later: 50+ inquiries per month, sub-2-minute response times, and 75% revenue growth in the first 90 days.",
    timeline: "4 weeks from kickoff to live",
  },
  {
    clientName: "SparkBlox",
    slug: "sparkblox",
    relevantCategories: ["automation", "foundational", "ai-tools"],
    relevantTopics: [
      "professional services",
      "client onboarding",
      "workflow automation",
      "process automation",
      "operations",
      "scaling",
      "efficiency",
      "zapier",
      "make",
      "integration",
    ],
    metricsBefore: {
      onboardingTime: "2 hours per client",
      clientGrowth: "Flat",
      manualProcesses: "Multiple disconnected tools",
    },
    metricsAfter: {
      onboardingTime: "Under 10 minutes",
      clientGrowth: "70% increase in Q1",
      manualProcesses: "Fully automated pipeline",
    },
    keyImprovements: [
      "Client onboarding from 2 hours to under 10 minutes",
      "70% client growth in Q1 without adding staff",
      "Eliminated manual data entry across 4 tools",
    ],
    oneLiner:
      "We automated SparkBlox's entire client onboarding, taking it from 2 hours per client to under 10 minutes. They grew clients 70% in Q1 without adding staff.",
    extendedProofPoint:
      "SparkBlox was spending 2 hours onboarding each new client: manual data entry across four disconnected tools, copy-pasting information, and sending welcome emails by hand. We built an automated onboarding pipeline that handles everything from contract signing to account setup to welcome sequences. Onboarding dropped to under 10 minutes per client. With that time freed up, they grew their client base 70% in Q1 without hiring a single additional person.",
    timeline: "3 weeks to full automation",
  },
  {
    clientName: "Montoya Capital",
    slug: "montoya-capital",
    relevantCategories: [
      "lead-generation",
      "automation",
      "industry",
    ],
    relevantTopics: [
      "professional services",
      "financial services",
      "response speed",
      "follow-up",
      "consultation booking",
      "AI response",
      "prospect engagement",
      "law firms",
      "real estate",
    ],
    metricsBefore: {
      responseTime: "4+ hours average",
      consultationRate: "Baseline",
      newClients: "Baseline",
    },
    metricsAfter: {
      responseTime: "Under 3 minutes",
      consultationRate: "Up 40%",
      newClients: "Up 150% in Q1",
    },
    keyImprovements: [
      "Response time from 4+ hours to under 3 minutes",
      "Consultation rate up 40%",
      "New clients up 150% in Q1",
    ],
    oneLiner:
      "Montoya Capital's AI response system engages prospects in under 3 minutes. Consultation rate up 40%, new clients up 150% in Q1.",
    extendedProofPoint:
      "Montoya Capital was losing prospects to competitors who responded faster. Average response time was over 4 hours. By then, prospects had already booked consultations elsewhere. We built an AI response system that engages every prospect within 3 minutes, qualifies their needs, and books consultations automatically. Consultation rate jumped 40%, and they signed 150% more new clients in Q1.",
    timeline: "2 weeks to deployment",
  },
];

/**
 * Guidance for articles where no case study is a direct match.
 *
 * For law firms: Bridge to Montoya Capital (professional services, response speed, consultation booking).
 * For real estate: Bridge to Montoya Capital (response speed, prospect engagement) or Farrell Roofing (local SEO, website conversion).
 * For local SEO: Bridge to Farrell Roofing (ranked for 30+ local keywords, page-one results).
 * For general automation: Bridge to SparkBlox (workflow automation, scaling without hiring).
 * For general AI tools: Bridge to any — focus on the tools Accelerate actually deploys and configure.
 *
 * When bridging, explain the connection explicitly:
 * "While this example is from [industry], the same approach applies to [target industry] because [reason]."
 */

export function findBestProofPoint(
  category: string,
  topics: string[]
): ProofPoint | null {
  // Score each proof point by relevance
  let bestMatch: ProofPoint | null = null;
  let bestScore = 0;

  for (const pp of PROOF_POINTS) {
    let score = 0;

    // Category match
    if (pp.relevantCategories.includes(category)) {
      score += 3;
    }

    // Topic overlap
    for (const topic of topics) {
      if (
        pp.relevantTopics.some(
          (t) =>
            t.toLowerCase().includes(topic.toLowerCase()) ||
            topic.toLowerCase().includes(t.toLowerCase())
        )
      ) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = pp;
    }
  }

  return bestMatch;
}
