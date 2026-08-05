const ITEMS = [
  "Revenue systems",
  "Workflow automation",
  "Custom integrations",
  "AI agents",
  "Forecasting and analytics",
  "Internal tools",
  "Team enablement",
];

export function Marquee() {
  const loop = [...ITEMS, ...ITEMS];
  return (
    <div className="ink-panel">
      <div className="mq">
        <div className="mq-track marquee-track" aria-hidden="true">
          {loop.map((item, i) => (
            <span key={i}>
              <b>{item}</b> /
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
