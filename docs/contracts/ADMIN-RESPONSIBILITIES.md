# Admin page responsibilities

Each page has one source of truth. Cross page views may link to a record or project it, but do not own a second status or decision.

| Page          | Owns                                                                                            | Related views                                                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Today         | Attention summary across records                                                                | Opens the owning page for each item.                                                                                                              |
| Work          | Human tasks, AI work status, and exact action approvals                                         | Saved filters and breakdowns project canonical tasks. Views can stay private or be shared with the workspace. Domain cases stay in their own App. |
| Pipeline      | Opportunity stage and next sales step                                                           | Contact relationships and Work link to the opportunity.                                                                                           |
| Conversations | Customer message threads and replies                                                            | Contacts show related history.                                                                                                                    |
| Contacts      | Canonical `contacts` directory and relationship history                                         | Website requests, list imports, and identity matching are separate contact workflows, reached from Contacts.                                      |
| Invoicing     | All invoices in the connected Stripe account, draft and send operations, provider payment state | Collections owns collection cases, reminders, promises, and disputes. Subscriptions owns recurring plans. Both are linked from Invoicing.         |
| Intake review | Incoming lead and partner submissions                                                           | Tasks, AI work, and approvals live in Work.                                                                                                       |

The contact directory reads `contacts`. `/api/admin/contacts` remains the website submission compatibility API; new directory reads use `/api/admin/contacts/directory`. Manual contact edits need the shared action and AI parity path before they can be added. Opening a website request leaves its unread state intact. The operator marks it read explicitly after inspection.

The invoice index reads all Stripe account invoices directly using bounded cursor pagination. Draft/send approvals and app operation history remain in Invoicing. A Stripe invoice status is not proof that an email was delivered. Collections owns follow-up cases and evidence.

Completed AI run feedback remains an audit event. Consequential actions continue through existing approval and execution services.
