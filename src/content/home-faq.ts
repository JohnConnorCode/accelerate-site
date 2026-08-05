import type { FAQ } from "@/lib/types";

export const homeFaqs: FAQ[] = [
  {
    question: "What does this cost?",
    answer:
      "The call and the plan cost nothing. Delivery is a fixed price agreed before work begins. If a project is too small to justify the fee, we will say so on the call.",
  },
  {
    question: "How soon would we see a result?",
    answer:
      "Weeks, not quarters. We start with one constraint that has a clear before and after, so the work can be judged before anyone commits to more.",
  },
  {
    question: "Nobody here is technical. Is that a problem?",
    answer:
      "No, and it is the usual case. You explain how the business runs. We handle the rest, and your team is trained on anything they touch.",
  },
  {
    question: "Our data is disorganized. Fix that first?",
    answer:
      "No. Waiting to clean it up is the most common reason projects never start. We scope around what exists and improve the rest along the way.",
  },
  {
    question: "We bought an AI tool and nobody uses it.",
    answer:
      "Common, and the tool is usually fine. What is missing is a rule for when to use it and a standard for what good output looks like. Sometimes that is training and a few guardrails rather than anything new, and we would rather tell you than sell you a build.",
  },
  {
    question: "Is our data safe?",
    answer:
      "It stays in your accounts. We use providers with no-training agreements, give each system access only to what it needs, and log what it touches. Bring your compliance requirements to the first call.",
  },
  {
    question: "Who owns what you build?",
    answer:
      "You do. The accounts, the code, the documentation. Support is available and optional, and nothing is built so that you need us to keep it running.",
  },
];
