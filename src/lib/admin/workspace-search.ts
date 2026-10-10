/** Browser-safe result formatting shared by connected and fictional workspaces. */
export type SearchRecordKind = "people" | "work" | "opportunities" | "clients" | "proposals";

export interface SearchRecord {
  kind: SearchRecordKind;
  id: string;
  label: string;
  description: string;
  href: string;
}

export const searchRecordGroups: { kind: SearchRecordKind; label: string }[] = [
  { kind: "work", label: "Work" },
  { kind: "opportunities", label: "Opportunities" },
  { kind: "clients", label: "Clients" },
  { kind: "proposals", label: "Proposals" },
  { kind: "people", label: "People" },
];

export function normalizeSearchQuery(query: string): string {
  // PostgREST OR-filter syntax and user-supplied wildcards cannot broaden the query.
  return query
    .replace(/[,()\\"%*]/g, "")
    .trim()
    .slice(0, 100);
}

export function searchRecordHref(kind: SearchRecordKind, id: string): string {
  const encoded = encodeURIComponent(id);
  switch (kind) {
    case "people":
      return `/admin/contacts/${encoded}`;
    case "work":
      return `/admin/work?task=${encoded}`;
    case "opportunities":
      return `/admin/pipeline/${encoded}`;
    case "clients":
      return `/admin/clients/${encoded}`;
    case "proposals":
      return `/admin/proposals?proposal=${encoded}`;
  }
}

type TaskRow = { id: string; title: string; status: string; related_name: string | null };
type OpportunityRow = { id: string; name: string; stage: string };
type ClientRow = { id: string; business_name: string; contact_name: string | null; status: string };
type ProposalRow = { id: string; title: string; client_name: string | null; status: string };

export function formatSearchRecords(rows: {
  tasks?: TaskRow[];
  opportunities?: OpportunityRow[];
  clients?: ClientRow[];
  proposals?: ProposalRow[];
}): SearchRecord[] {
  const record = (
    kind: SearchRecordKind,
    id: string,
    label: string,
    ...context: (string | null)[]
  ): SearchRecord => ({
    kind,
    id,
    label,
    href: searchRecordHref(kind, id),
    description: context
      .filter(Boolean)
      .map((text) => text!.replaceAll("_", " "))
      .join(" · "),
  });
  return [
    ...(rows.tasks ?? [])
      .slice(0, 5)
      .map((row) => record("work", row.id, row.title, row.related_name, row.status)),
    ...(rows.opportunities ?? [])
      .slice(0, 5)
      .map((row) => record("opportunities", row.id, row.name, row.stage)),
    ...(rows.clients ?? [])
      .slice(0, 5)
      .map((row) => record("clients", row.id, row.business_name, row.contact_name, row.status)),
    ...(rows.proposals ?? [])
      .slice(0, 5)
      .map((row) => record("proposals", row.id, row.title, row.client_name, row.status)),
  ];
}

/** Reject incomplete responses and destinations outside each record's owned detail route. */
export function parseSearchResponse(data: {
  results: { name: string; email: string; type: string }[];
  records?: SearchRecord[];
}): SearchRecord[] {
  if (
    !Array.isArray(data.results) ||
    !data.results.every(
      (person) =>
        person &&
        typeof person.name === "string" &&
        typeof person.email === "string" &&
        typeof person.type === "string",
    ) ||
    (data.records !== undefined &&
      (!Array.isArray(data.records) ||
        !data.records.every(
          (row) =>
            row &&
            searchRecordGroups.some((group) => group.kind === row.kind) &&
            typeof row.id === "string" &&
            row.id.length > 0 &&
            typeof row.label === "string" &&
            typeof row.description === "string" &&
            row.href === searchRecordHref(row.kind, row.id),
        )))
  )
    throw new Error("Incomplete search response");
  const people: SearchRecord[] = data.results.map((person) => ({
    kind: "people",
    id: person.email,
    label: person.name || person.email,
    description: `${person.email} · ${person.type}`,
    href: searchRecordHref("people", person.email),
  }));
  return [...(data.records ?? []), ...people];
}
