import { Fragment, type ReactNode } from "react";
import { SitePageRenderer } from "./renderer";
import type { WebsiteDocument, WebsitePage, WebsiteRichText } from "./website-document";

type Span = Extract<WebsiteRichText[number], { type: "paragraph" }>["content"][number];
function Inline({ content }: { content: Span[] }) {
  return content.map((span, index) => {
    let node: ReactNode = span.text;
    if (span.code) node = <code>{node}</code>;
    if (span.bold) node = <strong>{node}</strong>;
    if (span.italic) node = <em>{node}</em>;
    if (span.href) node = <a href={span.href}>{node}</a>;
    return <span key={index}>{node}</span>;
  });
}

/** Admin-authored prose is a closed tree of React elements. It never enters
 * compileMDX, dangerouslySetInnerHTML, eval, or a component-name resolver. */
export function WebsiteArticle({
  body,
  assets,
}: {
  body: WebsiteRichText;
  assets: WebsiteDocument["assets"];
}) {
  return (
    <div className="prose prose-lg max-w-none">
      {body.map((block, index) => {
        switch (block.type) {
          case "paragraph":
            return (
              <p key={index}>
                <Inline content={block.content} />
              </p>
            );
          case "heading": {
            const Heading = ({ 2: "h2", 3: "h3", 4: "h4" } as const)[block.level];
            return (
              <Heading key={index}>
                <Inline content={block.content} />
              </Heading>
            );
          }
          case "list": {
            const List = block.ordered ? "ol" : "ul";
            return (
              <List key={index}>
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <Inline content={item} />
                  </li>
                ))}
              </List>
            );
          }
          case "quote":
            return (
              <blockquote key={index}>
                <Inline content={block.content} />
              </blockquote>
            );
          case "code":
            return (
              <pre key={index}>
                <code data-language={block.language}>{block.text}</code>
              </pre>
            );
          case "divider":
            return <hr key={index} />;
          case "image": {
            const asset = assets.find((asset) => asset.id === block.assetId);
            if (!asset) throw new Error(`Website asset unavailable: ${block.assetId}`);
            return (
              <figure key={index}>
                {/* Native img supports an installation's own portable asset origins. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.src}
                  alt={block.alt}
                  width={asset.width}
                  height={asset.height}
                  loading="lazy"
                />
                {block.caption && <figcaption>{block.caption}</figcaption>}
              </figure>
            );
          }
        }
      })}
    </div>
  );
}

type NativeSection = Extract<WebsitePage["content"], { kind: "native" }>["sections"][number];
export function WebsitePageContent({
  page,
  assets,
  renderNative,
}: {
  page: WebsitePage;
  assets: WebsiteDocument["assets"];
  renderNative: (section: NativeSection) => ReactNode;
}) {
  switch (page.content.kind) {
    case "article":
      return (
        <article className="mx-auto max-w-3xl px-6 py-24">
          <h1 className="mb-8 text-4xl font-semibold">{page.metadata.title}</h1>
          <WebsiteArticle body={page.content.body} assets={assets} />
        </article>
      );
    case "document":
      return <SitePageRenderer document={page.content.document} assets={assets} />;
    case "native": {
      const visible = page.content.sections.filter((section) => !section.hidden);
      const nodes: ReactNode[] = [];
      const opening = new Set(["home-hero", "home-statement", "home-marquee"]);
      for (let index = 0; index < visible.length; index++) {
        const section = visible[index]!;
        if (opening.has(section.template)) {
          const group = [section];
          while (visible[index + 1] && opening.has(visible[index + 1]!.template))
            group.push(visible[++index]!);
          nodes.push(
            <div className="hero-band" key={section.id}>
              {group.map((item) => (
                <Fragment key={item.id}>{renderNative(item)}</Fragment>
              ))}
            </div>,
          );
        } else nodes.push(<Fragment key={section.id}>{renderNative(section)}</Fragment>);
      }
      return <>{nodes}</>;
    }
  }
}
