interface ComparisonTableProps {
  headers: string[];
  rows: string[][];
}

export function ComparisonTable({ headers, rows }: ComparisonTableProps) {
  if (!headers || !rows) return null;

  return (
    <div className="my-8 overflow-x-auto rounded-lg glass">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-gold">
            {headers.map((header) => (
              <th
                key={header}
                className="px-4 py-3 text-left font-display font-semibold text-gold-gradient"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border-glass last:border-b-0">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-white-secondary">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
