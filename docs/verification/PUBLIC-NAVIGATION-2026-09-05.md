# Public site structure and docs discovery audit

Scope: the existing docs branch plus the founder-requested public header, mobile
menu, footer, homepage product section, Command Center overview, and open-source
onboarding link. No deployment or live board completion is implied.

| Before                                                                                           | After                                                                                                                             |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Header repeated Open Source and Roadmap both inside and outside the product submenu.             | Seven primary choices; product destinations are grouped under Command Center, and Docs remains directly visible.                  |
| Header, footer, and an unused navigation content file defined competing link lists.              | Both header variants and footer consume `src/content/navigation.ts`; shared groups prevent drift.                                 |
| Team occupied the primary navigation while About and Partners were footer-only.                  | Company groups About us, Team, Partners, and Contact. Learn groups articles and downloads.                                        |
| No product group in the footer.                                                                  | Command Center includes overview, demo, open source, roadmap, changelog, docs, and self-hosting.                                  |
| Homepage product section and product overview stopped at demo or conversion links.               | Both include a direct Read the docs link; the open-source installation link stays in the docs library.                            |
| Desktop disclosure buttons opened on focus but could not reliably toggle or dismiss with Escape. | Explicit click/Enter/Space disclosure, ordinary Tab links, Escape focus restoration, outside-click and link dismissal.            |
| Collapsed mobile submenus remained in the focus order.                                           | Collapsed children are inert and hidden from assistive technology; Tab, Escape, focus return, and breakpoint changes are covered. |
| Crowded desktop header appeared at tablet widths.                                                | The mobile menu remains through tablet widths; desktop starts at 1280px. Main controls and footer links have larger targets.      |

Screenshot review also found a phone-width newsletter form overflow. The input
can now shrink within its flex row, the submit button retains its width, and browser
QA checks the bounds of every footer link, input, and button.

The homepage keeps its existing agency-first sequence: offer, services, industries,
optional Command Center, process, plan, work, company, questions, and contact. The
change adds a useful product-learning path without making Command Center the
required solution for every visitor. Existing service anchors resolve from the
service content; industry links remain derived from the vertical catalog.

Verification extends `qa:docs` with the public entry paths at desktop, tablet, and
phone widths; keyboard disclosure behavior, collapsed focus exclusion, mobile
resize cleanup, all header/footer route responses and service anchors. Browser
artifacts remain in the existing remote CI artifact. Local lint, search, docs,
and architecture checks cover the scoped edits.

The separate legacy `scripts/test-navigation-runtime.ts` currently fails on the
unchanged baseline: whitespace-sensitive CSS assertions, an old pre-resource-gate
build command assertion, and an existing admin branding navigation assertion.
Exploratory assertion repairs were reverted; this public navigation change does
not claim that broader admin suite passes. No admin source or resource limits
were changed.
