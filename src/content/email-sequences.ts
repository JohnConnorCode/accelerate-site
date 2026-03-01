import type { EmailSequenceStep, EmailSequenceType } from "@/lib/types";

export const emailSequences: Record<EmailSequenceType, EmailSequenceStep[]> = {
  plan_nurture: [
    {
      stepNumber: 1,
      subject: "Your Growth Plan is Ready — Here's What to Do Next",
      delayDays: 0,
      bodyTemplate: `Hi {{name}},

Thanks for using the Accelerate Solution Generator. Your personalized growth plan is ready and waiting for you:

{{planLink}}

Here's a quick summary of what we recommended:
{{planSummary}}

The fastest way to move forward is to book a free 30-minute consultation where we walk through the plan together and answer any questions.

Book your consultation: https://acceleratewith.us/contact

No pressure, no pitch. Just a conversation about what would actually move the needle for your business.

— The Accelerate Team`,
    },
    {
      stepNumber: 2,
      subject: "The #1 thing holding most {{industry}} businesses back",
      delayDays: 2,
      bodyTemplate: `Hi {{name}},

After analyzing hundreds of {{industry}} businesses, there's one pattern we see over and over:

The businesses that grow fastest aren't the ones with the biggest ad budget. They're the ones that respond to leads first.

80% of deals go to whoever responds first. If your average response time is measured in hours (or days), you're leaving money on the table.

Your growth plan includes a solution for this. If you haven't reviewed it yet, here's the link:

{{planLink}}

And if you want to talk about the fastest way to fix your response time, we're here:
https://acceleratewith.us/contact

— The Accelerate Team`,
    },
    {
      stepNumber: 3,
      subject: "How Farrell Roofing went from 12 to 53 leads/month",
      delayDays: 5,
      bodyTemplate: `Hi {{name}},

Quick case study that might resonate with you:

Farrell Roofing in Denver was running a solid business but losing leads to slow follow-up and an outdated website. Sound familiar?

After implementing an AI-powered website and automated follow-up system, they saw:
- 340% increase in online leads
- Response time dropped from 4 hours to under 2 minutes
- $47,000 in additional monthly revenue within 90 days

Read the full case study: https://acceleratewith.us/results/farrell-roofing

Your plan was designed to deliver similar results for your business. The question is just whether now is the right time to start.

If it is, let's talk: https://acceleratewith.us/contact

— The Accelerate Team`,
    },
    {
      stepNumber: 4,
      subject: "Last question about your growth plan",
      delayDays: 10,
      bodyTemplate: `Hi {{name}},

I wanted to follow up one last time about your growth plan.

If any of these apply to you, a quick conversation could save you months of trial and error:

- You know you need to improve your digital presence but aren't sure where to start
- You're losing leads to competitors who respond faster
- You're spending too much time on tasks that could be automated
- You want to grow but don't have the bandwidth

We've helped dozens of businesses in your position and the conversation is always free.

Book a call: https://acceleratewith.us/contact

Or if you just want to revisit your plan: {{planLink}}

Either way, I appreciate you taking the time to explore what Accelerate can do.

— The Accelerate Team`,
    },
  ],
  resource_welcome: [
    {
      stepNumber: 1,
      subject: "Your download is ready — plus a bonus inside",
      delayDays: 0,
      bodyTemplate: `Hi {{name}},

Thanks for downloading {{resourceTitle}}. Here's your link:

{{downloadLink}}

While you're diving into that, here's a bonus: our free AI Solution Generator creates a custom growth plan for your business in under 5 minutes. It's specific to your industry, your current setup, and your goals.

Try it here: https://acceleratewith.us/#solution-generator

Enjoy the resource. If you have any questions, just reply to this email.

— The Accelerate Team`,
    },
    {
      stepNumber: 2,
      subject: "Did you get a chance to review {{resourceTitle}}?",
      delayDays: 3,
      bodyTemplate: `Hi {{name}},

Just checking in — did you get a chance to go through {{resourceTitle}}?

If you found it useful, here are two more resources you might like:

1. Free Website Grader — Get an instant score on your website's performance, SEO, and mobile-friendliness: https://acceleratewith.us/tools/website-grader

2. ROI Calculator — See how much additional revenue AI automation could generate for your business: https://acceleratewith.us/tools/roi-calculator

Both are free and take less than a minute.

— The Accelerate Team`,
    },
    {
      stepNumber: 3,
      subject: "Quick question about your business",
      delayDays: 7,
      bodyTemplate: `Hi {{name}},

I'm curious — what's the biggest bottleneck in your business right now?

A) Not enough leads coming in
B) Leads coming in but not converting
C) Too much manual work eating up your time
D) All of the above

Just reply with a letter and I'll send you the most relevant resource or recommendation.

Or if you'd rather talk it through, book a free 30-minute consultation:
https://acceleratewith.us/contact

We help small businesses fix exactly these problems every day.

— The Accelerate Team`,
    },
  ],
  grader_followup: [
    {
      stepNumber: 1,
      subject: "Your website scored {{score}}/100 — here's what that means",
      delayDays: 0,
      bodyTemplate: `Hi {{name}},

Thanks for running your website through our grader. Here's a summary of your results:

Overall Score: {{score}}/100

Top issues we found:
{{topIssues}}

The good news: most of these issues are fixable, and fixing them can have an immediate impact on your lead generation.

Want to see what a top-performing website in your industry looks like? Our AI Solution Generator will create a custom plan based on your specific situation:

https://acceleratewith.us/#solution-generator

Or if you'd rather have an expert walk you through it:
https://acceleratewith.us/contact

— The Accelerate Team`,
    },
    {
      stepNumber: 2,
      subject: "3 quick wins to improve your website score",
      delayDays: 3,
      bodyTemplate: `Hi {{name}},

Based on your website grade of {{score}}/100, here are three things you can fix this week that will make the biggest difference:

1. **Page speed** — Compress your images and enable browser caching. Every second of load time costs you 7% in conversions.

2. **Mobile optimization** — Over 60% of your traffic is on mobile. If your site isn't fast and easy to use on a phone, you're losing more than half your potential leads.

3. **Clear CTAs** — Every page should have one clear next step for the visitor. "Call now," "Book a consultation," "Get a free quote." Make it obvious and make it easy.

Want us to handle all of this for you? Our Launch package starts at $2,500 and includes a complete website built around conversion:

https://acceleratewith.us/packages

— The Accelerate Team`,
    },
  ],
};
