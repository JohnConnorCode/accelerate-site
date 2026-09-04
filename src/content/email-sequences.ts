import type { EmailSequenceStep, EmailSequenceType } from "@/lib/types";

/**
 * Automated follow-up sequences. Voice contract (docs/contracts/MARKETING-POSITIONING-CONTRACT.md):
 * plain complete sentences, concrete work and outcomes, no invented clients,
 * numbers, or guarantees, no consultant filler, signed by the founder.
 * Token names per step are load-bearing: scheduleEmailSequence only supplies
 * the metadata each caller passes plus built-in defaults, so keep every
 * {{token}} a caller already provides.
 */
export const emailSequences: Record<EmailSequenceType, EmailSequenceStep[]> = {
  manual_audit_followup: [
    {
      stepNumber: 1,
      subject: "We received your roofing audit request",
      delayDays: 0,
      bodyTemplate: `Hi {{name}},

Your roofing audit request is in.

I will review the company and the constraint you shared, then reply personally within one business day with the clearest next step and a few times to talk.

The session is free. Within two business days after we speak, you will have the highest-cost leak, the first fix, and the implementation order in writing.

John
Accelerate`,
    },
  ],
  booking_nurture: [
    {
      stepNumber: 1,
      subject: "Your roofing audit is ready to book",
      delayDays: 0,
      bodyTemplate: `Hi {{name}},

Based on what you shared, your company is a fit for a roofing audit.

Pick a time here: {{planLink}}

In 30 minutes, we will identify the highest-cost gap between a new inquiry and booked work. Within two business days, you will have the finding, the fix, and the likely implementation sequence in writing, whether we work together or not.

John
Accelerate`,
    },
    {
      stepNumber: 2,
      subject: "The leak is usually after the first inquiry",
      delayDays: 1,
      bodyTemplate: `Hi {{name}},

Roofing work is rarely lost because nobody needs a roof. It is lost in slow first response, estimates that go quiet, and follow-up that depends on somebody remembering.

We will map which one is costing you the most. Book your audit here: {{planLink}}

John
Accelerate`,
    },
    {
      stepNumber: 3,
      subject: "Should I close the loop?",
      delayDays: 3,
      bodyTemplate: `Hi {{name}},

I do not want to crowd your inbox. If tighter inquiry response and estimate follow-up is a priority, you can choose a time here: {{planLink}}

If it is not the right time, no reply is needed.

John
Accelerate`,
    },
  ],
  roofing_nurture: [
    {
      stepNumber: 1,
      subject: "A practical place to start",
      delayDays: 0,
      bodyTemplate: `Hi {{name}},

Thanks for sharing where the business is today. Hands-on operation fits established roofing and exterior companies with enough inquiry volume to justify it.

This guide is the best place to start in the meantime:
https://www.acceleratewith.us/learn/automate-lead-follow-up

When the business is consistently above $1M in annual revenue, reply and we will take another look.

John
Accelerate`,
    },
  ],
  plan_nurture: [
    {
      stepNumber: 1,
      subject: "Your plan is ready",
      delayDays: 0,
      bodyTemplate: `Hi {{name}},

Your plan is ready:

{{planLink}}

Here is a summary of what we recommended:
{{planSummary}}

Every engagement starts with your business. We find where AI and automation can free up time or increase revenue, then advise, build, integrate, and run the right solution for your team.

If you want to talk through the first move, reply here or use the contact page and we will set up a conversation.

John
Accelerate`,
    },
    {
      stepNumber: 2,
      subject: "Response time decides most {{industry}} inquiries",
      delayDays: 2,
      bodyTemplate: `Hi {{name}},

The businesses that win the conversation are usually the ones that respond first. If the average response is measured in hours or days, the inquiry has already moved on.

Your plan includes a fix for this. If you have not reviewed it yet, here is the link:

{{planLink}}

If you want to talk about the fastest way to fix response time, reply here and we will set up a conversation.

John
Accelerate`,
    },
    {
      stepNumber: 3,
      subject: "Slow follow-up loses inquiries",
      delayDays: 5,
      bodyTemplate: `Hi {{name}},

The pattern is common. An inquiry arrives while you are with a customer, and everything about it waits for you: the reply, the price, the schedule. The work was there. The hours were not.

That is what we build and run for you: response across every channel, steady follow-up, and a site that turns visitors into booked work, so nothing waits while you run the business.

Your plan was written to fix this for your business. The question is whether now is the right time to start.

If it is, reply here: https://www.acceleratewith.us/contact

John
Accelerate`,
    },
    {
      stepNumber: 4,
      subject: "Closing the loop on your plan",
      delayDays: 10,
      bodyTemplate: `Hi {{name}},

I wanted to follow up one last time about your plan.

If any of these sound familiar, a short conversation could save months of trial and error:

- You know the business needs to handle inquiries better but you are not sure where to start
- You lose work to competitors who respond faster
- Manual tasks take hours that should go to customers
- You want to grow but there is no spare capacity

Reply here to talk it through: https://www.acceleratewith.us/contact

Or revisit your plan any time: {{planLink}}

Either way, thanks for exploring what Accelerate can do for your business.

John
Accelerate`,
    },
  ],
  resource_welcome: [
    {
      stepNumber: 1,
      subject: "Your download is ready",
      delayDays: 0,
      bodyTemplate: `Hi {{name}},

Thanks for downloading {{resourceTitle}}. Here is your link:

{{downloadLink}}

While you read it, one offer: reply here and we will map where AI can save time and grow revenue in your business, specific to your industry, your setup, and your goals.

You can also book a conversation any time: https://www.acceleratewith.us/contact

If you have questions about the resource, just reply to this email.

John
Accelerate`,
    },
    {
      stepNumber: 2,
      subject: "Did you get through {{resourceTitle}}?",
      delayDays: 3,
      bodyTemplate: `Hi {{name}},

Checking in. Did you get through {{resourceTitle}}?

If it was useful and you want to see how it applies to your business, reply here. We will map where AI and automation could help, whether you work with us or not.

You can also choose a time directly: https://www.acceleratewith.us/contact

John
Accelerate`,
    },
    {
      stepNumber: 3,
      subject: "What is slowing your business down right now?",
      delayDays: 7,
      bodyTemplate: `Hi {{name}},

I am curious: what is the biggest bottleneck in your business right now?

A) Not enough inquiries coming in
B) Inquiries coming in but not converting
C) Too much manual work taking up time
D) All of the above

Just reply with a letter and I will send the most relevant next step.

Or talk it through instead: https://www.acceleratewith.us/contact

We start with your business and recommend the smallest solution that solves the problem.

John
Accelerate`,
    },
  ],
  grader_followup: [
    {
      stepNumber: 1,
      subject: "Your website result: {{score}} out of 100",
      delayDays: 0,
      bodyTemplate: `Hi {{name}},

Thanks for running your website through our grader. Here is a summary:

Overall score: {{score}} out of 100

The clearest opportunities:
{{topIssues}}

Most of these are fixable, and fixing them can help turn more visits into inquiries.

Want a plan for fixing them? Reply here and we will walk through it for your business:

https://www.acceleratewith.us/contact

John
Accelerate`,
    },
    {
      stepNumber: 2,
      subject: "Three fixes worth checking this week",
      delayDays: 3,
      bodyTemplate: `Hi {{name}},

Based on your grade of {{score}} out of 100, here are three fixes worth checking this week:

1. Page speed. Compress images and enable browser caching. Slow pages lose visitors before they read anything.

2. Mobile. Your site should be fast and easy to use on a phone, since that is where a large share of visits happen.

3. Clear next steps. Every page should offer one clear action, such as calling, booking a conversation, or requesting a quote.

Want us to handle this for you? Reply here and tell us about your site:

https://www.acceleratewith.us/services

John
Accelerate`,
    },
  ],
};
