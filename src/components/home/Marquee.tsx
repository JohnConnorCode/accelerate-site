import { homeMarqueeContent } from "@/content/site-studio/home";
import type { HomeMarqueeContent } from "@/lib/site-studio/native-templates";

export function Marquee({ content = homeMarqueeContent }: { content?: HomeMarqueeContent }) {
  const loop = [...content.items, ...content.items];
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
