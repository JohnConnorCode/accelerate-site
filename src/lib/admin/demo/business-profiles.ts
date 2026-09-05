import type { DemoScenarioId } from "./scenarios";
export type DemoBusinessProfile = {
  invoiceLines: { description: string; quantity: number; unitAmount: number }[];
  invoiceMemo: string;
  onboarding: string[];
  commitments: string[];
  introduction: string;
};
/** Fictional commercial examples. Amounts are minor USD units; these are not tax receipts. */
export const DEMO_BUSINESS_PROFILES: Record<DemoScenarioId, DemoBusinessProfile> = {
  "northline-roofing": {
    invoiceLines: [
      { description: "Roof inspection and scope documentation", quantity: 1, unitAmount: 35000 },
      { description: "Gutter cleaning and debris removal", quantity: 1, unitAmount: 22500 },
    ],
    invoiceMemo: "Completed maintenance visit; inspection photos supplied.",
    onboarding: [
      "Confirm roof scope and material selection",
      "Collect site access and permit details",
      "Schedule crew and material delivery",
      "Share the installation and inspection schedule",
    ],
    commitments: [
      "Send the annotated inspection photos",
      "Confirm the homeowner’s preferred installation dates",
    ],
    introduction: "Your property care visit is complete. Here is the itemized service summary.",
  },
  "alder-ridge-law": {
    invoiceLines: [
      { description: "Medical records retrieval", quantity: 1, unitAmount: 12500 },
      { description: "Court reporting transcript", quantity: 1, unitAmount: 27500 },
    ],
    invoiceMemo: "Itemized case expenses. Excludes contingency fees and trust transfers.",
    onboarding: [
      "Confirm representation scope and conflicts clearance",
      "Collect signed representation documents and medical authorizations",
      "Schedule the client case review",
      "Share the matter milestones and responsible attorney",
    ],
    commitments: [
      "Send the medical records authorization for review",
      "Confirm the accident report and witness contact details",
    ],
    introduction: "An itemized record of the approved case expenses for your matter.",
  },
  "ledgerstone-advisory": {
    invoiceLines: [
      { description: "Monthly close and account reconciliation", quantity: 1, unitAmount: 175000 },
      { description: "Management reporting review", quantity: 1, unitAmount: 45000 },
    ],
    invoiceMemo: "Monthly accounting services and management reporting.",
    onboarding: [
      "Confirm the reporting scope and close calendar",
      "Collect accounting access and opening balances",
      "Schedule the finance kickoff",
      "Share the document checklist and first reporting date",
    ],
    commitments: [
      "Request the missing bank reconciliation documents",
      "Deliver the revised cash forecast assumptions",
    ],
    introduction: "Your monthly close and reporting services, clearly itemized for your records.",
  },
  "hearthline-realty": {
    invoiceLines: [
      { description: "Property marketing photography package", quantity: 1, unitAmount: 65000 },
      {
        description: "Floor plan and listing brochure preparation",
        quantity: 1,
        unitAmount: 27500,
      },
    ],
    invoiceMemo: "Approved property marketing services. Excludes deposits and commissions.",
    onboarding: [
      "Confirm the signed listing scope",
      "Collect property disclosures and access instructions",
      "Schedule photography and the listing review",
      "Share the launch calendar with the owner",
    ],
    commitments: [
      "Send the staging recommendations to the owner",
      "Confirm photography access and appointment time",
    ],
    introduction: "The approved marketing services supporting your property launch.",
  },
  "common-table-network": {
    invoiceLines: [
      { description: "Community event exhibitor package", quantity: 1, unitAmount: 50000 },
      { description: "Additional exhibitor tables", quantity: 2, unitAmount: 7500 },
    ],
    invoiceMemo: "Event participation services. This invoice is not a charitable tax receipt.",
    onboarding: [
      "Confirm the partner participation agreement",
      "Collect exhibitor and accessibility requirements",
      "Schedule the partner orientation",
      "Share the event run sheet and check-in instructions",
    ],
    commitments: [
      "Send the volunteer coverage plan",
      "Confirm exhibitor table and accessibility needs",
    ],
    introduction:
      "Thank you for taking part in our community event. Your participation services are listed below.",
  },
};
