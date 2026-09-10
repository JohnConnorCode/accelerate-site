"use client";
import { useState } from "react";
import type { WebsitePage, WebsiteRichText } from "@/lib/site-studio/website-document";
import { nativeTemplateDefaults } from "@/lib/site-studio/native-templates";
import { servicePageTemplate } from "@/lib/site-studio/templates";
import {
  WebsiteFields,
  websiteButtonClass as button,
  websiteFieldClass as field,
} from "./WebsiteFields";

export function WebsiteContentEditor({
  page,
  onChange,
}: {
  page: WebsitePage;
  onChange: (content: WebsitePage["content"]) => void;
}) {
  const [starter, setStarter] = useState("");
  const content = page.content;
  if (content.kind === "article")
    return (
      <WebsiteRichTextEditor
        value={content.body}
        onChange={(body) => onChange({ ...content, body })}
      />
    );
  const rows = content.kind === "native" ? content.sections : content.document.root;
  const templates =
    content.kind === "native"
      ? Object.keys(nativeTemplateDefaults)
      : ["hero", "what-you-get", "questions", "next-step"];
  const replace = (items: (typeof rows)[number][]) => {
    if (content.kind === "native")
      onChange({ ...content, sections: items as typeof content.sections });
    else
      onChange({
        ...content,
        document: { ...content.document, root: items as typeof content.document.root },
      });
  };
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Page sections</h3>
      {rows.map((section, index) => (
        <details key={section.id} className="rounded-lg border border-[var(--admin-border)] p-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
            {index + 1}.{" "}
            {"template" in section
              ? section.template.replace(/^home-/, "").replace(/-/g, " ")
              : section.children.map((child) => child.type).join(", ")}
          </summary>
          <div className="mb-4 flex flex-wrap gap-2">
            {[-1, 1].map((direction) => (
              <button
                type="button"
                key={direction}
                className={button}
                disabled={index + direction < 0 || index + direction >= rows.length}
                aria-label={`Move section ${index + 1} ${direction === -1 ? "up" : "down"}`}
                onClick={() => {
                  const next = [...rows];
                  [next[index], next[index + direction]] = [next[index + direction]!, next[index]!];
                  replace(next);
                }}
              >
                {direction === -1 ? "Move up" : "Move down"}
              </button>
            ))}
            <button
              type="button"
              className={button}
              disabled={rows.length <= 1}
              onClick={() => replace(rows.filter((_, at) => at !== index))}
            >
              Remove section
            </button>
          </div>
          {"fields" in section ? (
            <>
              <label className="mb-3 flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={section.hidden}
                  onChange={(event) =>
                    replace(
                      rows.map((row, at) =>
                        at === index ? { ...section, hidden: event.target.checked } : row,
                      ),
                    )
                  }
                />
                Hide section
              </label>
              <WebsiteFields
                value={section.fields}
                label="Content"
                onChange={(fields) =>
                  replace(
                    rows.map((row, at) =>
                      at === index
                        ? { ...section, fields: fields as Record<string, unknown> }
                        : row,
                    ),
                  )
                }
              />
            </>
          ) : (
            <>
              {section.children.map((child, childIndex) => (
                <fieldset key={child.id} className="mb-4 space-y-3">
                  <legend className="mb-2 text-sm font-medium">{child.type}</legend>
                  <WebsiteFields
                    value={child.props}
                    label="Content"
                    onChange={(props) =>
                      replace(
                        rows.map((row, at) =>
                          at === index
                            ? ({
                                ...section,
                                children: section.children.map((node, position) =>
                                  position === childIndex ? { ...node, props } : node,
                                ),
                              } as typeof section)
                            : row,
                        ),
                      )
                    }
                  />
                </fieldset>
              ))}
              <WebsiteFields
                value={
                  section.styles ?? {
                    background: "transparent",
                    paddingTop: "md",
                    paddingBottom: "md",
                  }
                }
                label="Section appearance"
                onChange={(styles) =>
                  replace(
                    rows.map((row, at) =>
                      at === index ? ({ ...section, styles } as typeof section) : row,
                    ),
                  )
                }
              />
            </>
          )}
        </details>
      ))}
      <div className="flex gap-2">
        <select
          aria-label="Section template"
          className={field}
          value={starter}
          onChange={(event) => setStarter(event.target.value)}
        >
          <option value="">Choose a section…</option>
          {templates.map((key) => (
            <option key={key} value={key}>
              {key.replace(/^home-/, "").replace(/-/g, " ")}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={button}
          disabled={!starter || rows.length >= 100}
          onClick={() => {
            const id = `section-${crypto.randomUUID().slice(0, 8)}`;
            if (content.kind === "native") {
              const fields = structuredClone(
                nativeTemplateDefaults[starter as keyof typeof nativeTemplateDefaults],
              );
              if (fields)
                onChange({
                  ...content,
                  sections: [...content.sections, { id, template: starter, fields, hidden: false }],
                });
            } else {
              const section = servicePageTemplate({
                serviceName: page.metadata.title,
                audience: "Your audience",
                outcome: "Describe the result.",
              }).root.find((section) => section.id === starter);
              if (section)
                onChange({
                  ...content,
                  document: {
                    ...content.document,
                    root: [
                      ...content.document.root,
                      {
                        ...section,
                        id,
                        children: section.children.map((child, index) => ({
                          ...child,
                          id: `${id}-${index}`,
                        })),
                      },
                    ],
                  },
                });
            }
            setStarter("");
          }}
        >
          Add section
        </button>
      </div>
    </div>
  );
}
const richDefaults: Record<string, WebsiteRichText[number]> = {
  paragraph: { type: "paragraph", content: [{ text: "New paragraph" }] },
  heading: { type: "heading", level: 2, content: [{ text: "New heading" }] },
  quote: { type: "quote", content: [{ text: "New quote" }] },
  list: { type: "list", ordered: false, items: [[{ text: "New item" }]] },
  code: { type: "code", language: "", text: "Code example" },
  divider: { type: "divider" },
};
export function WebsiteRichTextEditor({
  value,
  onChange,
}: {
  value: WebsiteRichText;
  onChange: (value: WebsiteRichText) => void;
}) {
  const [kind, setKind] = useState("paragraph");
  return (
    <fieldset className="space-y-3">
      <legend className="mb-3 text-sm font-semibold">Article content</legend>
      {value.map((block, index) => (
        <details key={index} open className="rounded-lg border border-[var(--admin-border)] p-3">
          <summary className="min-h-10 py-2 text-sm font-medium">
            {index + 1}. {block.type}
          </summary>
          <WebsiteFields
            value={block}
            label="Content"
            onChange={(next) =>
              onChange(
                value.map((old, at) => (at === index ? (next as WebsiteRichText[number]) : old)),
              )
            }
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className={button}
              disabled={index === 0}
              onClick={() => {
                const next = [...value];
                [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
                onChange(next);
              }}
            >
              Move up
            </button>
            <button
              type="button"
              className={button}
              onClick={() => onChange(value.filter((_, at) => at !== index))}
            >
              Remove block
            </button>
          </div>
        </details>
      ))}
      <div className="flex gap-2">
        <select
          aria-label="Text block type"
          className={field}
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          {Object.keys(richDefaults).map((kind) => (
            <option key={kind}>{kind}</option>
          ))}
        </select>
        <button
          type="button"
          className={button}
          onClick={() => onChange([...value, structuredClone(richDefaults[kind]!)])}
        >
          Add block
        </button>
      </div>
    </fieldset>
  );
}
