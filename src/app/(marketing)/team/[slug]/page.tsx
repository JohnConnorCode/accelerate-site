import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { seoMetadata } from "@/lib/og";
import { generateBreadcrumbJsonLd } from "@/lib/seo";
import { TEAM_MEMBERS, getTeamMember } from "@/content/team";
import { TeamBioContent } from "@/components/sections/TeamBio";

export function generateStaticParams() {
  return TEAM_MEMBERS.map((member) => ({ slug: member.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const member = getTeamMember(slug);
  if (!member) return { title: "Team member not found" };
  return seoMetadata({
    title: `${member.name}, ${member.role}`,
    description: member.summary,
    ogTitle: member.name,
    ogSubtitle: member.role,
    path: `/team/${member.slug}`,
  });
}

export default async function TeamBioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const member = getTeamMember(slug);
  if (!member) notFound();

  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: "Home", url: "/" },
    { name: "Team", url: "/team" },
    { name: member.name, url: `/team/${member.slug}` },
  ]);

  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: member.name,
    jobTitle: member.role,
    image: `https://www.acceleratewith.us${member.image}`,
    url: `https://www.acceleratewith.us/team/${member.slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />
      <TeamBioContent slug={member.slug} />
    </>
  );
}
