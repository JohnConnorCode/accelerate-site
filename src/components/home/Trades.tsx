import Image from "next/image";
import Link from "next/link";
import { Reveal } from "./reveal";
import { AmbientField } from "./AmbientField";
import { homeTradesContent } from "@/content/site-studio/home";
import type { HomeTradesContent } from "@/lib/site-studio/native-templates";
import { MediaParallax } from "@/components/motion/MediaParallax";

/* The page's photography beat. Every other section argues in type; this one
   shows the rooms and job sites the system actually runs in. Each card is a
   door into that industry's page. */

export function Trades({ content = homeTradesContent }: { content?: HomeTradesContent }) {
  return (
    <section className="sect" id="trades">
      <AmbientField />
      <div className="wrap">
        <div className="shead">
          <Reveal rv as="p" className="label eyebrow-anim">
            {content.eyebrow}
          </Reveal>
          <Reveal rv as="h2" className="h2" delay={0.06}>
            {content.headingStart}
            <br />
            {content.headingMiddle} <span className="it">{content.headingEnd}</span>
          </Reveal>
        </div>

        <div className="trades">
          {content.trades.map((trade, i) => (
            <Reveal
              key={trade.href}
              rv
              delay={0.04 * i}
              className={i === 0 ? "trades-lead h-full" : "h-full"}
            >
              <Link href={trade.href} className="trade">
                <MediaParallax distance={i === 0 ? 6 : 4.5}>
                  <Image
                    src={trade.image}
                    unoptimized={trade.image.startsWith("https://")}
                    alt={trade.alt}
                    fill
                    sizes={
                      i === 0 ? "(max-width: 900px) 100vw, 60vw" : "(max-width: 900px) 100vw, 33vw"
                    }
                    className="trade-img"
                  />
                </MediaParallax>
                <span className="trade-scrim" />
                <span className="trade-caption-index" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="trade-open" aria-hidden="true">
                  ↗
                </span>
                <span className="trade-copy">
                  <span className="trade-name">{trade.name}</span>
                  <span className="trade-promise">{trade.promise}</span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
