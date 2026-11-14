import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "@/lib/toast";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, Expand } from "lucide-react";
import Written from "@/components/motion/Written";
import { copyText } from "@/lib/share";
import { useCodeHighlight } from "@/components/notes/CodeHighlight";
import { H2, H3, H4 } from "@/components/notes/headingAnchors";
import { rehypeHeadingIds } from "@/components/notes/headingIds";
import { rehypeCodeFrames } from "./codeFrames";
import Lightbox, { type Figure } from "./Lightbox";
import NoteLink from "./NoteLink";
import { isSvgSrc, svgDataUrl } from "./svgSafe";
import { internalTarget, remarkWikilinks } from "./wikilinks";
import { useReaderWords } from "./words";
import styles from "./Reader.module.css";

/*
 * A note's body, rendered (#249). The one renderer: the public reader at
 * /blog/:slug and the editor's live preview (#250) both draw through this, so
 * what the author previews is what ships.
 *
 * There is no rehype-raw here and there never will be: without it
 * react-markdown refuses raw HTML, which removes the whole stored-content XSS
 * surface. That makes the `components` object below the only injection point
 * the renderer has, and everything it adds is built from React elements:
 *
 *  - `[[wikilinks]]` become ordinary link nodes in mdast (`wikilinks.ts`), and
 *    a link to a note, an area or a project gets a preview (`NoteLink`).
 *  - an outbound link opens in a new tab, says so to a screen reader, and
 *    carries the ↗ it always had.
 *  - a picture is a button that opens the picture view (`Lightbox`); an `.svg`
 *    picture is a diagram and is drawn crisp at any zoom.
 *  - a fenced ```svg block is drawn as a diagram through `svgSafe` (an
 *    allowlist rebuild, then an `<img>` from a data: URL, so it can run no
 *    script whatever it contains); a source that fails the rebuild stays code.
 *  - a fenced block of code gets its language and a copy button.
 *
 * `pen` is the running text written word by word (`motion/Written`). The
 * reader has it; the editor's preview turns it off, because a preview inside
 * a scrolling pane is not the page's reading window, and an author checking a
 * sentence wants it at full ink.
 */

const FULL_WIDTH = "bleed bleed-column";

/* ---------------------------------------------------------------- figures -- */

type Opener = (el: HTMLElement) => void;
const FigureContext = createContext<Opener | null>(null);
const PenContext = createContext(true);

function figuresIn(root: HTMLElement): { list: Figure[]; nodes: HTMLElement[] } {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-figure]"));
  return {
    nodes,
    list: nodes.map((n) => ({
      src: n.dataset.src ?? "",
      alt: n.dataset.alt ?? "",
      caption: n.dataset.caption ?? "",
      kind: n.dataset.figure === "diagram" ? "diagram" : "picture",
    })),
  };
}

function OpenButton({
  src,
  alt,
  caption,
  diagram,
  children,
}: {
  src: string;
  alt: string;
  caption: string;
  diagram: boolean;
  children: ReactNode;
}) {
  const [w] = useReaderWords();
  const open = useContext(FigureContext);
  const label = diagram ? w.openDiagram(alt) : w.openPicture(alt);
  if (!open) return <>{children}</>;
  return (
    <button
      type="button"
      className={styles.figureButton}
      data-figure={diagram ? "diagram" : "picture"}
      data-src={src}
      data-alt={alt}
      data-caption={caption}
      aria-label={label}
      title={label}
      onClick={(e) => open(e.currentTarget)}
    >
      {children}
      <span className={styles.figureExpand} aria-hidden="true">
        <Expand size={16} />
      </span>
    </button>
  );
}

function Picture({ src, alt, title }: { src?: string; alt?: string; title?: string }) {
  if (!src) return null;
  const diagram = isSvgSrc(src);
  return (
    <span className={`not-prose ${FULL_WIDTH} my-9 block`} data-written="off">
      <OpenButton src={src} alt={alt ?? ""} caption={title ?? ""} diagram={diagram}>
        <img
          src={src}
          alt={alt ?? ""}
          loading="lazy"
          decoding="async"
          data-kind={diagram ? "diagram" : "picture"}
          className={`block w-full border-y border-edge sm:rounded-[var(--r-lg)] sm:border ${diagram ? styles.diagram : ""}`}
        />
      </OpenButton>
      {title && (
        <span className="mono mt-3 block text-center text-[0.75rem] tracking-[0.06em] text-clay">{title}</span>
      )}
    </span>
  );
}

function SvgDiagram({ source }: { source: string }) {
  const [w] = useReaderWords();
  const url = useMemo(() => svgDataUrl(source), [source]);
  const name = useMemo(() => /<title>([^<]{1,200})<\/title>/.exec(source)?.[1]?.trim() ?? "", [source]);
  if (!url) return <CodeFrame lang="svg">{source}</CodeFrame>;
  return (
    <div className={`not-prose ${FULL_WIDTH} my-9`}>
      <OpenButton src={url} alt={name || w.diagram} caption="" diagram>
        <img src={url} alt={name || w.diagram} className={`block w-full ${styles.diagram} ${styles.inlineDiagram}`} />
      </OpenButton>
    </div>
  );
}

/* ------------------------------------------------------------------- code -- */

function CodeFrame({ lang, children, pre }: { lang: string; children: ReactNode; pre?: boolean }) {
  const [w] = useReaderWords();
  const box = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const label = lang && lang !== "none" ? lang : w.plain;

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  return (
    <div className={`not-prose ${FULL_WIDTH} my-9 ${styles.codeFrame}`} ref={box}>
      <div className={styles.codeBar}>
        <span className={styles.codeLang}>
          <span className="sr-only">{w.codeIn(label)}</span>
          <span aria-hidden="true">{label}</span>
        </span>
        <button
          type="button"
          className={styles.codeCopy}
          aria-label={w.copyCode}
          title={w.copyCode}
          onClick={async () => {
            const text = box.current?.querySelector("pre")?.textContent ?? "";
            const ok = await copyText(text);
            setCopied(ok);
            if (ok) toast.success(w.codeCopied);
            else toast.error(w.codeCopyFailed, { help: { topic: "sharing" } });
          }}
        >
          {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
        </button>
      </div>
      {pre === false ? children : <CodePre>{children}</CodePre>}
    </div>
  );
}

function CodePre({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <pre
      style={style}
      /* Focusable because it scrolls: a keyboard-only reader has no other way
         to reach the right-hand end of a long line. */
      tabIndex={0}
      /* `font-code`, the generic monospace: see the token block in index.css. */
      className={`overflow-x-auto border-y border-edge bg-bitumen px-5 py-4 font-code text-[0.8125rem] leading-[1.65] text-bone/90 [scrollbar-width:thin] sm:rounded-b-[var(--r-lg)] sm:border sm:text-[0.875rem] ${className}`}
    >
      {children}
    </pre>
  );
}

/* ------------------------------------------------------------------ links -- */

function MarkdownLink({ href, children, ...rest }: { href?: string; children?: ReactNode; "data-wikilink"?: string }) {
  const [w] = useReaderWords();
  const target = internalTarget(href);
  if (target && href) {
    const to = /^https?:\/\//i.test(href) ? href.replace(/^https?:\/\/[^/]+/i, "") : href;
    return (
      <NoteLink to={to} kind={target.kind} slug={target.slug} wiki={Boolean(rest["data-wikilink"])}>
        {children}
      </NoteLink>
    );
  }
  const isAbsolute = typeof href === "string" && /^https?:\/\//i.test(href);
  const external = isAbsolute && !(typeof window !== "undefined" && href.startsWith(window.location.origin));
  if (!external) return <a href={href}>{children}</a>;
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" data-external="">
      {children}
      <span aria-hidden="true" className="ml-0.5 no-underline">
        &#8599;
      </span>
      <span className="sr-only"> {w.external}</span>
    </a>
  );
}

function MarkdownTable({ children }: { children?: ReactNode }) {
  const [w] = useReaderWords();
  return (
    /* Focusable because below ~560px it scrolls sideways (WCAG 2.1.1, #99). */
    <div
      tabIndex={0}
      role="region"
      aria-label={w.table}
      className={`not-prose ${FULL_WIDTH} my-9 overflow-x-auto px-5 [scrollbar-width:thin] sm:px-0`}
    >
      <table className="w-full min-w-[30rem] border-collapse text-left">{children}</table>
    </div>
  );
}

/* A break inside a post is the same kind of break as one between the home
   page's sections, so it gets the same silhouette rather than a grey line. */
function MarkdownRule() {
  return (
    <div className={`not-prose ${FULL_WIDTH} my-12 h-6 opacity-70`} aria-hidden="true">
      <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className="h-full w-full" role="presentation">
        <path
          d="M0,40 C120,52 240,30 360,38 C500,47 604,26 728,32 C868,39 1010,24 1160,36 C1290,46 1380,34 1440,42 L1440,64 L0,64 Z"
          fill="rgb(var(--edge) / 0.55)"
        />
      </svg>
    </div>
  );
}

function Para({ children }: { children?: ReactNode }) {
  return useContext(PenContext) ? <Written>{children}</Written> : <p>{children}</p>;
}
function Item({ children, className }: { children?: ReactNode; className?: string }) {
  return useContext(PenContext) ? (
    <Written as="li" className={className}>
      {children}
    </Written>
  ) : (
    <li className={className}>{children}</li>
  );
}

/* Module scope, so the object identity is stable across renders. */
const markdown: Components = {
  h1: ({ children }) => <h1 className="display-tight">{children}</h1>,
  h2: ({ children, id }) => <H2 id={id}>{children}</H2>,
  h3: ({ children, id }) => <H3 id={id}>{children}</H3>,
  h4: ({ children, id }) => <H4 id={id}>{children}</H4>,
  h5: ({ children }) => <h5 className="display-tight">{children}</h5>,
  h6: ({ children }) => <h6 className="display-tight">{children}</h6>,
  a: ({ href, children, ...rest }) => (
    <MarkdownLink href={href} data-wikilink={(rest as Record<string, string>)["data-wikilink"]}>
      {children}
    </MarkdownLink>
  ),
  img: ({ src, alt, title }) => <Picture src={typeof src === "string" ? src : undefined} alt={alt} title={title} />,
  figure: (props) => {
    const p = props as Record<string, unknown> & { children?: ReactNode };
    if (typeof p["data-svg"] === "string") return <SvgDiagram source={p["data-svg"]} />;
    const lang = typeof p["data-code"] === "string" ? p["data-code"] : "none";
    return (
      <CodeFrame lang={lang} pre={false}>
        {p.children}
      </CodeFrame>
    );
  },
  /* `className` and `style` are how Shiki hands over the theme's ground and
     ink once it has loaded; before that the classes stand alone. */
  pre: ({ children, className, style }) => (
    <CodePre className={className} style={style}>
      {children}
    </CodePre>
  ),
  table: ({ children }) => <MarkdownTable>{children}</MarkdownTable>,
  th: ({ children }) => (
    <th className="mono border-b border-edge pb-3 pr-6 text-xs uppercase tracking-[0.18em] text-clay">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b border-edge py-3 pr-6 align-top leading-[1.6] text-bone/85">{children}</td>
  ),
  hr: MarkdownRule,
  p: ({ children }) => <Para>{children}</Para>,
  li: ({ children, className }) => <Item className={className}>{children}</Item>,
};

/*
 * The reading column's type. One body size, inherited by p, li, blockquote
 * and td; headings step up from it. The size and the measure are the
 * reader's (`--note-scale`, `--note-measure`, set by the reading tools) with
 * the house values as their defaults; see Reader.module.css `.prose`.
 */
export const PROSE = [
  "prose prose-invert mx-auto mt-section-sm",
  styles.prose,
  "text-bone/85",
  "prose-h1:mt-14 prose-h1:mb-4 prose-h1:text-[1.9rem] prose-h1:leading-[1.05] prose-h1:text-bone sm:prose-h1:text-[2.35rem]",
  "prose-h2:mt-14 prose-h2:mb-4 prose-h2:text-[1.6rem] prose-h2:leading-[1.1] prose-h2:text-bone sm:prose-h2:text-[2rem]",
  "prose-h3:mt-10 prose-h3:mb-3 prose-h3:text-[1.3rem] prose-h3:leading-[1.2] prose-h3:text-bone sm:prose-h3:text-[1.5rem]",
  "prose-h4:mt-8 prose-h4:mb-2 prose-h4:text-[1.1875rem] prose-h4:leading-[1.3] prose-h4:text-bone sm:prose-h4:text-[1.3125rem]",
  "prose-h5:mt-8 prose-h5:mb-2 prose-h5:font-sans prose-h5:italic prose-h5:font-normal",
  "prose-h5:text-[1.1875rem] prose-h5:leading-[1.35] prose-h5:tracking-[0] prose-h5:text-bone sm:prose-h5:text-[1.375rem]",
  "prose-h6:mt-8 prose-h6:mb-2 prose-h6:text-[1.0625rem] prose-h6:leading-[1.4] prose-h6:uppercase prose-h6:tracking-[0.1em] prose-h6:text-clay sm:prose-h6:text-[1.1875rem]",
  "prose-li:marker:text-clay",
  "prose-strong:text-bone prose-strong:font-medium",
  "prose-a:text-bone prose-a:underline prose-a:decoration-bone/40 prose-a:decoration-1 prose-a:underline-offset-[0.22em]",
  "hover:prose-a:decoration-bone hover:prose-a:decoration-2",
  "prose-blockquote:my-10 prose-blockquote:not-italic prose-blockquote:font-normal",
  "prose-blockquote:rounded-[var(--r-lg)] prose-blockquote:border prose-blockquote:border-l prose-blockquote:border-ridge prose-blockquote:border-l-ridge",
  "prose-blockquote:bg-sheet/60 prose-blockquote:px-6 prose-blockquote:py-5",
  "prose-blockquote:text-bone",
  "[&_blockquote_p:first-of-type]:before:content-none [&_blockquote_p:last-of-type]:after:content-none",
  "prose-code:font-code",
  "prose-code:rounded-[var(--r-sm)] prose-code:border prose-code:border-ridge prose-code:bg-sheet/60",
  "prose-code:px-[0.35em] prose-code:py-[0.12em] prose-code:font-normal prose-code:text-bone",
  "prose-code:before:content-none prose-code:after:content-none prose-code:[overflow-wrap:anywhere]",
].join(" ");

const REMARK = [remarkGfm, remarkWikilinks];

export default function NoteMarkdown({
  body,
  pen = true,
  className = "",
}: {
  body: string;
  pen?: boolean;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [figures, setFigures] = useState<Figure[]>([]);
  const [index, setIndex] = useState<number | null>(null);

  /* Nothing is highlighted on the first paint; the pipeline arrives later. */
  const highlight = useCodeHighlight(body);
  /* Heading ids first, then the frames, so the highlighter sees neither a
     heading without an id nor an svg fence. */
  const rehype = useMemo(() => [rehypeHeadingIds, rehypeCodeFrames, ...(highlight ?? [])], [highlight]);

  const open = useCallback<Opener>((el) => {
    if (!root.current) return;
    const { list, nodes } = figuresIn(root.current);
    setFigures(list);
    setIndex(Math.max(0, nodes.indexOf(el)));
  }, []);

  return (
    <div className="sm:[container-type:inline-size]" ref={root}>
      <div className={`${PROSE} ${className}`}>
        <PenContext.Provider value={pen}>
          <FigureContext.Provider value={open}>
            <ReactMarkdown remarkPlugins={REMARK} rehypePlugins={rehype} components={markdown}>
              {body}
            </ReactMarkdown>
          </FigureContext.Provider>
        </PenContext.Provider>
      </div>
      <Lightbox figures={figures} index={index} onIndex={setIndex} onClose={() => setIndex(null)} />
    </div>
  );
}
