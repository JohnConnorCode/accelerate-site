"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Reveal } from "./reveal";
import { AmbientField } from "./AmbientField";
import { marketingPositioning } from "@/content/marketing-positioning";

/* The home page's only piece of real product interface.

   Everything else on this page argues in the abstract: the problem, the
   payoff, the process, the firm. This section is the artifact. It sits on
   paper deliberately — the demo frame is dark in both themes, so an ink panel
   would put black on black — and it breaks up what used to be two consecutive
   ink sections running into each other.

   The demo is code-split because it is the heaviest component on the site and
   it lives below the fold. It still server-renders, so there is no hole in the
   page while the chunk arrives. */
const CommandCenterDemo = dynamic(
  () => import("@/components/command-center/demo/CommandCenterDemo").then((m) => m.CommandCenterDemo),
  {
    loading: () => (
      <div className="min-h-[560px] border border-[var(--rule)] bg-[#0B0B0B]" aria-hidden="true" />
    ),
  }
);

export function CommandCenter() {
  return (
    <section className="sect" id="command-center">
      <AmbientField />
      <div className="wrap">
        <div className="shead">
          <Reveal rv as="p" className="label eyebrow-anim">
            {marketingPositioning.commandCenter.label}
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              When the work needs
              <br />
              <span className="it">one place to run.</span>
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              {marketingPositioning.commandCenter.description}
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.18} style={{ marginTop: 16 }}>
              The live sandbox shows that integrated option. Clear the approval queue, open a workflow, or search the records.
            </Reveal>
          </div>
        </div>

        <Reveal rv as="div" delay={0.1} style={{ marginTop: "clamp(32px,4vw,54px)" }}>
          <CommandCenterDemo />
        </Reveal>

        <Reveal rv as="p" delay={0.16} style={{ marginTop: "clamp(22px,2.6vw,32px)" }}>
          <Link href="/command-center" className="ink-sweep text-[15.5px] text-[var(--fg)]">
            Explore the Command Center{" "}
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
