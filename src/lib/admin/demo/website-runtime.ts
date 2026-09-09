import { parseWebsiteDocument, type WebsiteDocument } from "@/lib/site-studio/website-document";
import { parseWebsiteCommand, type WebsiteReceipt } from "@/lib/site-studio/website-commands";
import type { WebsiteState } from "@/lib/site-studio/website-store";

export interface DemoWebsiteState {
  website: WebsiteState;
  revisions: Record<string, WebsiteDocument>;
  receipts: Record<string, { fingerprint: string; receipt: WebsiteReceipt }>;
}
export function fictionalWebsite(name: string): WebsiteDocument {
  return parseWebsiteDocument({
    schemaVersion: 1,
    identity: { name, tagline: "A fictional business website for trying Site Studio." },
    navigation: [{ label: "Home", href: "/" }],
    footer: { text: "Fictional demonstration. No services are offered.", links: [] },
    theme: {
      accent: "#816447",
      background: "#fbfbfa",
      foreground: "#171714",
      font: "installation",
      radius: "soft",
    },
    assets: [],
    collections: [],
    pages: [
      {
        id: "home",
        path: "/",
        metadata: {
          title: `${name} website`,
          description: "A fictional website draft.",
          noIndex: true,
        },
        content: {
          kind: "native",
          sections: [
            {
              id: "welcome",
              template: "home-hero",
              hidden: false,
              fields: {
                eyebrow: name,
                prefix: "Make room for",
                highlighted: "better service",
                suffix: "with a",
                replacedWord: "busy",
                finalWord: "focused team",
                ctaLabel: "Explore this example",
                ctaHref: "#faq",
              },
            },
            {
              id: "questions",
              template: "home-faq",
              hidden: false,
              fields: {
                eyebrow: "Questions",
                title: "Try editing this example.",
                questions: ["Is this a real business?", "Will saving contact anyone?"],
                answers: [
                  "No. This website belongs to a fictional demo scenario.",
                  "No. Changes stay in this browser session and never reach a provider.",
                ],
              },
            },
          ],
        },
      },
    ],
  });
}
export const createDemoWebsiteState = (): DemoWebsiteState => ({
  website: { version: 0, draft: null, publishedRevisionId: null },
  revisions: {},
  receipts: {},
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** The shared demo engine persists this state in the active scenario's session.
 * It uses the real command schema but cannot reach a database or provider. */
export function handleDemoWebsite(
  state: DemoWebsiteState,
  name: string,
  method: string,
  input: unknown,
): Response {
  if (method === "GET") return json({ website: state.website, bundled: fictionalWebsite(name) });
  if (method !== "POST") return json({ error: "Method not supported" }, 405);
  let command;
  try {
    command = parseWebsiteCommand(input);
  } catch {
    return json({ error: "Check the website content and command." }, 400);
  }
  const fingerprint = JSON.stringify(command);
  const prior = state.receipts[command.requestKey];
  if (prior)
    return prior.fingerprint === fingerprint
      ? json({ receipt: prior.receipt })
      : json({ error: "Request key reused for different content." }, 409);
  if (command.expectedVersion !== state.website.version)
    return json(
      { error: "The website changed. Reload the saved draft; local edits have not been applied." },
      409,
    );
  if (command.operation !== "save" && !state.website.draft)
    return json({ error: "Save a draft first." }, 409);
  if (command.operation === "publish" && command.revisionId !== state.website.draft?.id)
    return json({ error: "Publish the current saved draft." }, 409);
  if (
    command.operation === "rollback" &&
    !Object.values(state.receipts).some(
      ({ receipt }) => receipt.publishedRevisionId === command.revisionId,
    )
  )
    return json({ error: "Choose a previously published revision." }, 409);
  const previousPublishedRevisionId = state.website.publishedRevisionId;
  const createdAt = new Date().toISOString();
  if (command.operation === "save") {
    const id = crypto.randomUUID();
    state.revisions[id] = structuredClone(command.document);
    state.website.draft = {
      id,
      checksum: "demo-content-revision",
      createdAt,
      document: structuredClone(command.document),
    };
  } else if (command.operation === "unpublish") state.website.publishedRevisionId = null;
  else state.website.publishedRevisionId = command.revisionId;
  state.website.version++;
  const receipt: WebsiteReceipt = {
    requestKey: command.requestKey,
    operation: command.operation,
    version: state.website.version,
    draftRevisionId: state.website.draft!.id,
    publishedRevisionId: state.website.publishedRevisionId,
    previousPublishedRevisionId,
    createdAt,
  };
  state.receipts[command.requestKey] = { fingerprint, receipt };
  return json({ receipt });
}
