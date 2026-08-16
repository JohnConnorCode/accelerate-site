import type { EmailSequenceStep, EmailSequenceType } from "@/lib/types";

export const emailSequences: Record<EmailSequenceType, EmailSequenceStep[]> = {
  manual_audit_followup: [
    {
      stepNumber: 1,
      subject: "We received your roofing revenue audit request",
      delayDays: 0,
      bodyTemplate: `Hi {{name}},

Your Roofing Revenue Leak Audit request is in.

I'm going to review the company and the constraint you selected, then email you personally within one business day with the best next step and a few times to talk.

The session is free. Within two business days after we speak, you'll get the highest-cost leak, the first fix, and the implementation order in writing.

John
Accelerate`,
    },
  ],
  booking_nurture: [
    {
      stepNumber: 1,
      subject: "Your roofing revenue audit is ready to book",
      delayDays: 0,
      bodyTemplate: `Hi {{name}},

Based on what you shared, your company is a fit for a free Roofing Revenue Leak Audit.

Pick a time here: {{planLink}}

In 30 minutes, we'll identify the highest-cost gap between a new inquiry and booked work. Within two business days, you'll get the finding, the fix, and the likely implementation sequence in writing—whether we work together or not.

John
Accelerate`,
    },
    {
      stepNumber: 2,
      subject: "The leak is usually after the first inquiry",
      delayDays: 1,
      bodyTemplate: `Hi {{name}},

Roofing companies rarely lose revenue because nobody in the market needs a roof. It gets lost in slow first response, estimates that go quiet, and follow-up that depends on somebody remembering.

We'll map which one is costing you the most. Book your audit here: {{planLink}}

John`,
    },
    {
      stepNumber: 3,
      subject: "Should I close the loop?",
      delayDays: 3,
      bodyTemplate: `Hi {{name}},

I don't want to crowd your inbox. If tightening inquiry response and estimate follow-up is a priority, you can choose a time here: {{planLink}}

If it is not the right time, no reply is needed.

John`,
    },
  ],
  roofing_nurture: [
    {
      stepNumber: 1,
      subject: "A practical place to start",
      delayDays: 0,
      bodyTemplate: `Hi {{name}},

Thanks for sharing where the business is today. Our managed system is designed for established roofing and exterior companies with enough inquiry volume to justify hands-on operation.

This guide is the best place to start in the meantime:
https://www.acceleratewith.us/learn/automate-lead-follow-up

When the business is consistently above $1M in annual revenue, reply and we'll take another look.

John
Accelerate`,
    },
  ],
  plan_nurture: [
    {
      stepNumber: 1,
      subject: "Your Growth Plan is Ready. Here's What to Do Next",
      delayDays: 0,
      bodyTemplate: `Hi {{name}},

Thanks for using the Accelerate Solution Generator. Your personalized growth plan is ready and waiting for you:

{{planLink}}

Here's a quick summary of what we recommended:
{{planSummary}}

The fastest way to move forward is to book a free 30-minute consultation where we walk through the plan together and answer any questions.

Book your consultation: https://www.acceleratewith.us/contact

No pressure, no pitch. Just a conversation about what would actually move the needle for your business.

Talk soon,
The Accelerate Team`,
    },
    {
      stepNumber: 2,
      subject: "The #1 thing holding most {{industry}} businesses back",
      delayDays: 2,
      bodyTemplate: `Hi {{name}},

After analyzing hundreds of {{industry}} businesses, there's one pattern we see over and over:

The businesses that grow fastest aren't the ones with the biggest ad budget. They're the ones that respond to inquiries first.

80% of deals go to whoever responds first. If your average response time is measured in hours (or days), you're leaving money on the table.

Your growth plan includes a solution for this. If you haven't reviewed it yet, here's the link:

{{planLink}}

And if you want to talk about the fastest way to fix your response time, we're here:
https://www.acceleratewith.us/contact

Talk soon,
The Accelerate Team`,
    },
    {
      stepNumber: 3,
      subject: "The #1 reason small businesses lose inquiries",
      delayDays: 5,
      bodyTemplate: `Hi {{name}},

Most small businesses we talk to are losing customers for the same reason: slow follow-up and a website that doesn't convert.

It usually looks like this. An inquiry comes in while you're busy with a customer. By the time you get back to them, they've already hired whoever answered first. The work was there. The response time wasn't.

That's exactly what we build and run for you: instant response across every channel, automated follow-up, and a website that turns visitors into booked work. So nothing slips while you're heads-down running the business.

Your plan was designed to fix this for your business. The question is just whether now is the right time to start.

If it is, let's talk: https://www.acceleratewith.us/contact

Talk soon,
The Accelerate Team`,
    },
    {
      stepNumber: 4,
      subject: "Last question about your growth plan",
      delayDays: 10,
      bodyTemplate: `Hi {{name}},

I wanted to follow up one last time about your growth plan.

If any of these apply to you, a quick conversation could save you months of trial and error:

- You know you need to improve your digital presence but aren't sure where to start
- You're losing customers to competitors who respond faster
- You're spending too much time on tasks that could be automated
- You want to grow but don't have the bandwidth

We've helped dozens of businesses in your position and the conversation is always free.

Book a strategy session: https://www.acceleratewith.us/contact

Or if you just want to revisit your plan: {{planLink}}

Either way, I appreciate you taking the time to explore what Accelerate can do.

Talk soon,
The Accelerate Team`,
    },
  ],
  resource_welcome: [
    {
      stepNumber: 1,
      subject: "Your download is ready, plus a bonus inside",
      delayDays: 0,
      bodyTemplate: `Hi {{name}},

Thanks for downloading {{resourceTitle}}. Here's your link:

{{downloadLink}}

While you're diving into that, here's a bonus: book a free strategy call and we'll map out exactly where AI can save you time and grow revenue in your business. Specific to your industry, your current setup, and your goals.

Book it here: https://www.acceleratewith.us/contact

Enjoy the resource. If you have any questions, just reply to this email.

Talk soon,
The Accelerate Team`,
    },
    {
      stepNumber: 2,
      subject: "Did you get a chance to review {{resourceTitle}}?",
      delayDays: 3,
      bodyTemplate: `Hi {{name}},

Just checking in. Did you get a chance to go through {{resourceTitle}}?

If you found it useful and want to see how this applies to your specific business, the best next step is a free 30-minute strategy call. We'll map out exactly where AI and automation could help you book more clients and reclaim time, whether you work with us or not.

Grab a time here: https://www.acceleratewith.us/contact

Talk soon,
The Accelerate Team`,
    },
    {
      stepNumber: 3,
      subject: "Quick question about your business",
      delayDays: 7,
      bodyTemplate: `Hi {{name}},

I'm curious: what's the biggest bottleneck in your business right now?

A) Not enough inquiries coming in
B) Inquiries coming in but not converting
C) Too much manual work eating up your time
D) All of the above

Just reply with a letter and I'll send you the most relevant resource or recommendation.

Or if you'd rather talk it through, book a free 30-minute consultation:
https://www.acceleratewith.us/contact

We help small businesses fix exactly these problems every day.

Talk soon,
The Accelerate Team`,
    },
  ],
  grader_followup: [
    {
      stepNumber: 1,
      subject: "Your website scored {{score}}/100: here's what that means",
      delayDays: 0,
      bodyTemplate: `Hi {{name}},

Thanks for running your website through our grader. Here's a summary of your results:

Overall Score: {{score}}/100

Top issues we found:
{{topIssues}}

The good news: most of these issues are fixable, and fixing them can have an immediate impact on your client acquisition.

Want a plan for fixing them? Book a free strategy call and we'll walk you through it, specific to your business:

https://www.acceleratewith.us/contact

Talk soon,
The Accelerate Team`,
    },
    {
      stepNumber: 2,
      subject: "3 quick wins to improve your website score",
      delayDays: 3,
      bodyTemplate: `Hi {{name}},

Based on your website grade of {{score}}/100, here are three things you can fix this week that will make the biggest difference:

1. **Page speed.** Compress your images and enable browser caching. Every second of load time costs you 7% in conversions.

2. **Mobile optimization.** Over 60% of your traffic is on mobile. If your site isn't fast and easy to use on a phone, you're losing more than half your potential customers.

3. **Clear CTAs.** Every page should have one clear next step for the visitor. "Call now," "Book a consultation," "Get a free quote." Make it obvious and make it easy.

Want us to handle all of this for you? Our Launch package starts at $2,500 and includes a complete website built around conversion:

https://www.acceleratewith.us/services

Talk soon,
The Accelerate Team`,
    },
  ],
};
