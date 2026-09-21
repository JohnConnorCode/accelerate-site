/** Field ownership for retained source-tool screens. Canonical means the
 * attachRevenueLinkage contact/opportunity ids. Retained means the source
 * table still owns the displayed value. Unresolved means no replacement
 * exists and the field must not be treated as canonical. */
export type SourceFieldOwner = "canonical" | "retained" | "unresolved";

export interface SourceFieldDisposition {
  field: string;
  owner: SourceFieldOwner;
  note: string;
}

export interface RetainedSourceRouteDisposition {
  route: string;
  sourceTable: string;
  sourceIdField: string;
  emailField: string | null;
  fields: SourceFieldDisposition[];
}

export const RETAINED_SOURCE_DISPOSITIONS: RetainedSourceRouteDisposition[] = [
  {
    route: "/admin/contacts",
    sourceTable: "contact_submissions",
    sourceIdField: "id",
    emailField: "email",
    fields: [
      { field: "id", owner: "retained", note: "contact_submissions.id" },
      { field: "email", owner: "retained", note: "attribute, not a canonical unique key" },
      { field: "message", owner: "retained", note: "intake body stays on the source row" },
      { field: "revenue_os.contact_id", owner: "canonical", note: "legacy-adapter identity link" },
      {
        field: "revenue_os.opportunity_id",
        owner: "canonical",
        note: "legacy-adapter opportunity link",
      },
    ],
  },
  {
    route: "/admin/resources",
    sourceTable: "resource_downloads",
    sourceIdField: "id",
    emailField: "email",
    fields: [
      { field: "id", owner: "retained", note: "resource_downloads.id" },
      { field: "resource_id", owner: "retained", note: "downloaded asset identity" },
      { field: "downloaded_at", owner: "retained", note: "source timestamp" },
      { field: "revenue_os.contact_id", owner: "canonical", note: "legacy-adapter identity link" },
    ],
  },
  {
    route: "/admin/subscribers",
    sourceTable: "subscribers",
    sourceIdField: "id",
    emailField: "email",
    fields: [
      { field: "id", owner: "retained", note: "subscribers.id" },
      { field: "consent", owner: "unresolved", note: "no canonical consent replacement" },
      { field: "revenue_os.contact_id", owner: "canonical", note: "legacy-adapter identity link" },
    ],
  },
  {
    route: "/admin/website-grades",
    sourceTable: "website_grades",
    sourceIdField: "id",
    emailField: "email",
    fields: [
      { field: "id", owner: "retained", note: "website_grades.id" },
      { field: "overall_score", owner: "retained", note: "grade evidence stays on the report" },
      { field: "revenue_os.contact_id", owner: "canonical", note: "legacy-adapter identity link" },
    ],
  },
  {
    route: "/admin/chat-leads",
    sourceTable: "chat_leads",
    sourceIdField: "id",
    emailField: "email",
    fields: [
      { field: "id", owner: "retained", note: "chat_leads.id" },
      { field: "revenue_os.contact_id", owner: "canonical", note: "legacy-adapter identity link" },
      {
        field: "revenue_os.opportunity_id",
        owner: "canonical",
        note: "legacy-adapter opportunity link",
      },
    ],
  },
  {
    route: "/admin/partners",
    sourceTable: "partner_applications",
    sourceIdField: "id",
    emailField: "email",
    fields: [
      { field: "id", owner: "retained", note: "partner_applications.id" },
      { field: "status", owner: "retained", note: "application status is not a pipeline stage" },
      { field: "revenue_os.contact_id", owner: "canonical", note: "legacy-adapter identity link" },
    ],
  },
  {
    route: "/admin/clients",
    sourceTable: "clients",
    sourceIdField: "id",
    emailField: "email",
    fields: [
      { field: "id", owner: "retained", note: "clients.id" },
      {
        field: "monthly_value",
        owner: "retained",
        note: "contract value, not opportunity revenue",
      },
      { field: "revenue_os.contact_id", owner: "canonical", note: "legacy-adapter identity link" },
    ],
  },
  {
    route: "/admin/leads",
    sourceTable: "solution_requests",
    sourceIdField: "id",
    emailField: "contact_email",
    fields: [
      { field: "id", owner: "retained", note: "solution_requests.id" },
      {
        field: "lead_status",
        owner: "retained",
        note: "compatibility status beside canonical stage",
      },
      {
        field: "revenue_os.opportunity_id",
        owner: "canonical",
        note: "legacy-adapter opportunity link",
      },
    ],
  },
  {
    route: "/admin/inbox",
    sourceTable: "mixed",
    sourceIdField: "id",
    emailField: "email",
    fields: [
      { field: "id", owner: "retained", note: "source-type + source-id pair" },
      { field: "kind", owner: "retained", note: "inbox kind is not a canonical entity type" },
    ],
  },
  {
    route: "/admin/bookings",
    sourceTable: "opportunities",
    sourceIdField: "id",
    emailField: "email",
    fields: [
      { field: "stage", owner: "canonical", note: "pipeline.ts owns stage changes" },
      {
        field: "estimated_value",
        owner: "unresolved",
        note: "adapter still patches value; no new writer in this card",
      },
      {
        field: "follow_up_task",
        owner: "unresolved",
        note: "adapter still writes tasks; excluded from this read card",
      },
    ],
  },
  {
    route: "/admin/content",
    sourceTable: "content_calendar",
    sourceIdField: "id",
    emailField: null,
    fields: [
      { field: "id", owner: "retained", note: "content_calendar.id" },
      { field: "status", owner: "retained", note: "editorial status is not publication" },
    ],
  },
  {
    route: "/admin/email-sequences",
    sourceTable: "email_sequences",
    sourceIdField: "id",
    emailField: null,
    fields: [
      { field: "id", owner: "retained", note: "email_sequences.id" },
      { field: "delivery_history", owner: "unresolved", note: "no canonical execution receipt" },
    ],
  },
  {
    route: "/admin/proposals",
    sourceTable: "proposals",
    sourceIdField: "id",
    emailField: null,
    fields: [
      { field: "id", owner: "retained", note: "proposals.id" },
      { field: "status", owner: "retained", note: "proposal adapter remains the writer" },
    ],
  },
  {
    route: "/admin/clients/[id]",
    sourceTable: "clients",
    sourceIdField: "id",
    emailField: "email",
    fields: [
      { field: "id", owner: "retained", note: "clients.id" },
      {
        field: "timeline",
        owner: "unresolved",
        note: "email-based timeline is not canonical uniqueness",
      },
    ],
  },
  {
    route: "/admin/contacts/[email]",
    sourceTable: "contact_submissions",
    sourceIdField: "email",
    emailField: "email",
    fields: [
      {
        field: "email",
        owner: "retained",
        note: "URL identity is email, not a canonical contact id",
      },
      { field: "timeline", owner: "canonical", note: "activities.ts when a record id is present" },
    ],
  },
];

export function retainedSourceDispositions(route?: string): RetainedSourceRouteDisposition[] {
  if (!route) return RETAINED_SOURCE_DISPOSITIONS;
  return RETAINED_SOURCE_DISPOSITIONS.filter((entry) => entry.route === route);
}
