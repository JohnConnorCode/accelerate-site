// Test-process preload only. No application code imports this adapter.
import { qaInvoice } from "./lib/qa-business-fixtures.mjs";
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.hostname === "api.stripe.com") {
    if (url.pathname !== "/v1/invoices/in_fixture" || (init?.method && init.method !== "GET"))
      throw new Error("Unrecognized controlled Stripe operation");
    return new Response(JSON.stringify(qaInvoice), {
      status: 200,
      headers: { "content-type": "application/json", "request-id": "req_controlled_browser" },
    });
  }
  if (!["localhost", "127.0.0.1"].includes(url.hostname))
    throw new Error("External network disabled in business browser fixture");
  return nativeFetch(input, init);
};
