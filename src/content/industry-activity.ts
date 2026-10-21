import type { ActivityEvent } from "./home-activity";

/** Fictional examples of one request moving through each trade's work. */
export const industryActivity: Record<
  string,
  { label: string; context: string; events: ActivityEvent[] }
> = {
  "home-services": {
    label: "A roof inspection, booked",
    context: "Illustrative · home services",
    events: [
      { time: "09:12", text: "Dana Ruiz requested a roof inspection for Cedar Court" },
      { time: "09:12", text: "Attached the property details and previous estimate", system: true },
      { time: "09:14", text: "Prepared two inspection windows for the estimator", system: true },
      { time: "09:30", text: "Estimator confirmed Thursday's inspection route" },
      {
        time: "09:31",
        text: "Sent Dana the appointment under the office's booking rules",
        system: true,
      },
      {
        time: "09:32",
        text: "Added site access and inspection preparation to the crew's work",
        system: true,
      },
    ],
  },
  "law-firms": {
    label: "A consultation, prepared",
    context: "Illustrative · law firms",
    events: [
      { time: "10:05", text: "Maya Chen asked about a commercial lease consultation" },
      { time: "10:05", text: "Recorded the inquiry and assigned intake review", system: true },
      {
        time: "10:20",
        text: "Intake team completed its conflict check and confirmed the consultation",
      },
      {
        time: "10:21",
        text: "Sent the appointment details under the firm's intake rules",
        system: true,
      },
      {
        time: "10:22",
        text: "Created a document request for the lease and related correspondence",
        system: true,
      },
      { time: "11:10", text: "Maya supplied the lease for the lawyer's review" },
    ],
  },
  "professional-services": {
    label: "An engagement, ready to start",
    context: "Illustrative · professional services",
    events: [
      { time: "09:00", text: "Riley Morgan asked for a quarterly accounting review" },
      {
        time: "09:01",
        text: "Connected the inquiry to Harbor Studio's customer record",
        system: true,
      },
      { time: "11:00", text: "Riley and the adviser agreed on scope and kickoff" },
      {
        time: "11:01",
        text: "Created the engagement checklist and assigned its owner",
        system: true,
      },
      {
        time: "11:02",
        text: "Requested the agreed reports under the onboarding rules",
        system: true,
      },
      { time: "14:15", text: "Adviser confirmed the kickoff has the records it needs" },
    ],
  },
  "real-estate": {
    label: "A viewing, arranged",
    context: "Illustrative · real estate",
    events: [
      { time: "08:40", text: "Alex Rivera asked to view the apartment on Willow Street" },
      {
        time: "08:40",
        text: "Saved the property and Alex's buying preferences together",
        system: true,
      },
      {
        time: "08:42",
        text: "Prepared viewing options from the agent's availability",
        system: true,
      },
      { time: "09:15", text: "Agent confirmed access with the seller" },
      {
        time: "09:16",
        text: "Sent the confirmed viewing details under the agency's rules",
        system: true,
      },
      { time: "09:30", text: "Alex confirmed Saturday's viewing" },
    ],
  },
  manufacturing: {
    label: "A quote request, assigned",
    context: "Illustrative · manufacturing",
    events: [
      { time: "08:10", text: "Sam Patel requested a quote for Westhaven's mounting brackets" },
      {
        time: "08:10",
        text: "Attached the drawings and requested quantity to the inquiry",
        system: true,
      },
      { time: "08:11", text: "Flagged the missing material specification", system: true },
      { time: "09:00", text: "Sam supplied the required alloy and finish" },
      {
        time: "09:01",
        text: "Assigned the complete quote package to the estimating team",
        system: true,
      },
      { time: "09:20", text: "Estimator accepted the request and confirmed the quote review date" },
    ],
  },
  startups: {
    label: "A customer pilot, organized",
    context: "Illustrative · startups",
    events: [
      { time: "10:00", text: "Jordan Lee asked to pilot Beacon Labs' reporting tool" },
      {
        time: "10:00",
        text: "Recorded the use case and connected the company record",
        system: true,
      },
      { time: "10:45", text: "Jordan and the team agreed on pilot scope and success measures" },
      {
        time: "10:46",
        text: "Created onboarding work with an owner for each access request",
        system: true,
      },
      { time: "10:47", text: "Scheduled the agreed pilot review and follow-up task", system: true },
      { time: "15:00", text: "Pilot owner confirmed access and the first review date" },
    ],
  },
  "medical-dental": {
    label: "A patient visit, scheduled",
    context: "Illustrative · medical and dental practices",
    events: [
      { time: "09:05", text: "Casey Brooks requested a new-patient dental appointment" },
      {
        time: "09:05",
        text: "Routed the appointment request to the practice's intake team",
        system: true,
      },
      { time: "09:20", text: "Reception confirmed the visit type and available appointment" },
      {
        time: "09:21",
        text: "Sent the booking details using the practice's communication rules",
        system: true,
      },
      {
        time: "09:22",
        text: "Added an administrative reminder without clinical information",
        system: true,
      },
      { time: "09:35", text: "Casey confirmed the appointment with reception" },
    ],
  },
  "insurance-agencies": {
    label: "A renewal, ready for review",
    context: "Illustrative · insurance agencies",
    events: [
      { time: "09:10", text: "Taylor Reed requested a review of Maple Workshop's renewal" },
      {
        time: "09:10",
        text: "Connected the request to the renewal date and account owner",
        system: true,
      },
      {
        time: "09:12",
        text: "Prepared a checklist of business changes for the agent",
        system: true,
      },
      { time: "10:00", text: "Taylor confirmed the updated headcount and premises" },
      {
        time: "10:01",
        text: "Assigned the complete renewal review to the licensed agent",
        system: true,
      },
      { time: "10:30", text: "Agent confirmed the review appointment and next steps" },
    ],
  },
  "auto-dealers": {
    label: "A test drive, confirmed",
    context: "Illustrative · auto dealers and service centers",
    events: [
      { time: "11:05", text: "Morgan Diaz asked to test-drive the listed hatchback" },
      {
        time: "11:05",
        text: "Connected the vehicle inquiry and preferred appointment time",
        system: true,
      },
      { time: "11:15", text: "Sales adviser confirmed the vehicle is available" },
      {
        time: "11:16",
        text: "Sent the confirmed appointment under the dealership's rules",
        system: true,
      },
      { time: "11:17", text: "Assigned vehicle preparation to the showroom team", system: true },
      { time: "11:30", text: "Morgan confirmed the test drive and arrival time" },
    ],
  },
  nonprofits: {
    label: "A volunteer shift, filled",
    context: "Illustrative · nonprofits",
    events: [
      { time: "09:00", text: "Avery Thomas offered to help at Oak Table's community meal" },
      {
        time: "09:00",
        text: "Recorded Avery's availability and preferred volunteer work",
        system: true,
      },
      { time: "09:20", text: "Coordinator confirmed a place on Saturday's kitchen team" },
      {
        time: "09:21",
        text: "Sent the shift details under the volunteer program's rules",
        system: true,
      },
      {
        time: "09:22",
        text: "Added the arrival checklist and coordinator follow-up",
        system: true,
      },
      { time: "10:00", text: "Avery accepted the shift and confirmed the arrival instructions" },
    ],
  },
  "restaurants-catering": {
    label: "A catering booking, organized",
    context: "Illustrative · restaurants and catering",
    events: [
      { time: "10:15", text: "Jamie Park requested lunch catering for the Elm Street team" },
      {
        time: "10:15",
        text: "Recorded the guest count, delivery address and dietary requests",
        system: true,
      },
      { time: "11:00", text: "Chef confirmed the menu, price and kitchen capacity" },
      { time: "11:01", text: "Prepared the agreed booking and payment request", system: true },
      { time: "11:30", text: "Jamie confirmed the menu and paid the deposit" },
      {
        time: "11:31",
        text: "Added kitchen preparation and delivery tasks to the booking",
        system: true,
      },
    ],
  },
  "retail-ecommerce": {
    label: "An exchange, resolved",
    context: "Illustrative · retail and ecommerce",
    events: [
      { time: "09:25", text: "Robin Hayes asked to exchange a jacket from Fern Outfitters" },
      { time: "09:25", text: "Matched the message to the order and exchange policy", system: true },
      { time: "09:27", text: "Prepared an exchange request with the requested size", system: true },
      { time: "10:00", text: "Shop team confirmed stock and approved the exchange" },
      {
        time: "10:01",
        text: "Sent the agreed return instructions and recorded the next step",
        system: true,
      },
      { time: "10:20", text: "Robin confirmed the return arrangements" },
    ],
  },
  "salons-spas": {
    label: "A salon visit, booked",
    context: "Illustrative · salons and spas",
    events: [
      { time: "08:50", text: "Drew Miller requested a cut and color at Juniper Salon" },
      { time: "08:50", text: "Connected the request to Drew's booking preferences", system: true },
      { time: "09:10", text: "Stylist confirmed the service length and appointment window" },
      { time: "09:11", text: "Sent the appointment under the salon's booking rules", system: true },
      { time: "09:25", text: "Drew accepted the appointment and paid the booking deposit" },
      {
        time: "09:26",
        text: "Recorded the deposit and scheduled the appointment reminder",
        system: true,
      },
    ],
  },
  "fitness-studios": {
    label: "A trial class, arranged",
    context: "Illustrative · fitness studios",
    events: [
      { time: "10:05", text: "Quinn Ellis asked about a first class at Harbor Movement" },
      {
        time: "10:05",
        text: "Recorded the preferred class and introductory booking request",
        system: true,
      },
      { time: "10:20", text: "Studio team confirmed a place in the beginner session" },
      {
        time: "10:21",
        text: "Sent the booking and arrival instructions under studio rules",
        system: true,
      },
      { time: "10:40", text: "Quinn confirmed the trial class" },
      {
        time: "10:41",
        text: "Scheduled a post-class check-in for the membership team",
        system: true,
      },
    ],
  },
  "pet-services": {
    label: "A grooming visit, prepared",
    context: "Illustrative · pet services",
    events: [
      { time: "09:15", text: "Finley Grant requested a grooming appointment for Pepper" },
      {
        time: "09:15",
        text: "Connected Pepper's service history to the appointment request",
        system: true,
      },
      { time: "09:30", text: "Groomer confirmed the service and available slot" },
      {
        time: "09:31",
        text: "Sent the appointment and preparation checklist under booking rules",
        system: true,
      },
      { time: "09:50", text: "Finley confirmed Pepper's drop-off time" },
      {
        time: "09:51",
        text: "Added the appointment and collection follow-up to the day's work",
        system: true,
      },
    ],
  },
  "auto-repair": {
    label: "A repair visit, assigned",
    context: "Illustrative · auto repair",
    events: [
      { time: "08:20", text: "Logan Kim reported a brake noise and requested an inspection" },
      {
        time: "08:20",
        text: "Attached the vehicle and previous service record to the request",
        system: true,
      },
      { time: "08:35", text: "Service adviser confirmed the diagnostic appointment" },
      {
        time: "08:36",
        text: "Sent the agreed drop-off instructions under workshop rules",
        system: true,
      },
      { time: "08:50", text: "Logan confirmed the drop-off and contact number" },
      {
        time: "08:51",
        text: "Assigned the inspection job and estimate follow-up to the adviser",
        system: true,
      },
    ],
  },
  "property-management": {
    label: "A maintenance request, scheduled",
    context: "Illustrative · property management",
    events: [
      { time: "09:10", text: "Tenant Arden Cole reported a dripping kitchen tap at Birch House" },
      {
        time: "09:10",
        text: "Connected the request to the tenancy and maintenance history",
        system: true,
      },
      { time: "09:25", text: "Property manager confirmed the repair scope and contractor" },
      {
        time: "09:26",
        text: "Requested an access window under the maintenance policy",
        system: true,
      },
      { time: "10:00", text: "Arden confirmed access for Tuesday morning" },
      {
        time: "10:01",
        text: "Scheduled the contractor and assigned a completion check",
        system: true,
      },
    ],
  },
  "cleaning-companies": {
    label: "An office clean, ready for the crew",
    context: "Illustrative · cleaning companies",
    events: [
      { time: "10:10", text: "Skyler James requested a recurring clean for Pine Office" },
      {
        time: "10:10",
        text: "Recorded the rooms, frequency and preferred access hours",
        system: true,
      },
      { time: "11:00", text: "Supervisor confirmed the site plan and agreed price" },
      { time: "11:01", text: "Prepared the recurring booking and crew checklist", system: true },
      { time: "11:30", text: "Skyler accepted the schedule and confirmed building access" },
      {
        time: "11:31",
        text: "Assigned the first clean and post-visit check to the crew lead",
        system: true,
      },
    ],
  },
  "staffing-recruiting": {
    label: "A hiring brief, ready for search",
    context: "Illustrative · staffing and recruiting",
    events: [
      { time: "09:30", text: "Reese Bennett requested an operations hire for Wren Supply" },
      {
        time: "09:30",
        text: "Connected the role request to the client and hiring history",
        system: true,
      },
      {
        time: "10:00",
        text: "Recruiter confirmed the role, compensation range and interview process",
      },
      {
        time: "10:01",
        text: "Prepared the agreed search brief and assigned its owner",
        system: true,
      },
      { time: "10:30", text: "Reese approved the brief and interview availability" },
      {
        time: "10:31",
        text: "Created sourcing tasks and the first client progress check",
        system: true,
      },
    ],
  },
  "events-venues": {
    label: "A venue booking, handed to the team",
    context: "Illustrative · events and venues",
    events: [
      { time: "10:00", text: "Rowan Clarke requested a workshop booking at Linden Hall" },
      { time: "10:00", text: "Recorded the date, guest count and room requirements", system: true },
      { time: "10:30", text: "Venue manager confirmed availability and the agreed package" },
      {
        time: "10:31",
        text: "Prepared the booking confirmation and deposit request",
        system: true,
      },
      { time: "11:15", text: "Rowan confirmed the booking and paid the deposit" },
      {
        time: "11:16",
        text: "Assigned room setup, access and event-day contact to the venue team",
        system: true,
      },
    ],
  },
};
