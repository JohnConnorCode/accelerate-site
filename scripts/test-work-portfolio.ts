import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { archivedWorkProjects, featuredWork, getWorkBySlug, publicWorkProjects, workProjects } from "../src/content/work";

const expectedPublicSlugs = ["work-shelter", "superdebate", "healthcare-real-estate", "sparkblox", "thrive-protocol", "green-goods"];
const expectedSlugs = ["work-shelter", "healthcare-real-estate", "superdebate", "sparkblox", "thrive-protocol", "green-goods", "northern-trust"];
const prohibited = ["290%", "12x", "12×", "30% satisfaction", "31 live platform features", "~50 accepted"];

assert.deepEqual(workProjects.map((project) => project.slug), expectedSlugs, "work order must remain editorially intentional");
assert.deepEqual(publicWorkProjects.map((project) => project.slug), expectedPublicSlugs, "public work must contain the six aligned cases");
assert.deepEqual(archivedWorkProjects.map((project) => project.slug), ["northern-trust"], "Northern Trust must remain an archive-only case");
assert.equal(featuredWork.length, 4, "homepage must show the four flagship cases");
assert.equal(new Set(workProjects.map((project) => project.slug)).size, workProjects.length, "work slugs must be unique");

for (const project of workProjects) {
  assert.ok(project.name && project.category && project.cardHeadline && project.cardDescription, `${project.slug} needs card copy`);
  assert.ok(project.relationship && project.timeline && project.sections.length >= 3, `${project.slug} needs case context`);
  assert.ok(project.industry && project.role && project.seoTitle && project.seoDescription, `${project.slug} needs transparent metadata and SEO copy`);
  assert.ok(project.cardMedia && project.heroMedia, `${project.slug} needs card and hero evidence`);
  assert.ok(project.visualBlocks.length >= 1, `${project.slug} needs an individualized visual sequence`);
  assert.equal(project.related.length, 2, `${project.slug} needs two related cases`);
  for (const related of project.related) assert.equal(getWorkBySlug(related)?.visibility, "public", `${project.slug} must link only to public related work`);
  const copy = JSON.stringify(project);
  for (const banned of prohibited) assert.ok(!copy.includes(banned), `${project.slug} includes prohibited claim: ${banned}`);
  assert.ok(!copy.includes("—"), `${project.slug} includes an em dash`);
  const media = [project.cardMedia, project.heroMedia, ...project.visualBlocks.flatMap((block) => block.media)];
  for (const item of media) {
    if (item.kind === "image") {
      assert.ok(existsSync(join(process.cwd(), "public", item.src)), `${project.slug} is missing ${item.src}`);
      assert.ok(item.width > 0 && item.height > 0, `${project.slug} image ${item.src} needs intrinsic dimensions`);
      assert.ok(item.presentation, `${project.slug} image ${item.src} needs a presentation role`);
    }
    if (item.kind === "youtube") assert.ok(existsSync(join(process.cwd(), "public", item.poster)), `${project.slug} is missing video poster ${item.poster}`);
  }
  const detailKeys = [project.heroMedia, ...project.visualBlocks.flatMap((block) => block.media)].map((item) => item.kind === "image" ? item.src : item.kind === "diagram" ? item.variant : item.youtubeId);
  assert.equal(new Set(detailKeys).size, detailKeys.length, `${project.slug} must not repeat media within its case-study page`);
}

for (const project of publicWorkProjects) {
  assert.equal(project.visibility, "public");
  assert.equal(project.serviceIds.length, 2, `${project.slug} must map to two current Accelerate services`);
}
assert.equal(new Set(publicWorkProjects.map((project) => project.artDirection.world)).size, publicWorkProjects.length, "each public case needs a distinct art-direction world");
assert.deepEqual(getWorkBySlug("northern-trust")?.serviceIds, [], "the archived case must not imply a current service mapping");

assert.equal(getWorkBySlug("work-shelter")?.proof, "80% reduction in U.S. client-management hours");
assert.equal(getWorkBySlug("healthcare-real-estate")?.proof, "40% faster inquiry-to-close");
assert.equal(getWorkBySlug("sparkblox")?.proof, "$1M+ raised");
assert.equal(getWorkBySlug("green-goods")?.proof, "$49K in grants secured by the project");
assert.equal(getWorkBySlug("northern-trust")?.proof, "Initial 6-week engagement extended through 2021");
assert.equal(getWorkBySlug("superdebate")?.proof, undefined);
assert.equal(getWorkBySlug("thrive-protocol")?.proofLabel, "Program context");
assert.equal(getWorkBySlug("thrive-protocol")?.showProofOnCard, false, "Thrive program context must stay off the index card");
assert.ok(getWorkBySlug("green-goods")?.visualBlocks.some((block) => JSON.stringify(block).includes("Green Goods today")));
const greenGoodsContextGraphic = getWorkBySlug("green-goods")?.visualBlocks
  .flatMap((block) => block.media)
  .find((media) => media.kind === "image" && media.src.endsWith("project-context.webp"));
assert.equal(greenGoodsContextGraphic?.kind === "image" ? greenGoodsContextGraphic.fit : undefined, "contain", "the Green Goods context graphic must remain fully visible");
assert.ok(getWorkBySlug("northern-trust")?.visualBlocks.some((block) => block.media.some((media) => media.kind === "youtube")), "Northern Trust must demonstrate motion");

const expectedWorkShelterScreens = [
  "customer-site-hero.webp",
  "catalog-experience.webp",
  "brand-partners.webp",
  "quote-flow-overview.webp",
  "command-center-dashboard.webp",
  "orders-workspace.webp",
  "products-inventory.webp",
  "campaign-admin-help.webp",
];
const workShelter = getWorkBySlug("work-shelter");
const workShelterMedia = JSON.stringify([workShelter?.cardMedia, workShelter?.heroMedia, workShelter?.visualBlocks]);
for (const screen of expectedWorkShelterScreens) assert.ok(workShelterMedia.includes(screen), `WORK+SHELTER must use supplied screen ${screen}`);
assert.ok(!workShelterMedia.includes("quote-flow-detail.webp"), "WORK+SHELTER must not render the redundant quote detail capture");
assert.equal(workShelter?.cardMedia.kind === "image" ? workShelter.cardMedia.src : undefined, "/work/work-shelter/customer-site-hero.webp", "WORK+SHELTER must use the customer experience as its canonical cover");

const expectedSuperDebateScreens = [
  "product-home.webp",
  "online-product.webp",
  "admin-dashboard.webp",
  "admin-events.webp",
  "admin-roadmap.webp",
  "admin-email.webp",
];
const superDebate = getWorkBySlug("superdebate");
const superDebateMedia = JSON.stringify([superDebate?.cardMedia, superDebate?.heroMedia, superDebate?.visualBlocks]);
for (const screen of expectedSuperDebateScreens) assert.ok(superDebateMedia.includes(screen), `SuperDebate must use supplied screen ${screen}`);
assert.ok(superDebate?.visualBlocks.some((block) => block.eyebrow === "SuperDebate command center"), "SuperDebate admin must be identified as its command center");

console.log(`work portfolio contract passed (${workProjects.length} projects)`);
