import { featuredWork, publicWorkProjects } from "@/content/work";
import { WorkCard } from "./WorkCard";

export function WorkIndex() {
  const flagships = featuredWork.slice(0, 2);
  const supporting = publicWorkProjects.slice(2);
  return (
    <div className="page-shell pb-[clamp(5rem,10vw,10rem)]">
      <div className="grid gap-x-8 gap-y-10 lg:grid-cols-12 lg:gap-y-16" data-work-tier="flagship">
        {flagships.map((project, index) => <div key={project.slug} className="lg:col-span-6"><WorkCard project={project} featured priority={index === 0} index={index} aspect="wide" /></div>)}
      </div>
      <div className="mt-12 grid gap-x-8 gap-y-10 lg:mt-20 lg:grid-cols-2 lg:gap-y-16" data-work-tier="supporting">
        {supporting.map((project, index) => <WorkCard key={project.slug} project={project} index={index + 2} aspect="wide" />)}
      </div>
    </div>
  );
}
