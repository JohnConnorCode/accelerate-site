"use client";
import { useState } from "react";
import type { WebsiteDocument } from "@/lib/site-studio/website-document";
import { suggestedWebsitePath } from "@/lib/site-studio/website-authoring";
import { WebsiteRichTextEditor } from "./WebsiteContentEditor";
import {
  WebsiteFields,
  websiteButtonClass as button,
  websiteFieldClass as field,
} from "./WebsiteFields";
type Collection = WebsiteDocument["collections"][number];
type Entry = Collection["entries"][number];
export function WebsiteCollections({
  website,
  onChange,
  onPreview,
}: {
  website: WebsiteDocument;
  onChange: (document: WebsiteDocument) => void;
  onPreview: (id: string) => void;
}) {
  const [collectionId, setCollectionId] = useState("");
  const [entryId, setEntryId] = useState("");
  const [title, setTitle] = useState("");
  const collection =
    website.collections.find((item) => item.id === collectionId) ?? website.collections[0];
  const entry = collection?.entries.find((item) => item.id === entryId) ?? collection?.entries[0];
  const update = (next: Collection) =>
    onChange({
      ...website,
      collections: website.collections.map((item) => (item.id === next.id ? next : item)),
    });
  const editEntry = (next: Entry) => {
    if (collection)
      update({
        ...collection,
        entries: collection.entries.map((item) => (item.id === next.id ? next : item)),
      });
  };
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold">Collections</h2>
      <p className="text-sm text-[var(--admin-muted)]">
        Organize articles, case studies and other repeatable content. Each entry has its own page
        address.
      </p>
      <label className="block text-sm">
        New collection name
        <input
          className={field}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={160}
          placeholder="Articles"
        />
      </label>
      <button
        type="button"
        className={button}
        disabled={!title.trim() || website.collections.length >= 30}
        onClick={() => {
          const next = {
            id: `collection-${crypto.randomUUID().slice(0, 8)}`,
            title: title.trim(),
            entries: [],
          };
          onChange({ ...website, collections: [...website.collections, next] });
          setCollectionId(next.id);
          setEntryId("");
          setTitle("");
        }}
      >
        Add collection
      </button>
      {collection && (
        <>
          <label className="block text-sm">
            Collection
            <select
              className={field}
              value={collection.id}
              onChange={(event) => {
                setCollectionId(event.target.value);
                setEntryId("");
                const first = website.collections.find((item) => item.id === event.target.value)
                  ?.entries[0];
                if (first) onPreview(first.id);
              }}
            >
              {website.collections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} ({item.entries.length})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Collection title
            <input
              className={field}
              value={collection.title}
              maxLength={160}
              onChange={(event) => update({ ...collection, title: event.target.value })}
            />
          </label>
          <button
            type="button"
            className={button}
            disabled={collection.entries.length >= 1000}
            onClick={() => {
              const next: Entry = {
                id: `entry-${crypto.randomUUID().slice(0, 8)}`,
                title: "New article",
                path: suggestedWebsitePath(website, "new-article"),
                summary: "",
                metadata: { title: "New article", description: "", noIndex: false },
                body: [{ type: "paragraph", content: [{ text: "Write your introduction." }] }],
                tags: [],
              };
              update({ ...collection, entries: [...collection.entries, next] });
              setEntryId(next.id);
              onPreview(next.id);
            }}
          >
            Add entry
          </button>
          {entry && (
            <>
              <label className="block text-sm">
                Entry
                <select
                  className={field}
                  value={entry.id}
                  onChange={(event) => {
                    setEntryId(event.target.value);
                    onPreview(event.target.value);
                  }}
                >
                  {collection.entries.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Entry title
                <input
                  className={field}
                  value={entry.title}
                  maxLength={200}
                  onChange={(event) => editEntry({ ...entry, title: event.target.value })}
                />
              </label>
              <label className="block text-sm">
                Page address
                <input
                  className={field}
                  value={entry.path}
                  onChange={(event) => editEntry({ ...entry, path: event.target.value })}
                />
              </label>
              <WebsiteFields
                label="Summary"
                value={entry.summary}
                onChange={(summary) => editEntry({ ...entry, summary: summary as string })}
              />
              <WebsiteFields
                label="Search and sharing"
                value={entry.metadata}
                onChange={(metadata) =>
                  editEntry({ ...entry, metadata: metadata as Entry["metadata"] })
                }
              />
              <WebsiteFields
                label="tags"
                value={entry.tags}
                onChange={(tags) => editEntry({ ...entry, tags: tags as string[] })}
              />
              <WebsiteRichTextEditor
                value={entry.body}
                onChange={(body) => editEntry({ ...entry, body })}
              />
              <button
                type="button"
                className={button}
                onClick={() => {
                  update({
                    ...collection,
                    entries: collection.entries.filter((item) => item.id !== entry.id),
                  });
                  setEntryId("");
                }}
              >
                Remove entry from draft
              </button>
              <p className="text-xs text-[var(--admin-muted)]">
                Undo restores a removed entry before reloading. Save and publish to change the
                public collection.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
