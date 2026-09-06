import Image from "next/image";

export function DocsFigure({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className="not-prose my-8">
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${alt} Open full-size image in a new tab.`}
      >
        <Image
          src={src}
          alt={alt}
          width={1400}
          height={875}
          sizes="(max-width: 1023px) 100vw, 800px"
          className="h-auto w-full rounded-xl outline outline-1 outline-black/10"
        />
      </a>
      <figcaption className="mt-3 text-sm leading-relaxed text-white-secondary">
        {caption} Select the image to view it full size.
      </figcaption>
    </figure>
  );
}
