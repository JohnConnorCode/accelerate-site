interface StatHighlightProps {
  value: string;
  label: string;
}

export function StatHighlight({ value, label }: StatHighlightProps) {
  return (
    <div className="my-6 flex flex-col items-center text-center glass rounded-lg py-6 px-4">
      <span className="text-4xl font-display font-bold text-gold-gradient">
        {value}
      </span>
      <span className="mt-2 text-sm text-white-secondary">{label}</span>
    </div>
  );
}
