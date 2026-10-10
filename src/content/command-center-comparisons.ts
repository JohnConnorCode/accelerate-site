/** Primary-source product descriptions, reviewed 2026-10-10. No pricing or feature-parity claims. */
export const comparisonReviewedAt = "2026-10-10";
export const commandCenterComparisons = [
  {
    name: "Twenty",
    category: "Customizable CRM",
    strength:
      "Twenty leads with an open-source CRM that technical teams can adapt, including custom data, interfaces and automation.",
    choose: "Consider it when a customizable CRM is the main system you need.",
    fit: "Consider Command Center when you want to start from customer work spanning sales, delivery, invoicing and publishing, and extend that operating foundation.",
    sources: [{ title: "Twenty product overview", href: "https://twenty.com/" }],
  },
  {
    name: "Kyma / Mila Omni",
    category: "AI application creation",
    strength:
      "Kyma's public documentation describes generating React applications, working with drafts, previewing changes and publishing workstations.",
    choose:
      "Evaluate it when creating applications from prompts inside the product is central to your requirements. Validate the described workflow with your own trial.",
    fit: "Command Center's custom App path currently uses the source repository and an external coding agent. Choose it for the existing business services you can reuse; its general-purpose in-app App builder remains planned.",
    sources: [
      { title: "Kyma product documentation", href: "https://www.kymainfostructure.com/docs" },
    ],
  },
  {
    name: "Attio",
    category: "Revenue CRM",
    strength:
      "Attio organizes its AI CRM around building pipeline, converting leads, running sales motions, forecasting and account growth.",
    choose: "Consider it when your principal goal is a focused sales and revenue CRM.",
    fit: "Consider Command Center when customer operations also need delivery tasks, billing, content and custom Apps in a source-owned platform.",
    sources: [{ title: "Attio product overview", href: "https://attio.com/" }],
  },
  {
    name: "HubSpot",
    category: "Customer platform",
    strength:
      "HubSpot presents a shared CRM across marketing, sales, service, content, data and commerce, with connected AI capabilities.",
    choose:
      "Consider it when you want an established hosted customer platform and its packaged ecosystem.",
    fit: "Consider Command Center when controlling the application source and adapting domain workflows matter enough to take on a configured implementation.",
    sources: [{ title: "HubSpot product suite", href: "https://www.hubspot.com/products" }],
  },
  {
    name: "HighLevel",
    category: "Agency and marketing operations",
    strength:
      "HighLevel connects lead capture, nurture, closing and reactivation, with agency-oriented accounts, marketing channels and AI features.",
    choose:
      "Consider it when packaged agency marketing and customer-acquisition workflows are your primary requirement.",
    fit: "Consider Command Center when your agency wants to build client-specific operational Apps from an MIT-licensed foundation. Check each required channel against the current connection guides.",
    sources: [{ title: "HighLevel platform overview", href: "https://www.gohighlevel.com/" }],
  },
  {
    name: "Zoho One",
    category: "Integrated business suite",
    strength:
      "Zoho One combines business applications with AI, integrations, automation and custom application development.",
    choose:
      "Consider it when broad packaged application coverage is more useful than maintaining your own platform source.",
    fit: "Consider Command Center when shared customer operations and your own business-specific extensions are the starting point. Compare the actual workflows you need rather than the size of the app catalog.",
    sources: [{ title: "Zoho One overview", href: "https://www.zoho.com/one/overview.html" }],
  },
  {
    name: "Odoo / ERPNext",
    category: "ERP and broad operations",
    strength:
      "Odoo and ERPNext cover broad business operations, including accounting, sales, purchasing, inventory and projects.",
    choose:
      "Consider them when a full ERP, stock management, manufacturing or accounting ledger is central to the project.",
    fit: "Command Center currently focuses on customer work, delivery, billing and adaptable Apps. Evaluate its current guides for those jobs and scope additional ERP functions separately.",
    sources: [
      { title: "Odoo applications", href: "https://www.odoo.com/page/all-apps" },
      { title: "ERPNext product overview", href: "https://frappe.io/erpnext" },
    ],
  },
  {
    name: "Retool / n8n",
    category: "Apps and workflow automation",
    strength:
      "Retool provides applications, workflows and agents around business data. n8n provides composable automation and AI workflows across connected systems.",
    choose:
      "Consider them when you primarily need to build tools or orchestrate systems you already use.",
    fit: "Consider Command Center when you also want existing customer, opportunity, task and billing workflows to build on. Custom integrations still need their own implementation and verification.",
    sources: [
      { title: "Retool AI", href: "https://retool.com/ai" },
      { title: "n8n product overview", href: "https://n8n.io/" },
    ],
  },
] as const;
