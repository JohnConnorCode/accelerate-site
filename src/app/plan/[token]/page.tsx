import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PlanView } from "@/components/sections/PlanView";
import type { SolutionRequest } from "@/lib/types";

interface PageProps {
  params: Promise<{ token: string }>;
}

async function fetchPlan(token: string): Promise<SolutionRequest | null> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return null;
  }

  try {
    const { createServerSupabaseClient } = await import(
      "@/lib/supabase/server"
    );
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("solution_requests")
      .select("*")
      .eq("share_token", token)
      .single();

    if (error || !data) {
      return null;
    }

    return data as SolutionRequest;
  } catch {
    return null;
  }
}

async function incrementViewCount(token: string) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return;
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Increment view count (non-critical, best-effort)
    try {
      await supabase.rpc("increment_view_count", { token_param: token });
    } catch {
      // RPC may not exist, try direct update as fallback
      try {
        const { data } = await supabase
          .from("solution_requests")
          .select("view_count")
          .eq("share_token", token)
          .single();
        if (data) {
          await supabase
            .from("solution_requests")
            .update({ view_count: (data.view_count || 0) + 1 })
            .eq("share_token", token);
        }
      } catch {
        // non-critical
      }
    }
  } catch {
    // View count is non-critical, don't fail the page
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { token } = await params;
  const plan = await fetchPlan(token);

  if (!plan || !plan.ai_plan) {
    return {
      title: "Growth Plan",
      description:
        "View your personalized digital growth plan from Accelerate.",
    };
  }

  const summary = plan.ai_plan.executiveSummary.slice(0, 155) + "...";

  return {
    title: plan.business_name
      ? `Growth Plan for ${plan.business_name}`
      : "Your Growth Plan",
    description: summary,
    openGraph: {
      title: plan.business_name
        ? `Growth Plan for ${plan.business_name} | Accelerate`
        : "Your Digital Growth Plan | Accelerate",
      description: summary,
    },
  };
}

export default async function PlanPage({ params }: PageProps) {
  const { token } = await params;

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="glass-prominent rounded-xl p-8 max-w-md w-full text-center space-y-4">
          <h1
            className="text-2xl font-bold text-heading"
            style={{
              fontFamily:
                "var(--font-jost), var(--font-inter), sans-serif",
            }}
          >
            Plan Viewer Not Available
          </h1>
          <p className="text-white-muted text-sm">
            The plan viewing system is not configured yet. Please use the
            solution generator to create a new plan.
          </p>
          <Link
            href="/plan-builder"
            className="inline-flex items-center gap-2 text-sm text-gold-light hover:text-white-primary transition-colors mt-4"
          >
            Go to Solution Generator
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const plan = await fetchPlan(token);

  if (!plan || !plan.ai_plan) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="glass-prominent rounded-xl p-8 max-w-md w-full text-center space-y-4">
          <h1
            className="text-2xl font-bold text-heading"
            style={{
              fontFamily:
                "var(--font-jost), var(--font-inter), sans-serif",
            }}
          >
            Plan Not Found
          </h1>
          <p className="text-white-muted text-sm">
            We could not find a plan with this link. It may have expired or the
            URL may be incorrect.
          </p>
          <Link
            href="/plan-builder"
            className="inline-flex items-center gap-2 text-sm text-gold-light hover:text-white-primary transition-colors mt-4"
          >
            Build a New Plan
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Only increment view count here (not in generateMetadata)
  incrementViewCount(token);

  return <PlanView plan={plan.ai_plan} shareToken={token} />;
}
