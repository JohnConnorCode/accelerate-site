/** One inquiry, followed from arrival to a booked job. `system` marks the
 * steps the system took; the rest were people. Illustrative, fictional data. */
export interface ActivityEvent {
  time: string;
  text: string;
  system?: boolean;
}

export const homeActivity = {
  label: "One inquiry, handled",
  context: "Illustrative · roofing company",
  events: [
    { time: "09:12", text: "Website form: roof inspection request from Lakeview HOA" },
    {
      time: "09:12",
      text: "Matched to an existing customer and last spring's estimate",
      system: true,
    },
    { time: "09:13", text: "Drafted a reply offering two inspection windows", system: true },
    {
      time: "09:13",
      text: "Sent under your reply rules, with the estimate attached",
      system: true,
    },
    { time: "09:41", text: "Dana Ruiz booked Thursday at 10:00" },
    {
      time: "09:42",
      text: "Added the job, assigned the crew, set Friday's follow-up",
      system: true,
    },
  ] satisfies ActivityEvent[],
};

export const commandCenterActivity = {
  label: "A customer thread, across the business",
  context: "Illustrative · configured roofing workflow",
  events: [
    { time: "09:12", text: "Conversations: Dana Ruiz requested an inspection for Cedar Court" },
    {
      time: "09:12",
      text: "Contacts: connected Dana's request to the existing customer",
      system: true,
    },
    {
      time: "09:13",
      text: "Pipeline: created the inspection opportunity and assigned its owner",
      system: true,
    },
    { time: "11:30", text: "The office confirmed the scope and Dana accepted the job" },
    {
      time: "11:31",
      text: "Invoicing: prepared the agreed deposit invoice for billing review",
      system: true,
    },
    {
      time: "11:32",
      text: "Work: assigned the crew handoff and the customer's follow-up",
      system: true,
    },
  ] satisfies ActivityEvent[],
};
