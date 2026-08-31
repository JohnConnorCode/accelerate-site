import type { Metadata } from "next";
import { seoMetadata } from "@/lib/og";
import { Container, Eyebrow, Heading, Section, Stack } from "@/components/v2/studio/primitives";

// Internal design-system reference. Unlinked + noindex so it stays off SERPs.
export const metadata: Metadata = {
  ...seoMetadata({
    title: "Style guide",
    description: "Design system tokens, primitives, and patterns.",
    path: "/style-guide",
  }),
  robots: { index: false, follow: false },
};

const COLORS: { name: string; cls: string; note: string }[] = [
  { name: "bg-base",          cls: "bg-bg-base border border-border-glass",      note: "page background" },
  { name: "bg-elevated",      cls: "bg-bg-elevated",                              note: "cards / consoles" },
  { name: "gold",             cls: "bg-gold",                                     note: "primary accent / CTAs" },
  { name: "heading",          cls: "bg-[var(--heading-color)]",                   note: "h1/h2 text color" },
  { name: "white-secondary",  cls: "bg-[color:var(--white-secondary)]",           note: "body text" },
  { name: "white-muted",      cls: "bg-[color:var(--white-muted)]",               note: "meta / captions" },
  { name: "border-glass",     cls: "bg-border-glass",                             note: "rules / hairlines" },
  { name: "border-gold",      cls: "bg-border-gold",                              note: "accent rules" },
];

const TIERS = [
  { name: "wide  · --content-max",    width: "wide" as const,   value: "100rem · 1600px", use: "Editorial / full-bleed lists / nav / footer (Hero, Industries, Proof, ClosingCTA)" },
  { name: "narrow · --content-narrow", width: "narrow" as const, value: "76rem · 1216px", use: "Paired text + focal panel (ScrollSequence, Services, ValueBand)" },
  { name: "text · --content-text",    width: "text" as const,   value: "56rem · 896px",  use: "Reading-only / manifesto / docs" },
];

const MOTION = [
  { token: "--motion-instant", value: "0.15s", use: "Hover state, toggle" },
  { token: "--motion-fast",    value: "0.25s", use: "Small UI transitions" },
  { token: "--motion-base",    value: "0.4s",  use: "Reveal, crossfade, card hover" },
  { token: "--motion-slow",    value: "0.7s",  use: "Heading reveal, sequence step" },
  { token: "--motion-hero",    value: "1s",    use: "Hero entrance" },
  { token: "--ease-out",       value: "cubic-bezier(0.22, 1, 0.36, 1)", use: "Brand ease, use everywhere" },
  { token: "--ease-spring",    value: "cubic-bezier(0.34, 1.56, 0.64, 1)", use: "Springy reveals" },
];

const PRIMITIVES = [
  { name: "<Container width>",         note: "page-shell with width tier (wide | narrow | text)" },
  { name: "<Section>",                 note: "section-y + Container; pass `bleed` to opt out for full-bleed bands" },
  { name: "<Eyebrow>",                 note: "the '[ label ]' bracket marker, single style across the site" },
  { name: "<Heading size=1|2|3>",      note: "display-1/2/3 scale; nest `<span className='display-italic'>…</span>` for the gold accent" },
  { name: "<BookCallButton variant>",  note: "the standard primary CTA; variant='inverse' for lime backgrounds" },
  { name: "<Stack gap>",               note: "vertical rhythm; tight | cozy | roomy" },
];

const ANTI_PATTERNS = [
  "text-[var(--heading-color)]    →  text-heading",
  "text-[var(--white-muted)]      →  text-white-muted",
  "text-[var(--gold-base)]        →  text-gold",
  "bg-[var(--gold-base)]          →  bg-gold",
  "border-[var(--border-glass)]   →  border-border-glass",
  "const EASE = [0.22,1,0.36,1]   →  import { EASE } from '@/lib/animations'",
  "font-mono text-xs uppercase tracking-[0.3em] text-gold  →  <Eyebrow>label</Eyebrow>",
  "<p className='py-24'>           →  <Section>…</Section> (uses section-y token)",
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-6 border-t border-border-glass py-8 lg:grid-cols-[18rem_1fr] lg:gap-16">
      <div className="text-sm font-semibold uppercase tracking-[0.2em] text-white-muted">{label}</div>
      <div>{children}</div>
    </div>
  );
}

export default function StyleGuide() {
  return (
    <main className="bg-bg-base text-white-secondary">
      {/* hero */}
      <Section width="text" className="pt-40">
        <Stack gap="roomy">
          <Eyebrow>style guide</Eyebrow>
          <Heading size={2}>
            The system, <span className="display-italic">made visible.</span>
          </Heading>
          <p className="max-w-xl text-lg leading-relaxed text-white-muted">
            Tokens, primitives, and patterns that the /v2 surface runs on. One source of truth for
            width, type, color, motion, and rhythm. Anything you build here should compose these,
            not inline values.
          </p>
        </Stack>
      </Section>

      <Section width="wide">
        {/* colors */}
        <Row label="01 / Color tokens">
          <Stack gap="cozy">
            <p className="text-sm text-white-muted">
              Exposed via <code className="font-mono text-gold">@theme inline</code>; use the Tailwind utility form,
              never <code className="font-mono">text-[var(--…)]</code>.
            </p>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {COLORS.map(c => (
                <div key={c.name} className="rounded-md border border-border-glass p-3">
                  <div className={`h-14 w-full rounded-sm ${c.cls}`} />
                  <p className="mt-2.5 font-mono text-[0.7rem] uppercase tracking-[0.15em] text-heading">{c.name}</p>
                  <p className="font-mono text-[0.65rem] text-white-muted">{c.note}</p>
                </div>
              ))}
            </div>
          </Stack>
        </Row>

        {/* typography */}
        <Row label="02 / Typography">
          <Stack gap="cozy">
            <p className="text-sm text-white-muted">
              Three display sizes + the eyebrow + body. Always compose; do not inline <code className="font-mono">clamp()</code> recipes.
            </p>
            <div className="flex flex-col gap-8">
              <div>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-white-muted">display-1 · clamp(3.5rem, 11vw, 10rem)</p>
                <Heading size={1} className="mt-2">Let&apos;s <span className="display-italic">talk.</span></Heading>
              </div>
              <div>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-white-muted">display-2 · clamp(2rem, 5vw, 4.5rem)</p>
                <Heading size={2} className="mt-2">The systems that <span className="display-italic">do the work.</span></Heading>
              </div>
              <div>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-white-muted">display-3 · clamp(2.2rem, 4.5vw, 4rem)</p>
                <Heading size={3} className="mt-2">It comes in.</Heading>
              </div>
              <div>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-white-muted">eyebrow · &lt;Eyebrow&gt;</p>
                <div className="mt-3">
                  <Eyebrow>watch it work</Eyebrow>
                </div>
              </div>
              <div>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-white-muted">body</p>
                <p className="mt-2 max-w-xl text-lg leading-relaxed text-white-muted">
                  Custom business solutions, powered by AI, built and run for you to solve real
                  problems, save time, and grow revenue.
                </p>
              </div>
            </div>
          </Stack>
        </Row>

        {/* width tiers */}
        <Row label="03 / Width tiers">
          <Stack gap="cozy">
            <p className="text-sm text-white-muted">
              Same gutters (<code className="font-mono">px-6 / sm:px-10 / lg:px-16</code>), three caps. Nav/footer = <b>wide</b>.
              Narrow sections are intentionally inset for content density. Don&apos;t unify; vary on purpose.
            </p>
            <div className="flex flex-col gap-4">
              {TIERS.map(t => (
                <div key={t.name} className="rounded-md border border-border-glass">
                  <Container width={t.width} className="border-y-2 border-dashed border-border-gold py-4">
                    <div className="flex items-center justify-between font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold">
                      <span>{t.name}</span>
                      <span className="text-white-muted">{t.value}</span>
                    </div>
                    <p className="mt-1 text-sm text-white-muted">{t.use}</p>
                  </Container>
                </div>
              ))}
            </div>
          </Stack>
        </Row>

        {/* motion */}
        <Row label="04 / Motion">
          <Stack gap="cozy">
            <p className="text-sm text-white-muted">
              All durations + easings live as CSS variables, with <code className="font-mono text-gold">EASE</code> exported from{" "}
              <code className="font-mono">@/lib/animations</code>. Never redefine inline.
            </p>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border-glass text-[0.65rem] uppercase tracking-[0.18em] text-white-muted">
                  <th className="py-3 font-medium">Token</th>
                  <th className="py-3 font-medium">Value</th>
                  <th className="py-3 font-medium">Use</th>
                </tr>
              </thead>
              <tbody>
                {MOTION.map(m => (
                  <tr key={m.token} className="border-b border-border-glass/60">
                    <td className="py-2.5 font-mono text-gold">{m.token}</td>
                    <td className="py-2.5 font-mono text-white-muted">{m.value}</td>
                    <td className="py-2.5">{m.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Stack>
        </Row>

        {/* primitives */}
        <Row label="05 / Primitives">
          <Stack gap="cozy">
            <p className="text-sm text-white-muted">
              Compose every section from these. Source: <code className="font-mono">src/components/v2/studio/primitives.tsx</code>.
            </p>
            <ul className="flex flex-col gap-2">
              {PRIMITIVES.map(p => (
                <li key={p.name} className="flex flex-col gap-1 rounded-md border border-border-glass p-4 lg:flex-row lg:items-center lg:gap-6">
                  <code className="font-mono text-sm text-gold">{p.name}</code>
                  <span className="text-sm text-white-muted">{p.note}</span>
                </li>
              ))}
            </ul>
          </Stack>
        </Row>

        {/* anti-patterns */}
        <Row label="06 / Don't do this">
          <Stack gap="cozy">
            <p className="text-sm text-white-muted">
              If you find yourself writing the left side, stop and use the right side.
            </p>
            <pre className="overflow-x-auto rounded-md border border-border-glass bg-bg-elevated p-5 font-mono text-xs leading-loose text-white-secondary">
{ANTI_PATTERNS.join("\n")}
            </pre>
          </Stack>
        </Row>
      </Section>
    </main>
  );
}
