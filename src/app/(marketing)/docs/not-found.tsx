import Link from "next/link";
import { BookOpen } from "lucide-react";
import { docsManifest } from "@/content/docs/manifest";

export default function DocsNotFound() {
  return (
    <>
      <p className="mb-4 font-mono text-[0.66rem] uppercase tracking-[0.2em] text-white-muted">
        Documentation
      </p>
      <h1 className="max-w-[20ch] text-balance font-display text-[clamp(2rem,4.5vw,3.25rem)] font-medium leading-[1.04] tracking-[-0.04em] text-heading">
        That page is not in the docs
      </h1>
      <p className="mt-4 max-w-xl text-pretty text-lg leading-relaxed text-white-secondary">
        It may have moved or never existed. These sections do:
      </p>
      <ul className="mt-8 flex max-w-xl flex-col gap-3">
        <li>
          <Link href="/docs" className="inline-flex items-center gap-2 font-medium text-heading hover:underline">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            Docs landing
          </Link>
        </li>
        {docsManifest.map((section) => (
          <li key={section.id}>
            <Link
              href={`/docs/${section.id}`}
              className="inline-flex items-center gap-2 font-medium text-heading hover:underline"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              {section.title}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
