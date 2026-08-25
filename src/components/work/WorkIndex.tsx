import { featuredWork, publicWorkProjects } from "@/content/work";
import { WorkCard } from "./WorkCard";

export function WorkIndex() {
  const flagships = featuredWork.slice(0, 2);
  const supportingFeatures = featuredWork.slice(2);
  const secondary = publicWorkProjects.slice(4);
  const flagshipLayouts = [
    { span: "lg:col-span-7", aspect: "editorial" as const },
    { span: "lg:col-span-5", aspect: "portrait" as const },
  ];
  const supportingLayouts = [
    { span: "lg:col-span-5", aspect: "square" as const },
    { span: "lg:col-span-7", aspect: "wide" as const },
  ];
  return (
    <div className="page-shell pb-[clamp(5rem,10vw,10rem)]">
      <div className="grid gap-x-8 gap-y-10 lg:grid-cols-12 lg:gap-y-16" data-work-tier="flagship">
        {flagships.map((project, index) => {
          const layout = flagshipLayouts[index] ?? flagshipLayouts[0]!;
          return (
            <div key={project.slug} className={layout.span}>
              <WorkCard project={project} featured priority={index === 0} index={index} aspect={layout.aspect} />
            </div>
          );
        })}
      </div>
      <div className="mt-14 grid gap-x-8 gap-y-10 border-t border-[var(--rule)] pt-10 lg:mt-24 lg:grid-cols-12 lg:gap-y-16 lg:pt-14" data-work-tier="supporting-feature">
        {supportingFeatures.map((project, index) => {
          const layout = supportingLayouts[index] ?? supportingLayouts[0]!;
          return (
            <div key={project.slug} className={layout.span}>
              <WorkCard project={project} index={index + 2} aspect={layout.aspect} />
            </div>
          );
        })}
      </div>
      <div className="mt-10 grid gap-x-8 gap-y-10 lg:mt-20 lg:grid-cols-2 lg:gap-y-16" data-work-tier="supporting">
        {secondary.map((project, index) => <WorkCard key={project.slug} project={project} index={index + 4} aspect={index === 0 ? "cinematic" : "wide"} />)}
      </div>
    </div>
  );
}
