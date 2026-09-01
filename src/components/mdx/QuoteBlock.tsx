interface QuoteBlockProps {
  quote: string;
  author?: string;
  role?: string;
}

export function QuoteBlock({ quote, author, role }: QuoteBlockProps) {
  return (
    <blockquote className="my-8 border-l-4 border-l-[var(--gold-base)] glass rounded-r-lg py-4 px-6">
      <p className="m-0 text-lg italic text-white-primary leading-relaxed">&ldquo;{quote}&rdquo;</p>
      {author && (
        <footer className="mt-3 text-sm text-white-muted">
          -- {author}
          {role && <span className="text-white-muted">, {role}</span>}
        </footer>
      )}
    </blockquote>
  );
}
