"use client";

/** Content controls expose data, never executable templates or a JSON editor. */
export const websiteFieldClass = "admin-field mt-1 block w-full";
export const websiteButtonClass = "admin-button admin-button--secondary";
const humanize = (name: string) =>
  name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/-/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());

type Value = string | number | boolean | null | Value[] | { [key: string]: Value };
const emptyItem = (label: string): Value | undefined =>
  (
    ({
      navigation: { label: "New link", href: "/" },
      links: { label: "New link", href: "/" },
      assets: {
        id: `image-${crypto.randomUUID().slice(0, 8)}`,
        src: "/logo.png",
        alt: "Describe this image",
      },
      collections: {
        id: `collection-${crypto.randomUUID().slice(0, 8)}`,
        title: "New collection",
        entries: [],
      },
      entries: {
        id: `entry-${crypto.randomUUID().slice(0, 8)}`,
        path: `/new-entry-${crypto.randomUUID().slice(0, 8)}`,
        title: "New entry",
        summary: "",
        metadata: { title: "New entry", description: "", noIndex: false },
        body: [],
        tags: [],
      },
      body: { type: "paragraph", content: [{ text: "Write your content here." }] },
      content: { text: "New text" },
      tags: "New tag",
      questions: "New question",
      answers: "New answer",
      items: "New item",
    }) as Record<string, Value>
  )[label];
const fieldOptions: Record<string, string[]> = {
  background: ["surface", "surfaceDark", "accent", "transparent"],
  paddingTop: ["none", "sm", "md", "lg", "xl"],
  paddingBottom: ["none", "sm", "md", "lg", "xl"],
  maxWidth: ["narrow", "content", "wide", "full"],
  gap: ["sm", "md", "lg"],
  align: ["start", "center"],
  tone: ["default", "muted", "inverse"],
  variant: ["editorial", "split", "centered"],
  theme: ["light", "dark"],
  font: ["installation", "sans", "serif", "mono"],
  radius: ["square", "soft", "round"],
  presentation: ["interface", "photo", "slide"],
  fit: ["cover", "contain"],
  canvas: ["paper", "ink"],
};
export function WebsiteFields({
  value,
  onChange,
  label,
  disabled = false,
}: {
  value: unknown;
  onChange: (value: Value) => void;
  label: string;
  disabled?: boolean;
}) {
  if (typeof value === "string" && fieldOptions[label]?.includes(value))
    return (
      <label className="block text-sm">
        {humanize(label)}
        <select
          className={websiteFieldClass}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        >
          {fieldOptions[label].map((option) => (
            <option key={option} value={option}>
              {humanize(option)}
            </option>
          ))}
        </select>
      </label>
    );
  if (typeof value === "string" || typeof value === "number")
    return (
      <label className="block text-sm font-medium text-[var(--admin-ink)]">
        {humanize(label)}
        {typeof value === "number" ? (
          <input
            className={websiteFieldClass}
            type="number"
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(Number(event.target.value))}
          />
        ) : (
          <textarea
            className={websiteFieldClass}
            rows={value.length > 120 ? 4 : 2}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
      </label>
    );
  if (typeof value === "boolean")
    return (
      <label className="flex min-h-11 items-center gap-3 text-sm text-[var(--admin-ink)]">
        <input
          type="checkbox"
          checked={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        {humanize(label)}
      </label>
    );
  if (Array.isArray(value))
    return (
      <fieldset
        className="space-y-3 rounded-lg border border-[var(--admin-border)] p-3"
        disabled={disabled}
      >
        <legend className="px-1 text-sm font-medium">{humanize(label)}</legend>
        {value.map((item, index) => (
          <div key={index} className="space-y-2 border-b border-[var(--admin-border)] pb-3">
            <WebsiteFields
              value={item}
              label={`${label} ${index + 1}`}
              onChange={(next) =>
                onChange(value.map((old, at) => (at === index ? next : old)) as Value[])
              }
            />
            <div className="flex flex-wrap gap-2">
              <button
                className={websiteButtonClass}
                type="button"
                disabled={index === 0}
                aria-label={`Move ${label} ${index + 1} up`}
                onClick={() => {
                  const next = [...value];
                  [next[index - 1], next[index]] = [next[index], next[index - 1]];
                  onChange(next as Value[]);
                }}
              >
                Move up
              </button>
              <button
                className={websiteButtonClass}
                type="button"
                aria-label={`Remove ${label} ${index + 1}`}
                onClick={() => onChange(value.filter((_, at) => at !== index) as Value[])}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        {(value.length > 0 ||
          [
            "navigation",
            "links",
            "assets",
            "collections",
            "entries",
            "body",
            "content",
            "tags",
            "questions",
            "answers",
            "items",
          ].includes(label)) && (
          <button
            className={websiteButtonClass}
            type="button"
            onClick={() =>
              onChange([
                ...value,
                emptyItem(label) ?? structuredClone(value[value.length - 1]),
              ] as Value[])
            }
          >
            Add {humanize(label).toLowerCase()} item
          </button>
        )}
      </fieldset>
    );
  if (value && typeof value === "object")
    return (
      <fieldset className="space-y-3" disabled={disabled}>
        <legend className="mb-2 text-sm font-medium">{humanize(label)}</legend>
        {Object.entries(value)
          .filter(
            ([key]) =>
              ![
                "id",
                "type",
                "kind",
                "schemaVersion",
                "engine",
                "engineVersion",
                "template",
              ].includes(key),
          )
          .map(([key, item]) => (
            <WebsiteFields
              key={key}
              value={item}
              label={key}
              disabled={disabled}
              onChange={(next) => onChange({ ...value, [key]: next } as Value)}
            />
          ))}
      </fieldset>
    );
  return null;
}
