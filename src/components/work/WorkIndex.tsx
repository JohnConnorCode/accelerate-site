import { featuredWork, publicWorkProjects } from "@/content/work";
import { WorkCard } from "./WorkCard";

export function WorkIndex() {
  const flagships = featuredWork.slice(0, 2);
  const supporting = publicWorkProjects.slice(2);
  const supportingLayout = [
    { className: "lg:col-span-5", aspect: "editorial" as const },
    { className: "lg:col-span-7 lg:pt-24", aspect: "cinematic" as const },
    { className: "lg:col-span-7", aspect: "wide" as const },
    { className: "lg:col-span-5 lg:pt-24", aspect: "editorial" as const },
    { className: "lg:col-span-8 lg:col-start-3", aspect: "cinematic" as const },
  ];
  return (
    <div className="page-shell pb-[clamp(5rem,10vw,10rem)]">
      <div
        className="grid gap-x-8 gap-y-10 lg:grid-cols-12 lg:gap-y-16"
        data-work-tier="flagship"
        data-work-layout="editorial"
      >
        {flagships.map((project, index) => (
          <div
            key={project.slug}
            className={index === 0 ? "lg:col-span-7" : "lg:col-span-5 lg:pt-28"}
          >
            <WorkCard
              project={project}
              featured
              priority={index === 0}
              index={index}
              aspect={index === 0 ? "cinematic" : "editorial"}
            />
          </div>
        ))}
      </div>
      <div
        className="mt-12 grid gap-x-8 gap-y-10 lg:mt-24 lg:grid-cols-12 lg:gap-y-20"
        data-work-tier="supporting"
        data-work-layout="editorial"
      >
        {supporting.map((project, index) => (
          <div key={project.slug} className={supportingLayout[index]?.className ?? "lg:col-span-6"}>
            <WorkCard
              project={project}
              index={index + 2}
              aspect={supportingLayout[index]?.aspect ?? "wide"}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
