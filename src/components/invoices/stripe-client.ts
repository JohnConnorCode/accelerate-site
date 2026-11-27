import { loadStripe, type Stripe, type Appearance } from "@stripe/stripe-js";

export const checkoutAppearance: Appearance = {
  theme: "stripe",
  variables: {
    colorPrimary: "#111111",
    colorBackground: "#ffffff",
    colorText: "#171717",
    colorTextSecondary: "#525252",
    colorTextPlaceholder: "#666666",
    colorDanger: "#dc2626",
    fontFamily: "Inter, system-ui, sans-serif",
    borderRadius: "12px",
  },
};
const clients = new Map<string, Promise<Stripe | null>>();
/** The server supplies the publishable key belonging to this exact intent. */
export function getStripe(publishableKey: string): Promise<Stripe | null> {
  let client = clients.get(publishableKey);
  if (!client) {
    client = loadStripe(publishableKey);
    clients.set(publishableKey, client);
  }
  return client;
}
