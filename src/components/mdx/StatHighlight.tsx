interface StatHighlightProps {
  value: string;
  label: string;
}

export function StatHighlight({ value, label }: StatHighlightProps) {
  return (
    <aside className="stat-hl">
      <p className="stat-hl-value">{value}</p>
      <p className="stat-hl-label">{label}</p>
    </aside>
  );
}
