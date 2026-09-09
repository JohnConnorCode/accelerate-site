export const homePlanPages = [
  {
    title: "1. Where the hours go",
    sub: "Named in the team's language, from the first session",
    rows: [
      {
        label: "Missed first contact",
        detail: "Calls and forms while the crew is on a job",
        value: "Evenings",
      },
      {
        label: "Median first response",
        detail: "Business hours only, today",
        value: "Hours",
        mute: true,
      },
      { label: "Routine inquiry handling", detail: "Per week, across two people", value: "22 hrs" },
      {
        label: "Quote turnaround",
        detail: "Request to something the customer can act on",
        value: "Days",
      },
      {
        label: "Follow-up that depends on memory",
        detail: "Estimates that sit until someone has an evening",
        value: "Most",
      },
    ],
    note: "The team is spending the week on qualification and chasing. The work only they can do waits.",
  },
  {
    title: "2. What we take off them first",
    sub: "Sequenced so people get the week back where it counts",
    rows: [
      {
        label: "Phase 1: Front desk",
        detail: "Capture, qualification, and routing, including after hours",
        value: "Week 1",
      },
      {
        label: "Phase 2: Follow-up",
        detail: "The unclosed estimate that currently depends on memory",
        value: "Week 2",
      },
      {
        label: "Phase 3: CRM connection",
        detail: "So the record and the conversation stay in one place",
        value: "Week 3",
      },
      {
        label: "Phase 4: Field notes",
        detail: "End-of-day paperwork that should not need a desk",
        value: "Week 4",
        mute: true,
      },
    ],
    note: "Phase one is live in under two weeks. The crew keeps doing jobs while the machine starts catching what they were missing.",
  },
  {
    title: "3. What the week looks like after",
    sub: "Typical on the workflows we take on, not a headline return",
    rows: [
      {
        label: "First response",
        detail: "While the inquiry is still warm, any hour",
        value: "Minutes",
      },
      {
        label: "Hours returned",
        detail: "Per person, per week, on the work we absorb",
        value: "~10 hrs",
      },
      {
        label: "Routine work absorbed",
        detail: "Intake, follow-up, scheduling no longer needs a person",
        value: "One role",
      },
      {
        label: "Who still decides",
        detail: "Anything that needs judgment comes to you",
        value: "You",
      },
      { label: "You own it", detail: "Accounts, code, documentation", value: "Yours" },
    ],
    note: "The same people spend the week on jobs, cases, and clients. We run the rest.",
  },
];

export const homePlanDeckContent = {
  label: "Sample plan",
  business: "Regional services co.",
  swipeLabel: "Swipe",
  pages: homePlanPages,
};
