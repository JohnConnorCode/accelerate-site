import "server-only";
import { services } from "@/content/services";

export interface ApprovedServicePrice {
  name: string;
  oneTime: number;
  monthly: number;
  display: string;
}

function parsePrice(value: string | undefined): number {
  if (!value) return 0;
  const amount = Number(value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Approved service pricing contains an invalid amount");
  return amount;
}

/** The public typed service manifest is the single approved source for draft prices. */
export const APPROVED_SERVICE_PRICES: readonly ApprovedServicePrice[] = services.map((service) => ({
  name: service.name,
  oneTime: parsePrice(service.pricingOneTime),
  monthly: parsePrice(service.pricingMonthly),
  display: service.pricingDisplay,
}));

export function approvedPricingPromptContext(): string {
  return JSON.stringify(APPROVED_SERVICE_PRICES);
}

export function assertApprovedPrice(input: { item: string; oneTime: number; monthly: number }): void {
  const approved = APPROVED_SERVICE_PRICES.find((service) => service.name === input.item);
  if (!approved || approved.oneTime !== input.oneTime || approved.monthly !== input.monthly) {
    throw new Error("Pricing for " + input.item + " is not an approved catalog price. Leave pricing for founder scope confirmation instead.");
  }
}

export function assertApprovedPricingRows(rows: Array<{ item: string; oneTime: number; monthly: number }>): void {
  for (const row of rows) assertApprovedPrice(row);
}

export function assertApprovedPriceComponent(input: { item: string; amount: number; kind: "oneTime" | "monthly" }): void {
  const approved = APPROVED_SERVICE_PRICES.find((service) => service.name === input.item);
  if (!approved || approved[input.kind] !== input.amount) {
    throw new Error("Pricing for " + input.item + " is not an approved catalog " + input.kind + " amount.");
  }
}
