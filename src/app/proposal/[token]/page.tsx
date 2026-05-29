import { Metadata } from "next";
import Link from "next/link";

interface ProposalSection {
  title: string;
  content?: string;
  items?: string[];
  pricing?: { item: string; monthly: number; oneTime: number }[];
}

interface ProposalData {
  title: string;
  client_name: string;
  content: { sections: ProposalSection[] };
  total_one_time: number;
  total_monthly: number;
  status: string;
  created_at: string;
}

async function fetchProposal(token: string): Promise<ProposalData | null> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://acceleratewith.us";
  try {
    const res = await fetch(`${baseUrl}/api/proposal/${token}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.proposal;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const proposal = await fetchProposal(token);
  return {
    title: proposal ? `${proposal.title} | Accelerate` : "Proposal | Accelerate",
    description: proposal
      ? `Proposal for ${proposal.client_name}`
      : "View your custom AI operations proposal",
  };
}

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const proposal = await fetchProposal(token);

  if (!proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold text-white-primary mb-2">
            Proposal Not Found
          </h1>
          <p className="text-white-muted">
            This proposal link may have expired or been removed.
          </p>
        </div>
      </div>
    );
  }

  const sections = proposal.content?.sections || [];

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Header */}
      <header className="border-b border-border-glass">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <p className="text-xs text-gold-light uppercase tracking-wider mb-2">
            Proposal for {proposal.client_name}
          </p>
          <h1 className="text-3xl font-display font-bold text-white-primary mb-2">
            {proposal.title}
          </h1>
          <p className="text-sm text-white-muted">
            Prepared by Accelerate &middot;{" "}
            {new Date(proposal.created_at).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </header>

      {/* Sections */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-10">
          {sections.map((section, idx) => (
            <section key={idx}>
              <h2 className="text-xl font-display font-semibold text-white-primary mb-4 border-b border-border-glass pb-2">
                {section.title}
              </h2>

              {section.content && (
                <div className="text-sm text-white-secondary leading-relaxed whitespace-pre-wrap">
                  {section.content}
                </div>
              )}

              {section.items && section.items.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {section.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-white-secondary">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--gold-light)] mt-1.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}

              {section.pricing && section.pricing.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-glass">
                        <th className="text-left py-2 text-xs text-white-muted uppercase">Service</th>
                        <th className="text-right py-2 text-xs text-white-muted uppercase">Monthly</th>
                        <th className="text-right py-2 text-xs text-white-muted uppercase">One-Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.pricing.map((price, i) => (
                        <tr key={i} className="border-b border-border-glass/50">
                          <td className="py-2 text-white-secondary">{price.item}</td>
                          <td className="py-2 text-right text-emerald-400">
                            {price.monthly > 0 ? `$${price.monthly.toLocaleString()}/mo` : "—"}
                          </td>
                          <td className="py-2 text-right text-white-secondary">
                            {price.oneTime > 0 ? `$${price.oneTime.toLocaleString()}` : "—"}
                          </td>
                        </tr>
                      ))}
                      <tr className="font-semibold">
                        <td className="py-2 text-white-primary">Total</td>
                        <td className="py-2 text-right text-emerald-400">
                          ${proposal.total_monthly.toLocaleString()}/mo
                        </td>
                        <td className="py-2 text-right text-white-primary">
                          ${proposal.total_one_time.toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-border-glass text-center">
          <p className="text-sm text-white-muted">
            Powered by{" "}
            <Link href="/" className="text-gold-light hover:text-gold transition-colors">
              Accelerate
            </Link>
          </p>
        </footer>
      </main>
    </div>
  );
}
