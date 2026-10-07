"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  children: string;
  language?: string;
  title?: string;
}

export function CodeBlock({ children, language, title }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    },
    [],
  );

  const handleCopy = async () => {
    if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    setCopied(false);
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      resetTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
    }
  };

  return (
    <div className="my-6 rounded-lg glass overflow-clip">
      {(title || language) && (
        <div className="flex items-center justify-between gap-3 border-b border-border-glass px-4 py-2">
          <span className="text-xs text-white-muted font-mono">{title || language}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="flex min-h-11 min-w-11 items-center justify-center gap-1 text-xs text-white-muted hover:text-white-primary transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" /> Copy
              </>
            )}
          </button>
        </div>
      )}
      <pre className="m-0 overflow-x-auto p-4">
        <code className="text-sm text-white-secondary font-mono">{children}</code>
      </pre>
      <p
        role="status"
        className={copyFailed ? "px-4 pb-4 text-sm text-white-secondary" : "sr-only"}
      >
        {copyFailed
          ? "Copy is unavailable. Select the text above and copy it manually."
          : copied
            ? "Copied to clipboard."
            : ""}
      </p>
    </div>
  );
}
