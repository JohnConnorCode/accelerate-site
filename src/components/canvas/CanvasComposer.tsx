"use client";

import { useState } from "react";
import { ArrowUp } from "lucide-react";

/**
 * Composer laid over a canvas: one line that hands the question to the
 * workspace AI with the canvas context. It never sends anything on its own.
 */
export function CanvasComposer({
  label,
  placeholder,
  onSubmit,
}: {
  label: string;
  placeholder: string;
  onSubmit(text: string): void;
}) {
  const [text, setText] = useState("");
  return (
    <form
      className="admin-composer admin-canvas-composer"
      onSubmit={(event) => {
        event.preventDefault();
        const value = text.trim();
        if (!value) return;
        onSubmit(value);
        setText("");
      }}
    >
      <span className="admin-canvas-orb" aria-hidden="true" />
      <input
        className="admin-composer-field admin-canvas-composer-field"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <button
        type="submit"
        className="admin-composer-action admin-canvas-composer-send"
        aria-label="Ask"
        disabled={!text.trim()}
      >
        <ArrowUp className="size-4" aria-hidden="true" />
      </button>
    </form>
  );
}
