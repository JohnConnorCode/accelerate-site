import { normalizeEmail } from "./db";
import type { ApprovedImportedContact as ContactImportFields } from "./identity";

/** Shared bounded source parsing and literal column mapping. No provider or database access. */
export const CONTACT_IMPORT_MAX_SOURCE_CHARS = 250_000;
export const CONTACT_IMPORT_MAX_ROWS = 500;
const MAX_CELL_CHARS = 2_000;
const MAX_SOURCE_COLUMNS = 40;
const MAX_SOURCE_KEY_CHARS = 100;
export const SOURCE_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
export const CONTACT_FIELD_LIMITS = {
  fullName: 140,
  email: 320,
  phone: 60,
  companyName: 180,
  role: 160,
  website: 500,
  industry: 160,
  source: 160,
  notes: 1000,
} as const;

export type ContactImportSourceType = "csv" | "tsv" | "json" | "text";

export const CONTACT_IMPORT_COLUMNS = [
  { key: "fullName", label: "Full name", aliases: ["fullname", "name", "contactname"] },
  { key: "firstName", label: "First name", aliases: ["firstname", "givenname"] },
  { key: "lastName", label: "Last name", aliases: ["lastname", "surname", "familyname"] },
  { key: "email", label: "Email", aliases: ["email", "emailaddress"] },
  { key: "phone", label: "Phone", aliases: ["phone", "phonenumber", "telephone", "mobile"] },
  { key: "companyName", label: "Company", aliases: ["companyname", "company", "organization"] },
  { key: "role", label: "Job title", aliases: ["role", "jobtitle", "title"] },
  { key: "website", label: "Website", aliases: ["website", "url", "companywebsite"] },
  { key: "industry", label: "Industry", aliases: ["industry"] },
  { key: "source", label: "Source", aliases: ["source"] },
  { key: "notes", label: "Notes", aliases: ["notes", "note"] },
] as const;
export type ContactImportColumn = (typeof CONTACT_IMPORT_COLUMNS)[number]["key"];
export type ContactImportMapping = Partial<Record<ContactImportColumn, string>>;

export function prepareContactImportColumns(source: string, filename?: string | null) {
  let sourceType = detectContactImportSourceType(source, filename);
  // Column mode is explicit. A pasted sheet may use unfamiliar header names.
  if (sourceType === "text" && !filename) {
    const first = source.trim().split(/\r\n|\n|\r/, 1)[0] ?? "";
    if (first.includes("\t")) sourceType = "tsv";
    else if (first.includes(",")) sourceType = "csv";
  }
  if (sourceType === "text")
    throw new Error(
      "Column mapping needs CSV, TSV or flat JSON. Choose AI-assisted for a free-form list.",
    );
  const rows = parseContactImportSource(source, sourceType);
  if (!rows.length) throw new Error("No contact rows were found");
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  if (columns.length > MAX_SOURCE_COLUMNS)
    throw new Error("Source has more than 40 distinct columns");
  const mapping: ContactImportMapping = {};
  for (const field of CONTACT_IMPORT_COLUMNS) {
    const matches = columns.filter((column) =>
      (field.aliases as readonly string[]).includes(column.toLowerCase().replace(/[\s_-]/g, "")),
    );
    if (matches.length === 1) mapping[field.key] = matches[0];
  }
  if (mapping.fullName) {
    delete mapping.firstName;
    delete mapping.lastName;
  }
  return { sourceType, rows, columns, mapping };
}

export function validateContactImportMapping(
  value: unknown,
  columns: string[],
): ContactImportMapping {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Choose the source columns before building a review");
  const mapping: ContactImportMapping = {};
  const used = new Set<string>();
  for (const [field, column] of Object.entries(value)) {
    if (!CONTACT_IMPORT_COLUMNS.some((item) => item.key === field))
      throw new Error("Column mapping contains an unsupported contact field");
    if (column === "") continue;
    if (typeof column !== "string" || !columns.includes(column))
      throw new Error("A mapped column is missing from this source; review the columns again");
    if (used.has(column)) throw new Error("Use each source column for only one contact field");
    used.add(column);
    mapping[field as ContactImportColumn] = column;
  }
  if (!mapping.fullName && !mapping.firstName && !mapping.lastName)
    throw new Error("Map a full name, or first and last name columns");
  if (mapping.fullName && (mapping.firstName || mapping.lastName))
    throw new Error("Choose either full name or separate first and last name columns");
  if (!mapping.email && !mapping.phone) throw new Error("Map an email or phone column");
  return mapping;
}

export function mapContactImportRows(
  rows: Record<string, string>[],
  mapping: ContactImportMapping,
) {
  return rows.map((row, sourceIndex) => {
    const values = Object.fromEntries(
      Object.keys(CONTACT_FIELD_LIMITS).map((field) => {
        const column = mapping[field as ContactImportColumn];
        return [field, column && Object.hasOwn(row, column) ? (row[column] ?? null) : null];
      }),
    ) as Record<keyof typeof CONTACT_FIELD_LIMITS, string | null>;
    if (!mapping.fullName)
      values.fullName = [mapping.firstName, mapping.lastName]
        .map((column) => (column && Object.hasOwn(row, column) ? row[column]?.trim() : ""))
        .filter(Boolean)
        .join(" ");
    return {
      ...values,
      fullName: values.fullName ?? "",
      sourceIndex,
      confidence: "high" as const,
      warnings: [] as string[],
    };
  });
}

export function detectContactImportSourceType(
  source: string,
  filename?: string | null,
): ContactImportSourceType {
  const extension = filename?.toLowerCase().split(".").pop();
  if (extension === "json") return "json";
  if (extension === "tsv") return "tsv";
  if (extension === "csv") return "csv";
  if (extension === "txt") return "text";
  const trimmed = source.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) return "json";
  const firstLine = trimmed.split(/\r\n|\n|\r/, 1)[0] || "";
  const delimiter = firstLine.includes("\t") ? "\t" : ",";
  if (!firstLine.includes(delimiter)) return "text";
  const contactHeaders = new Set([
    ...Object.keys(CONTACT_FIELD_LIMITS).map((field) => field.toLowerCase()),
    "name",
    "full_name",
    "first name",
    "last name",
    "first_name",
    "last_name",
    "email address",
    "email_address",
    "phone number",
    "phone_number",
    "company",
  ]);
  const headers = firstLine
    .split(delimiter)
    .map((header) => header.trim().replace(/^"|"$/g, "").toLowerCase());
  if (headers.some((header) => contactHeaders.has(header)))
    return delimiter === "\t" ? "tsv" : "csv";
  return "text";
}

function parseDelimited(source: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let state: "start" | "plain" | "quoted" | "closed" = "start";
  const pushCell = () => {
    row.push(cell);
    if (row.length > MAX_SOURCE_COLUMNS)
      throw new Error(`Source row ${rows.length + 1} has more than ${MAX_SOURCE_COLUMNS} columns`);
    cell = "";
    state = "start";
  };
  const pushRow = () => {
    pushCell();
    if (row.every((value) => !value.trim()))
      throw new Error(`Source row ${rows.length + 1} is empty; remove it before importing`);
    rows.push(row);
    if (rows.length > CONTACT_IMPORT_MAX_ROWS + 1)
      throw new Error(`Source has more than ${CONTACT_IMPORT_MAX_ROWS} rows; split the file`);
    row = [];
  };
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (state === "quoted") {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') state = "closed";
      else cell += char;
    } else if (char === '"') {
      if (state !== "start")
        throw new Error(
          `Unexpected quote in source row ${rows.length + 1}, column ${row.length + 1}`,
        );
      state = "quoted";
    } else if (char === delimiter) {
      pushCell();
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      pushRow();
    } else {
      if (state === "closed")
        throw new Error(`Unexpected text after a quote in source row ${rows.length + 1}`);
      cell += char;
      state = "plain";
    }
    if (cell.length > MAX_CELL_CHARS)
      throw new Error(
        `Source row ${rows.length + 1}, column ${row.length + 1} exceeds ${MAX_CELL_CHARS} characters`,
      );
  }
  if (state === "quoted") throw new Error(`Source row ${rows.length + 1} has an unclosed quote`);
  if (row.length || cell || (source && !/[\r\n]$/.test(source))) pushRow();
  return rows;
}

function checkedRawRow(value: unknown, sourceIndex: number): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`JSON row ${sourceIndex + 1} must be an object of contact fields`);
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_SOURCE_COLUMNS)
    throw new Error(`JSON row ${sourceIndex + 1} has more than ${MAX_SOURCE_COLUMNS} fields`);
  const seenKeys = new Set<string>();
  return Object.fromEntries(
    entries.map(([key, cell]) => {
      if (!key.trim() || key.length > MAX_SOURCE_KEY_CHARS)
        throw new Error(`JSON row ${sourceIndex + 1} has an empty or oversized field name`);
      if (SOURCE_CONTROL_CHARACTERS.test(key))
        throw new Error(`JSON row ${sourceIndex + 1} has control characters in a field name`);
      const normalizedKey = key.trim().toLowerCase();
      if (seenKeys.has(normalizedKey))
        throw new Error(`JSON row ${sourceIndex + 1} repeats field ${key}`);
      seenKeys.add(normalizedKey);
      if (cell !== null && typeof cell === "object")
        throw new Error(
          `JSON row ${sourceIndex + 1}, field ${key} contains nested data; flatten it first`,
        );
      if (typeof cell === "number" && !Number.isFinite(cell))
        throw new Error(`JSON row ${sourceIndex + 1}, field ${key} has an unsupported number`);
      const text = cell === null ? "" : String(cell);
      if (SOURCE_CONTROL_CHARACTERS.test(text))
        throw new Error(`JSON row ${sourceIndex + 1}, field ${key} contains control characters`);
      if (text.length > MAX_CELL_CHARS)
        throw new Error(
          `JSON row ${sourceIndex + 1}, field ${key} exceeds ${MAX_CELL_CHARS} characters`,
        );
      return [key, text];
    }),
  );
}

function rejectRepeatedJsonKeys(source: string) {
  const scopes: Array<Set<string> | null> = [];
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === "{") scopes.push(new Set());
    else if (char === "[") scopes.push(null);
    else if (char === "}" || char === "]") scopes.pop();
    else if (char === '"') {
      const start = index;
      for (index++; index < source.length; index++) {
        if (source[index] === "\\") index++;
        else if (source[index] === '"') break;
      }
      const scope = scopes[scopes.length - 1];
      let next = index + 1;
      while (/\s/.test(source[next] ?? "")) next++;
      if (!scope || source[next] !== ":") continue;
      const key = JSON.parse(source.slice(start, index + 1)) as string;
      if (scope.has(key)) throw new Error(`JSON repeats field ${key}; remove duplicate keys`);
      scope.add(key);
    }
  }
}

export function parseContactImportSource(
  source: string,
  sourceType: ContactImportSourceType,
): Record<string, string>[] {
  if (source.length > CONTACT_IMPORT_MAX_SOURCE_CHARS)
    throw new Error(
      `Contact data exceeds ${CONTACT_IMPORT_MAX_SOURCE_CHARS.toLocaleString()} characters; split the file`,
    );
  if (SOURCE_CONTROL_CHARACTERS.test(source))
    throw new Error("Contact data contains control characters; export a clean UTF-8 file");
  const cleanSource = source.replace(/^\uFEFF/, "");
  if (sourceType === "json") {
    let parsed: unknown;
    try {
      // Node 22 retains each numeric token, avoiding rounded phone numbers or IDs.
      parsed = JSON.parse(
        cleanSource,
        (_key: string, value: unknown, context?: { source: string }) =>
          typeof value === "number" ? context!.source : value,
      );
    } catch {
      throw new Error("Invalid JSON; check quotes and commas before importing");
    }
    rejectRepeatedJsonKeys(cleanSource);
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      Array.isArray((parsed as { contacts?: unknown[] }).contacts) &&
      Object.keys(parsed).some((key) => key !== "contacts")
    )
      throw new Error(
        "JSON contact lists cannot include other top-level fields; move them into each contact row",
      );
    const values = Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === "object" &&
          Array.isArray((parsed as { contacts?: unknown[] }).contacts)
        ? (parsed as { contacts: unknown[] }).contacts
        : [parsed];
    if (values.length > CONTACT_IMPORT_MAX_ROWS)
      throw new Error(`Source has more than ${CONTACT_IMPORT_MAX_ROWS} rows; split the file`);
    return values.map(checkedRawRow);
  }
  if (sourceType === "csv" || sourceType === "tsv") {
    const matrix = parseDelimited(cleanSource, sourceType === "tsv" ? "\t" : ",");
    if (matrix.length < 2) throw new Error("Add a header and at least one contact row");
    const headers = (matrix[0] ?? []).map((header, index) => {
      const key = header.trim().toLowerCase();
      if (!key || key.length > MAX_SOURCE_KEY_CHARS)
        throw new Error(`Column ${index + 1} has an empty or oversized header`);
      return key;
    });
    if (new Set(headers).size !== headers.length)
      throw new Error("Column headers repeat; give every column a unique name");
    return matrix.slice(1).map((values, index) => {
      if (values.length !== headers.length)
        throw new Error(
          `Source row ${index + 2} has ${values.length} columns; expected ${headers.length}`,
        );
      return Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""]));
    });
  }
  const lines = cleanSource.split(/\r\n|\n|\r/).filter((line) => line.trim());
  if (lines.length > CONTACT_IMPORT_MAX_ROWS)
    throw new Error(`Source has more than ${CONTACT_IMPORT_MAX_ROWS} rows; split the file`);
  return lines.map((line, index) => {
    if (line.length > MAX_CELL_CHARS)
      throw new Error(`Text row ${index + 1} exceeds ${MAX_CELL_CHARS} characters`);
    return { text: line };
  });
}

export function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, max);
  return clean || null;
}

function normalizePhone(value: unknown): string | null {
  const clean = text(value, 60);
  if (!clean) return null;
  const normalized = clean
    .replace(/[^\d+x(). -]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || null;
}

export function normalizeWebsite(value: unknown): string | null {
  const clean = text(value, 500);
  if (!clean) return null;
  try {
    const url = new URL(clean.includes("://") ? clean : `https://${clean}`);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString().replace(/\/$/, "");
  } catch (error) {
    if (error instanceof TypeError) return null;
    throw error;
  }
}

function validEmail(value: string | null): boolean {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

export function validateContactImportFields(value: unknown): {
  data: ContactImportFields;
  errors: string[];
  warnings: string[];
} {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  for (const [field, limit] of Object.entries(CONTACT_FIELD_LIMITS)) {
    if (row[field] !== null && row[field] !== undefined && typeof row[field] !== "string")
      throw new Error(`${field} must be text`);
    if (typeof row[field] === "string" && row[field].length > limit)
      throw new Error(`${field} exceeds ${limit} characters; shorten it before saving`);
    if (typeof row[field] === "string" && SOURCE_CONTROL_CHARACTERS.test(row[field]))
      throw new Error(`${field} contains control characters; remove them before saving`);
  }
  const email = normalizeEmail(text(row.email, 320));
  const websiteInput = text(row.website, 500);
  const website = normalizeWebsite(websiteInput);
  const data: ContactImportFields = {
    fullName: text(row.fullName, 140) || "",
    email,
    phone: normalizePhone(row.phone),
    companyName: text(row.companyName, 180),
    role: text(row.role, 160),
    website,
    industry: text(row.industry, 160),
    source: text(row.source, 160),
    notes: text(row.notes, 1000),
  };
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!data.fullName) errors.push("A contact name is required");
  if (email && !validEmail(email)) errors.push("Email address is invalid");
  if (!data.email && !data.phone) errors.push("Add an email address or phone number");
  if (websiteInput && !website) errors.push("Website must be a valid http(s) address or domain");
  if (
    data.companyName &&
    !data.website &&
    (!data.email ||
      /@(gmail|googlemail|yahoo|outlook|hotmail|icloud|me|aol|protonmail|proton)\./i.test(
        data.email,
      ))
  ) {
    warnings.push(
      "Company name will remain unlinked until a business website or domain is available",
    );
  }
  return { data, errors, warnings };
}
