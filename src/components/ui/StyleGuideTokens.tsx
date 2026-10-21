"use client";

import { useEffect, useState } from "react";

export function StyleGuideTokens({
  tokens,
  swatches = false,
}: {
  tokens: string[];
  swatches?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const root = document.documentElement;
    const read = () => {
      const style = getComputedStyle(root);
      setValues(
        Object.fromEntries(tokens.map((token) => [token, style.getPropertyValue(token).trim()])),
      );
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
    return () => observer.disconnect();
  }, [tokens]);
  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tokens.map((token) => (
        <div key={token} className="min-w-0 border border-[var(--rule)] p-4">
          {swatches && (
            <div
              className="mb-4 h-16 border border-[var(--rule)]"
              style={{ background: `var(${token})` }}
              aria-hidden="true"
            />
          )}
          <dt className="font-mono text-xs">{token}</dt>
          <dd className="mt-2 break-words font-mono text-xs text-[var(--mid)]" data-token={token}>
            {values[token] ?? "Reading stylesheet…"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
