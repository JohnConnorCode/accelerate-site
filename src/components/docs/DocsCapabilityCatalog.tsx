import Link from "next/link";
import { capabilities } from "@/content/command-center";
import { businessAreas } from "@/content/command-center-business";

/**
 * Renders the Command Center capability list from src/content/command-center.ts.
 * Docs must not copy that list into MDX; this is the single display path so
 * the public page and the reference cannot drift.
 */
export function DocsCapabilityCatalog() {
  return (
    <div className="not-prose mt-8 space-y-10">
      {businessAreas.map((category) => {
        const items = capabilities.filter((capability) => capability.businessArea === category.id);
        if (!items.length) return null;
        return (
          <section key={category.id} aria-labelledby={`cap-${category.id}`}>
            <h2
              id={`cap-${category.id}`}
              className="font-display text-xl font-semibold tracking-[-0.02em] text-heading"
            >
              {category.title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-white-secondary">{category.outcome}</p>
            <Link
              href={category.guideHref}
              className="inline-flex min-h-10 items-center text-sm underline underline-offset-4"
            >
              Follow the practical guide
            </Link>
            <dl className="mt-4 divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
              {items.map((item) => (
                <div key={item.id} id={item.id} className="scroll-mt-28 py-4">
                  <dt className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-medium text-heading">
                    {item.title}
                    {item.gated ? (
                      <span className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-white-muted">
                        Review workflow
                      </span>
                    ) : null}
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-white-secondary">
                    {item.promise} {item.detail}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </div>
  );
}
