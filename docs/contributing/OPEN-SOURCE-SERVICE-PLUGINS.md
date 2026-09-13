# Package an open-source service as an Accelerate plugin

Use a bundled module and a narrow integration adapter when a feature depends on
an independently hosted open-source application. Social Marketing/Postiz is the
first implementation of this packaging pattern. Its application integration is
reviewable in source; its live service and customer rollout require their own
verification. A manifest does not install, trust or operate a repository by itself.

Start with [Extending Revenue OS](EXTENDING.md) and the
[plugin documentation contract](../contracts/PLUGIN-DOCUMENTATION.md).

## Keep ownership clear

Accelerate owns workspace identity, member permissions, enablement, native task
screens, AI/MCP tools, human approvals, WorkItems and immutable receipts. The
external service owns its provider-specific protocol and separately operated
runtime. The connector translates a small set of reviewed operations between
them. Credentials stay encrypted in tenant provider storage.

Deploy the service separately when it requires long-running workers, its own
database or an incompatible execution environment. An upstream group or filter
is not an isolation boundary. Prove tenant identity from authenticated service
facts and enforce a unique mapping where organizations must be exclusive.

## Package the feature

Create `extensions/<id>.module.json`, `plugins/<id>/README.md`, a public guide,
reviewed domain services and adapter, native route components, tool registration,
and additive migrations for any new records. Use the existing module schemas
and build script. Keep a new external-service feature disabled by default.

The optional `upstream` manifest block supports `repository`, `license`,
`revision`, `connector`, `deploymentGuide` and `imageDigest`. Record the actual
repository and exact source revision. Set an image digest only after producing
that image. These fields are provenance metadata, not a verified readiness badge.
The schema and module builder validate their shape and local guide path.

Include deployment assets under `plugins/<id>/deployment/`: source preparation,
reviewed patches, license notices, immutable image references, health checks,
private configuration instructions, persistent data, backups, restore and upgrade
procedures. Never commit private environment files. Provide corresponding source
when the upstream license requires it; do not label every third-party component
with the host application's MIT license.

## Expose a complete business operation

A task should read current facts, preview an exact change, stage human approval
when needed, recheck freshness and authority, claim its operation, execute through
the domain service and retain a truthful receipt. The same operation serves the
native UI and AI/MCP. Provider setup can hand off to upstream UI while day-to-day
work remains native.

External effects need a durable claim before network I/O. If the provider supports
idempotency, retain its deterministic key and response. Otherwise treat ambiguous
acceptance as unknown and provide explicit reconciliation. Automatic retries must
never manufacture duplicate publications, charges or messages. Honor cancellation
and bounded deadlines before beginning another external effect.

Every feature must explain what disablement does to drafts, queued work,
submitted effects and retained history. Deleting a connection must stop new
provider requests. Re-enabling must not silently revive stale human approvals.

## Compose features through shared services

Reuse canonical CRM, knowledge, website, campaign, WorkItem and action records.
Read them through tenant-bound services; link IDs and source revisions instead
of copying unrelated systems into the plugin. A trigger that creates drafts is
different from a trigger that authorizes public effects. State which exists.

The [Social Marketing extension guide](../../plugins/social-marketing/EXTENDING.md)
shows concrete knowledge, Drive, Site Studio, campaign and Radar compositions,
including the additional work needed for unattended triggers and attribution.

## Deliver evidence people can trust

A ready source package needs a complete first task, worked fictional example,
settings reference, permission and cost boundaries, recovery instructions and
extension points. Public guide, changelog, module metadata and Command Center
copy must agree. Demo screens must use the real components with isolated fixtures.

Test tenant and credential isolation, disabled state, changed approvals, replay,
provider refusal, timeout, interrupted persistence and recovery. Open desktop and
mobile screenshots, exercise keyboard flows and check console errors. Run the
required build and compatibility checks once on the final relevant source tree.

A production service additionally needs exact deployed images, host health,
real provider authorization, isolation evidence, restored backup proof, monitored
receipts and a controlled pilot. Record the exact commit, image/source checksums,
target, test identities and result without exposing secrets. Implementation,
service readiness, pilot acceptance and customer availability are separate facts.
