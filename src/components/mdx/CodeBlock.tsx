"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  children: string;
  language?: string;
  title?: string;
}

export function CodeBlock({ children, language, title }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-6 rounded-lg glass overflow-hidden">
      {(title || language) && (
        <div className="flex items-center justify-between border-b border-border-glass px-4 py-2">
          <span className="text-xs text-white-muted font-mono">
            {title || language}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-white-muted hover:text-white-primary transition-colors"
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
    </div>
  );
}
