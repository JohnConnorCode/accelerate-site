import Image from "next/image";
import Link from "next/link";
import { Reveal } from "./reveal";
import { AmbientField } from "./AmbientField";
import { INDUSTRY_VISUALS } from "@/content/industry-visuals";
import { MediaParallax } from "@/components/motion/MediaParallax";

/* The page's photography beat. Every other section argues in type; this one
   shows the rooms and job sites the system actually runs in. Each card is a
   door into that industry's page. */

const TRADES = [
  {
    href: "/industries/home-services",
    name: "Home services",
    visual: INDUSTRY_VISUALS["home-services"],
  },
  { href: "/industries/law-firms", name: "Law firms", visual: INDUSTRY_VISUALS["law-firms"] },
  {
    href: "/industries/professional-services",
    name: "Professional services",
    visual: INDUSTRY_VISUALS["professional-services"],
  },
  { href: "/industries/real-estate", name: "Real estate", visual: INDUSTRY_VISUALS["real-estate"] },
  { href: "/industries/nonprofits", name: "Nonprofits", visual: INDUSTRY_VISUALS.nonprofits },
] as const;

export function Trades() {
  return (
    <section className="sect" id="trades">
      <AmbientField />
      <div className="wrap">
        <div className="shead">
          <Reveal rv as="p" className="label eyebrow-anim">
            Where it lands
          </Reveal>
          <Reveal rv as="h2" className="h2" delay={0.06}>
            Built around the work
            <br />
            your team <span className="it">actually does.</span>
          </Reveal>
        </div>

        <div className="trades">
          {TRADES.map((trade, i) => (
            <Reveal
              key={trade.href}
              rv
              delay={0.04 * i}
              className={i === 0 ? "trades-lead h-full" : "h-full"}
            >
              <Link href={trade.href} className="trade">
                <MediaParallax distance={i === 0 ? 6 : 4.5}>
                  <Image
                    src={trade.visual.hero.src}
                    alt={trade.visual.hero.alt}
                    fill
                    sizes={
                      i === 0 ? "(max-width: 900px) 100vw, 60vw" : "(max-width: 900px) 100vw, 33vw"
                    }
                    className="trade-img"
                  />
                </MediaParallax>
                <span className="trade-scrim" />
                <span className="trade-copy">
                  <span className="trade-name">{trade.name}</span>
                  <span className="trade-promise">{trade.visual.promise}</span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
