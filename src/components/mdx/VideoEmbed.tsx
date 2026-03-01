interface VideoEmbedProps {
  src: string;
  title?: string;
}

export function VideoEmbed({ src, title = "Video" }: VideoEmbedProps) {
  return (
    <div className="my-8 overflow-clip rounded-lg glass p-1">
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <iframe
          src={src}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full rounded-lg"
        />
      </div>
    </div>
  );
}
