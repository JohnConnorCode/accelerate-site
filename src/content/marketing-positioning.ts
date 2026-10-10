export const marketingPositioning = {
  heroEyebrow: "AI strategy, custom solutions, and execution",
  coreOffer:
    "Every engagement starts with your business. We find where AI and automation can free up time or increase revenue, then advise, build, integrate, and run the right solution for your team.",
  shortOffer:
    "We find where AI and automation can free up time or increase revenue, then build and run the right custom solution.",
  outcomes: ["Free up time", "Increase revenue", "Focus on what matters"],
  docsBlurb:
    "Practical guides for running Command Center's customer, sales, delivery, billing and marketing workflows, and building your own business Apps.",
  engagementModes: [
    {
      key: "strategy",
      label: "Strategy and consulting",
      title: "Find where AI fits",
      description:
        "We learn how the business works, identify the useful opportunities, and put them in the right order before anyone spends money building.",
      example: "Workflow audit · opportunity map · practical roadmap",
      href: "/services#strategy",
    },
    {
      key: "build",
      label: "Custom systems",
      title: "Build what is missing",
      description:
        "We create workflows, AI agents, internal tools, and integrations around the systems and habits your team already has.",
      example: "Automations · AI agents · tools · integrations",
      href: "/services#automation",
    },
    {
      key: "execute",
      label: "Managed execution",
      title: "Run the work with you",
      description:
        "We can operate the sales, marketing, service, content, reporting, or administrative work the solution is built to handle.",
      example: "Campaigns · customer work · content · reporting",
      href: "/services#sales",
    },
    {
      key: "improve",
      label: "Training and optimization",
      title: "Make it better over time",
      description:
        "We train the team, document the system, watch what happens in production, and keep improving it as the business changes.",
      example: "Training · support · measurement · refinement",
      href: "/services#reporting",
    },
  ],
  commandCenter: {
    label: "One integrated solution",
    title: "A business platform you can make your own.",
    description:
      "Command Center brings customers, sales, delivery, billing, marketing and AI into an open-source platform that can be adapted to your business. We can implement it with your team or build a focused workflow, integration or tool when that better fits the job.",
  },
} as const;
