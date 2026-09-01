export type IndustryStill = { src: string; alt: string };

export type IndustryVisual = {
  hero: IndustryStill;
  stills: IndustryStill[];
  promise: string;
};

/** The five industries we actually sell, in nav order. */
export const FEATURED_INDUSTRY_SLUGS = [
  "home-services",
  "law-firms",
  "professional-services",
  "real-estate",
  "nonprofits",
] as const;

/** Documentary stills for the five industries we actually sell. */
export const INDUSTRY_VISUALS = {
  "home-services": {
    promise: "The office runs while the crew builds.",
    hero: {
      src: "/images/home-services/hero.jpg",
      alt: "A construction crew working on a roof against an open sky",
    },
    stills: [
      {
        src: "/images/home-services/site.jpg",
        alt: "A building under construction with crews on site",
      },
    ],
  },
  "law-firms": {
    promise: "The week back from process.",
    hero: {
      src: "/images/law-firms/hero.jpg",
      alt: "Law books and a gavel on a wooden desk",
    },
    stills: [
      { src: "/images/law-firms/library.jpg", alt: "A library of bound volumes" },
      { src: "/images/law-firms/steps.jpg", alt: "A gavel resting on a law book" },
    ],
  },
  "professional-services": {
    promise: "Admin off the people who bill.",
    hero: {
      src: "/images/professional-services/hero.jpg",
      alt: "A desk with notebooks, a laptop, and working papers",
    },
    stills: [
      {
        src: "/images/professional-services/office.jpg",
        alt: "An empty office with long windows and desks",
      },
      {
        src: "/images/professional-services/desk.jpg",
        alt: "Hands working through papers at a desk",
      },
    ],
  },
  "real-estate": {
    promise: "A pipeline with a long memory.",
    hero: {
      src: "/images/real-estate/hero.jpg",
      alt: "A row of houses along a quiet residential street",
    },
    stills: [
      { src: "/images/real-estate/house.jpg", alt: "A house at dusk with the lights on" },
      {
        src: "/images/real-estate/interior.jpg",
        alt: "A living room with large windows and a sofa",
      },
    ],
  },
  nonprofits: {
    promise: "Every supporter thanked, then invited back.",
    hero: {
      src: "/images/nonprofits/hero.jpg",
      alt: "Volunteers packing donated goods at a community table",
    },
    stills: [
      {
        src: "/images/nonprofits/packing.jpg",
        alt: "A volunteer packing food into bags for distribution",
      },
      { src: "/images/nonprofits/sorting.jpg", alt: "Volunteers organizing donated fresh produce" },
    ],
  },
} as const satisfies Record<string, IndustryVisual>;

export function industryVisual(slug: string): IndustryVisual | undefined {
  return (INDUSTRY_VISUALS as Record<string, IndustryVisual>)[slug];
}
