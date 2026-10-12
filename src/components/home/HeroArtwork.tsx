/** Static, text-free brand fallback while the interactive systems artwork is reviewed. */
export function HeroArtwork() {
  return (
    <div className="home-hero-artwork" data-artwork-design="connected-systems-static">
      <svg viewBox="0 0 600 650" width="100%" height="100%" fill="none" aria-hidden="true">
        <defs>
          <linearGradient
            id="hero-metal"
            x1="160"
            y1="170"
            x2="420"
            y2="440"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="var(--bg)" />
            <stop offset="1" stopColor="var(--fg)" stopOpacity=".12" />
          </linearGradient>
          <radialGradient id="hero-signal">
            <stop stopColor="var(--fg)" stopOpacity=".16" />
            <stop offset="1" stopColor="var(--fg)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="300" cy="360" rx="245" ry="235" fill="url(#hero-signal)" />
        <g stroke="var(--fg)" strokeOpacity=".08" strokeWidth="1">
          {[160, 200, 240, 280, 320, 360, 400, 440].map((y) => (
            <path key={y} d={`M60 ${y} 300 ${y + 120} 540 ${y}`} />
          ))}
          <path d="M60 360 300 240 540 360M100 380 340 260M140 400 380 280M180 420 420 300M220 440 460 320M260 460 500 340" />
        </g>
        <g stroke="var(--fg)" strokeOpacity=".24" strokeWidth="1.5" strokeLinejoin="round">
          <path d="M100 252 190 297V350L258 384M100 398 190 353M500 252 410 297V350L342 384M500 398 410 353M300 152V264M300 446V520" />
        </g>
        <g fill="var(--bg)" stroke="var(--fg)" strokeOpacity=".26">
          {[
            [100, 252],
            [100, 398],
            [500, 252],
            [500, 398],
            [300, 152],
            [300, 520],
          ].map(([x, y]) => (
            <g key={`${x}-${y}`}>
              <path d={`M${x} ${y! - 19} ${x! + 34} ${y} ${x} ${y! + 19} ${x! - 34} ${y}Z`} />
              <circle cx={x} cy={y} r="4" fill="var(--fg)" stroke="none" />
            </g>
          ))}
        </g>
        <path
          d="m170 394 130-65 130 65-130 65Z"
          fill="url(#hero-metal)"
          stroke="var(--fg)"
          strokeOpacity=".2"
        />
        <path d="M170 394v16l130 65 130-65v-16l-130 65Z" fill="var(--fg)" fillOpacity=".08" />
        <g stroke="var(--fg)" strokeOpacity=".7" strokeLinejoin="round">
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(0 ${-i * 48})`}>
              <path
                d="M215 354v16l88 44v-16M277 307v16l26 13M339 380v16l-36 18v-16"
                fill="var(--fg)"
                fillOpacity=".12"
              />
              <path d="m215 354 88 44 36-18-62-31 42-21-42-21Z" fill="url(#hero-metal)" />
            </g>
          ))}
        </g>
        <path d="m291 359 9-5 9 5v10l-9 5-9-5Z" fill="var(--fg)" />
        <path d="M300 459v61" stroke="var(--fg)" strokeWidth="2" />
        <circle cx="300" cy="520" r="5" fill="var(--fg)" />
      </svg>
    </div>
  );
}
