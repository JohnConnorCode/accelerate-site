"use client";

import { motion } from "framer-motion";

/**
 * Abstract network/constellation illustration for hero sections.
 * Gold nodes connected by lines - represents AI, connectivity, automation.
 */
export function NetworkIllustration({ className }: { className?: string }) {
  const nodes = [
    { cx: 120, cy: 80, r: 4 },
    { cx: 220, cy: 40, r: 3 },
    { cx: 320, cy: 100, r: 5 },
    { cx: 180, cy: 160, r: 3.5 },
    { cx: 280, cy: 180, r: 4 },
    { cx: 80, cy: 200, r: 3 },
    { cx: 360, cy: 220, r: 3.5 },
    { cx: 160, cy: 260, r: 4.5 },
    { cx: 260, cy: 280, r: 3 },
    { cx: 400, cy: 140, r: 4 },
    { cx: 40, cy: 120, r: 2.5 },
    { cx: 340, cy: 300, r: 3 },
    { cx: 440, cy: 60, r: 3 },
    { cx: 200, cy: 320, r: 2.5 },
    { cx: 420, cy: 260, r: 3.5 },
  ];

  const edges: [number, number][] = [
    [0, 1], [1, 2], [0, 3], [2, 4], [3, 4], [0, 5],
    [2, 9], [4, 6], [3, 7], [7, 8], [4, 8], [6, 14],
    [8, 11], [7, 13], [9, 12], [5, 10], [9, 6], [1, 12],
  ];

  return (
    <svg viewBox="0 0 480 360" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="net-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#F5D060" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#E8D5A3" stopOpacity="0.2" />
        </linearGradient>
        <radialGradient id="node-glow">
          <stop offset="0%" stopColor="#F5D060" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Edges */}
      {edges.map(([a, b], i) => {
        const nodeA = nodes[a]!;
        const nodeB = nodes[b]!;
        return (
        <motion.line
          key={`e${i}`}
          x1={nodeA.cx} y1={nodeA.cy}
          x2={nodeB.cx} y2={nodeB.cy}
          stroke="url(#net-grad)"
          strokeWidth="1"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.3 + i * 0.06, ease: "easeOut" }}
        />
        );
      })}

      {/* Nodes */}
      {nodes.map((node, i) => (
        <motion.g key={`n${i}`}>
          <circle cx={node.cx} cy={node.cy} r={node.r * 4} fill="url(#node-glow)" opacity="0.3" />
          <motion.circle
            cx={node.cx} cy={node.cy} r={node.r}
            fill="#D4AF37"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.5 + i * 0.05, ease: "backOut" }}
          />
        </motion.g>
      ))}
    </svg>
  );
}

/**
 * Simplified dashboard mockup illustration.
 * Shows a website/dashboard UI with metrics, charts, and cards.
 */
export function DashboardMockup({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 480 320" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="dash-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#F5D060" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="dash-bar" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#F5D060" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      {/* Browser chrome */}
      <rect x="20" y="10" width="440" height="300" rx="12" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <rect x="20" y="10" width="440" height="36" rx="12" fill="rgba(255,255,255,0.05)" />
      <circle cx="44" cy="28" r="5" fill="rgba(255,255,255,0.1)" />
      <circle cx="62" cy="28" r="5" fill="rgba(255,255,255,0.1)" />
      <circle cx="80" cy="28" r="5" fill="rgba(255,255,255,0.1)" />
      <rect x="120" y="22" width="200" height="12" rx="6" fill="rgba(255,255,255,0.05)" />

      {/* Sidebar */}
      <rect x="20" y="46" width="100" height="264" fill="rgba(255,255,255,0.02)" />
      <line x1="120" y1="46" x2="120" y2="310" stroke="rgba(255,255,255,0.06)" />
      <rect x="32" y="60" width="76" height="8" rx="4" fill="url(#dash-gold)" opacity="0.6" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x="32" y={84 + i * 28} width={60 - i * 6} height="6" rx="3" fill={i === 0 ? "rgba(212,175,55,0.3)" : "rgba(255,255,255,0.06)"} />
      ))}

      {/* Stat cards */}
      {[0, 1, 2].map((i) => (
        <g key={`stat${i}`}>
          <rect x={136 + i * 110} y="60" width="96" height="56" rx="8" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.06)" />
          <rect x={148 + i * 110} y="72" width="40" height="6" rx="3" fill="rgba(255,255,255,0.08)" />
          <rect x={148 + i * 110} y="86" width="56" height="14" rx="4" fill={i === 0 ? "url(#dash-gold)" : "rgba(255,255,255,0.1)"} opacity={i === 0 ? 0.5 : 1} />
        </g>
      ))}

      {/* Chart area */}
      <rect x="136" y="130" width="204" height="120" rx="8" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" />
      <polyline
        points="152,220 180,200 210,210 240,180 270,190 300,160 320,170"
        stroke="#D4AF37"
        strokeWidth="2"
        fill="none"
        opacity="0.6"
      />
      <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
      </linearGradient>
      <polygon
        points="152,220 180,200 210,210 240,180 270,190 300,160 320,170 320,236 152,236"
        fill="url(#chart-fill)"
      />

      {/* Right panel - list items */}
      <rect x="356" y="130" width="90" height="120" rx="8" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" />
      {[0, 1, 2, 3].map((i) => (
        <g key={`li${i}`}>
          <circle cx="372" cy={152 + i * 26} r="4" fill={i === 0 ? "#D4AF37" : "rgba(255,255,255,0.1)"} opacity={i === 0 ? 0.6 : 1} />
          <rect x="384" y={148 + i * 26} width={40 - i * 4} height="6" rx="3" fill="rgba(255,255,255,0.08)" />
        </g>
      ))}

      {/* Bottom bar chart */}
      <rect x="136" y="264" width="310" height="40" rx="8" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" />
      {([16, 24, 20, 30, 26, 18, 22] as const).map((h, i) => (
          <rect
            key={`bar${i}`}
            x={160 + i * 38}
            y={292 - h}
            width="16"
            height={h}
            rx="2"
            fill="url(#dash-bar)"
            opacity={0.4 + (i % 3) * 0.1}
          />
      ))}
    </svg>
  );
}

/**
 * Abstract geometric pattern for section backgrounds.
 * Subtle grid with highlighted intersection points.
 */
export function GridPattern({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" fill="none" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="grid-dot">
          <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Grid lines */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <g key={`grid${i}`}>
          <line x1={i * 50} y1="0" x2={i * 50} y2="400" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          <line x1="0" y1={i * 50} x2="400" y2={i * 50} stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
        </g>
      ))}

      {/* Highlighted intersections */}
      {[
        [100, 100], [300, 100], [200, 200], [100, 300], [300, 300],
        [150, 150], [250, 250], [350, 150], [50, 250],
      ].map(([cx, cy], i) => (
        <g key={`dot${i}`}>
          <circle cx={cx} cy={cy} r="12" fill="url(#grid-dot)" />
          <circle cx={cx} cy={cy} r="2" fill="#D4AF37" opacity="0.5" />
        </g>
      ))}

      {/* Connecting lines between some dots */}
      {[
        [100, 100, 200, 200], [200, 200, 300, 100], [200, 200, 300, 300],
        [200, 200, 100, 300], [150, 150, 250, 250],
      ].map(([x1, y1, x2, y2], i) => (
        <line key={`conn${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(212,175,55,0.08)" strokeWidth="1" />
      ))}
    </svg>
  );
}

/**
 * Floating abstract shapes for visual interest.
 * Circles, rings, and dots in gold tones.
 */
export function FloatingShapes({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 400" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="shape-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#F5D060" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Large ring */}
      <circle cx="100" cy="80" r="50" stroke="rgba(212,175,55,0.12)" strokeWidth="1" fill="none" />
      <circle cx="100" cy="80" r="35" stroke="rgba(212,175,55,0.08)" strokeWidth="0.5" fill="none" />

      {/* Small filled circles */}
      <circle cx="60" cy="160" r="6" fill="url(#shape-grad)" />
      <circle cx="140" cy="200" r="8" fill="url(#shape-grad)" />
      <circle cx="80" cy="280" r="5" fill="url(#shape-grad)" />

      {/* Diamond */}
      <motion.path
        d="M100 240 L120 260 L100 280 L80 260 Z"
        stroke="rgba(212,175,55,0.2)"
        strokeWidth="1"
        fill="rgba(212,175,55,0.04)"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: "100px 260px" }}
      />

      {/* Dots scattered */}
      {[
        [30, 40], [170, 120], [20, 220], [160, 320], [100, 360],
        [40, 340], [150, 60], [80, 140], [120, 330],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="1.5" fill="#D4AF37" opacity={0.15 + (i % 3) * 0.1} />
      ))}
    </svg>
  );
}

/**
 * Stylized AI/automation icon illustration for service sections.
 */
export function AICircuitIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="circuit-center">
          <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.3" />
          <stop offset="70%" stopColor="#D4AF37" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Center glow */}
      <circle cx="100" cy="100" r="60" fill="url(#circuit-center)" />

      {/* Orbiting rings */}
      <circle cx="100" cy="100" r="40" stroke="rgba(212,175,55,0.15)" strokeWidth="1" fill="none" strokeDasharray="4 6" />
      <circle cx="100" cy="100" r="60" stroke="rgba(212,175,55,0.1)" strokeWidth="0.5" fill="none" />
      <circle cx="100" cy="100" r="80" stroke="rgba(212,175,55,0.06)" strokeWidth="0.5" fill="none" strokeDasharray="2 8" />

      {/* Center node */}
      <circle cx="100" cy="100" r="8" fill="#D4AF37" opacity="0.4" />
      <circle cx="100" cy="100" r="4" fill="#F5D060" opacity="0.7" />

      {/* Orbiting nodes */}
      {[0, 60, 120, 180, 240, 300].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const r = i % 2 === 0 ? 40 : 60;
        const cx = 100 + r * Math.cos(rad);
        const cy = 100 + r * Math.sin(rad);
        return (
          <g key={i}>
            <line x1="100" y1="100" x2={cx} y2={cy} stroke="rgba(212,175,55,0.1)" strokeWidth="0.5" />
            <circle cx={cx} cy={cy} r="3" fill="#D4AF37" opacity={0.3 + (i % 3) * 0.15} />
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Flow diagram showing tasks moving between systems.
 * Useful for automation/operations sections.
 */
export function AutomationFlowIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 220" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="flow-card" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1c1c1c" />
          <stop offset="100%" stopColor="#101010" />
        </linearGradient>
        <linearGradient id="flow-line" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#F5D060" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      <rect x="20" y="20" width="320" height="180" rx="16" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.05)" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect
            x={40 + i * 96}
            y="50"
            width="88"
            height="52"
            rx="10"
            fill="url(#flow-card)"
            stroke="rgba(255,255,255,0.06)"
          />
          <rect
            x={52 + i * 96}
            y="64"
            width="32"
            height="8"
            rx="4"
            fill={i === 1 ? "rgba(212,175,55,0.4)" : "rgba(255,255,255,0.08)"}
          />
          <rect
            x={52 + i * 96}
            y="80"
            width="52"
            height="6"
            rx="3"
            fill="rgba(255,255,255,0.08)"
          />
        </g>
      ))}

      {/* Connectors */}
      {[0, 1].map((i) => (
        <g key={`connector-${i}`}>
          <path
            d={`M ${96 + i * 96} 76 H ${116 + i * 96}`}
            stroke="url(#flow-line)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx={116 + i * 96} cy="76" r="5" fill="rgba(212,175,55,0.15)" stroke="rgba(212,175,55,0.3)" />
        </g>
      ))}

      {/* Bottom swimlanes */}
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={`lane-${i}`}
          x="40"
          y={120 + i * 18}
          width={260 - i * 30}
          height="10"
          rx="5"
          fill="rgba(255,255,255,0.04)"
        />
      ))}

      {/* Pulsing data packets */}
      {[0, 1, 2].map((i) => (
        <motion.circle
          key={`packet-${i}`}
          cx={60 + i * 90}
          cy={160 + (i % 2) * 18}
          r="5"
          fill="#D4AF37"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1, 0.8] }}
          transition={{ duration: 3, delay: i * 0.4, repeat: Infinity }}
        />
      ))}
    </svg>
  );
}

/**
 * Chat interface mockup for AI agent / support sections.
 */
export function ChatAgentIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 260" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="chat-bubble-user" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#F5D060" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      <rect x="10" y="20" width="300" height="220" rx="24" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" />
      <rect x="26" y="36" width="268" height="32" rx="16" fill="rgba(255,255,255,0.03)" />
      <circle cx="46" cy="52" r="8" fill="rgba(255,255,255,0.08)" />
      <circle cx="66" cy="52" r="8" fill="rgba(255,255,255,0.08)" />
      <circle cx="86" cy="52" r="8" fill="rgba(255,255,255,0.08)" />

      {/* Bubbles */}
      <rect x="34" y="84" width="180" height="44" rx="14" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.04)" />
      <rect x="34" y="140" width="140" height="38" rx="14" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.04)" />
      <rect x="34" y="192" width="200" height="32" rx="14" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.04)" />

      <rect x="170" y="102" width="120" height="44" rx="16" fill="url(#chat-bubble-user)" opacity="0.4" />
      <rect x="190" y="156" width="90" height="38" rx="16" fill="url(#chat-bubble-user)" opacity="0.5" />

      {/* Typing avatar */}
      <circle cx="260" cy="208" r="18" fill="rgba(212,175,55,0.15)" stroke="rgba(212,175,55,0.35)" />
      <circle cx="260" cy="208" r="8" fill="#D4AF37" opacity="0.8" />
      <motion.circle
        cx="260"
        cy="208"
        r="12"
        stroke="#D4AF37"
        strokeWidth="1"
        fill="none"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.7, 0] }}
        transition={{ duration: 2.4, repeat: Infinity }}
      />

      {/* Message ticks */}
      <path d="M210 176 L215 181 L224 167" stroke="rgba(0,0,0,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
