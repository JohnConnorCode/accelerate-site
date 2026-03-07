interface SignalMarkProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function SignalMark({ size = "sm", className = "" }: SignalMarkProps) {
  const dimensions = {
    sm: 16,
    md: 24,
    lg: 320,
  };

  const px = dimensions[size];

  if (size === "lg") {
    return (
      <div
        className={`pointer-events-none select-none ${className}`}
        aria-hidden="true"
        style={{ width: px, height: px }}
      >
        <svg
          viewBox="0 0 320 320"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
          style={{ animation: "signal-pulse 6s ease-in-out infinite" }}
        >
          {/* Concentric rings */}
          <circle cx="160" cy="160" r="155" stroke="rgba(var(--accent-rgb), 0.04)" strokeWidth="0.5" />
          <circle cx="160" cy="160" r="120" stroke="rgba(var(--accent-rgb), 0.06)" strokeWidth="0.5" />
          <circle cx="160" cy="160" r="85" stroke="rgba(var(--accent-rgb), 0.08)" strokeWidth="0.5" />
          <circle cx="160" cy="160" r="50" stroke="rgba(var(--accent-rgb), 0.10)" strokeWidth="0.5" />
          {/* Crosshair lines */}
          <line x1="160" y1="0" x2="160" y2="320" stroke="rgba(var(--accent-rgb), 0.04)" strokeWidth="0.5" />
          <line x1="0" y1="160" x2="320" y2="160" stroke="rgba(var(--accent-rgb), 0.04)" strokeWidth="0.5" />
          {/* Center glow dot */}
          <circle cx="160" cy="160" r="4" fill="var(--gold-base)" opacity="0.3" />
          <circle cx="160" cy="160" r="2" fill="var(--gold-light)" opacity="0.5" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
      aria-hidden="true"
      style={{ width: px, height: px }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Outer ring */}
        <circle cx="12" cy="12" r="11" stroke="var(--gold-base)" strokeWidth="0.5" opacity="0.3" />
        {/* Inner ring */}
        <circle cx="12" cy="12" r="7" stroke="var(--gold-base)" strokeWidth="0.5" opacity="0.4" />
        {/* Crosshair lines */}
        <line x1="12" y1="1" x2="12" y2="23" stroke="var(--gold-base)" strokeWidth="0.3" opacity="0.25" />
        <line x1="1" y1="12" x2="23" y2="12" stroke="var(--gold-base)" strokeWidth="0.3" opacity="0.25" />
        {/* Center dot */}
        <circle cx="12" cy="12" r="1.5" fill="var(--gold-base)" opacity="0.6" />
      </svg>
    </div>
  );
}
