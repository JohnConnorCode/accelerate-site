import type { FAQ } from "@/lib/types";

export const commandCenterFaqs: FAQ[] = [
  {
    question: "What stops it doing something stupid on my behalf?",
    answer:
      "Nothing it writes leaves the building until you approve it. That is how it ships on day one and it stays that way until you change it, one category of work at a time. You can also turn any single part of it off in a click.",
  },
  {
    question: "Do I have to learn new software?",
    answer:
      "We build it around the way you already work and hand it over running. Your team is trained on whatever they touch. You are not handed a blank app and a login.",
  },
  {
    question: "Our records are a mess. Should we clean them up first?",
    answer:
      "No. Waiting to tidy up is the single most common reason this never gets started. It reads what already exists, flags the duplicates for you to settle, and improves the rest as it goes.",
  },
  {
    question: "We bought an AI tool last year and nobody used it.",
    answer:
      "Usually the tool was fine and there was no rule about when to use it. This one gives you one place to go each morning and a short list of decisions sitting there. If that is not going to change anything for you, we would rather work that out on the session than after you have paid for a build.",
  },
  {
    question: "Where does our data live?",
    answer:
      "The Command Center uses shared infrastructure with explicit tenant isolation. Your workspace has its own membership boundary, tenant-scoped records, provider configuration, and audit trail. You own the data and can export it whenever you want.",
  },
  {
    question: "Can we control our AI provider costs?",
    answer:
      "Yes. Each tenant can use the shared provider configuration or bring its own OpenRouter API key and approved model settings. Keys stay server-side, and the workspace keeps provider and usage behavior inside the tenant boundary.",
  },
  {
    question: "How is this different from the notetaker we already have?",
    answer:
      "A notetaker gives you a transcript and a summary, and you still do the work. This reads the same call and then drafts the follow-up, updates the deal, and books the next step, and it holds all of it for your approval. The transcript is the raw material, not the product.",
  },
  {
    question: "What does it cost, and how long does it take?",
    answer:
      "The session and the written plan are free. The build is a fixed price agreed before anything starts, and ongoing support is optional. Something is running inside a couple of weeks, and because it loads your history first, there is work waiting in the queue the first morning you log in.",
  },
];
