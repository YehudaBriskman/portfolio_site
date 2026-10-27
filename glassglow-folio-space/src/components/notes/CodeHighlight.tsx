import { useEffect, useState, type ComponentProps } from "react";
import type ReactMarkdown from "react-markdown";
import type { HighlighterCore, LanguageRegistration, ThemeRegistrationRaw } from "shiki";

/*
 * Syntax highlighting for the article body.
 *
 * A blog whose whole subject is making software prove it still works had every
 * code sample rendered as one flat grey wall, which is the opposite of the
 * claim. Shiki does the colouring, but it is the single heaviest thing this
 * site could possibly load, so three decisions keep it off the critical path:
 *
 *  - `shiki/core` rather than the `shiki` bundle. The bundle registers all 200
 *    grammars and every bundled theme by name whether or not a page uses them.
 *  - the JavaScript regex engine rather than the oniguruma one, which saves
 *    shipping a ~500 KB WebAssembly module purely to run TextMate patterns.
 *  - one dynamic import per grammar, resolved from the fences actually present
 *    in this post. A post with one shell block downloads one shell grammar and
 *    nothing else, and nothing at all is in the entry chunk.
 *
 * It is also entirely optional. The hook returns nothing until the highlighter
 * is built, and returns nothing forever if any part of that fails, in which
 * case react-markdown renders the same readable plain-text block it always did.
 */

/*
 * A theme sampled from this site rather than borrowed from an editor.
 *
 * Shipping GitHub Dark would put a second, unrelated palette inside a page
 * built entirely out of one photograph's colours. Every value below is either
 * a token from index.css or a tint derived from the same sunset: sodium for
 * the words the language reserves, warm sand for literal text the author
 * wrote, pale water for the names they chose, and the haze tone for comments.
 *
 * Contrast was measured against --bitumen, the code block's ground: the
 * quietest colour here (comments, #7A8583) lands at 5.4:1 and every other
 * token is above 6.8:1, so no token in a code sample fails AA.
 */
const INK = {
  ground: "#0F1515", // --bitumen, so the theme's own background matches the well
  text: "#DCCCC2", // --bone
  muted: "#7A8583", // --haze-2
  punctuation: "#8C9794",
  keyword: "#E8814A", // --sodium
  string: "#E8C39E",
  number: "#D9A066",
  func: "#A8C8BD",
  type: "#9EBFC9",
  bad: "#E87A6C", // --destructive-ink
  good: "#9CBF9A",
} as const;

const SODIUM_DARK: ThemeRegistrationRaw = {
  name: "sodium-dark",
  type: "dark",
  colors: { "editor.background": INK.ground, "editor.foreground": INK.text },
  settings: [
    { settings: { background: INK.ground, foreground: INK.text } },
    { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: INK.muted, fontStyle: "italic" } },
    {
      scope: ["string", "string.quoted", "constant.other.symbol", "meta.embedded.assembly"],
      settings: { foreground: INK.string },
    },
    {
      scope: ["constant.numeric", "constant.language", "constant.character.escape", "keyword.other.unit"],
      settings: { foreground: INK.number },
    },
    {
      scope: ["keyword", "keyword.control", "storage", "storage.type", "storage.modifier", "entity.name.tag"],
      settings: { foreground: INK.keyword },
    },
    // Operators deliberately stay quiet. Colouring every `=` and `=>` turns a
    // function body into confetti and hides the words that actually branch.
    { scope: ["keyword.operator", "punctuation", "meta.brace"], settings: { foreground: INK.punctuation } },
    {
      scope: ["entity.name.function", "support.function", "meta.function-call", "variable.function"],
      settings: { foreground: INK.func },
    },
    {
      scope: [
        "entity.name.type",
        "entity.name.class",
        "entity.name.namespace",
        "entity.other.inherited-class",
        "support.type",
        "support.class",
        "support.type.property-name", // JSON and YAML keys
        "entity.other.attribute-name",
        "variable.other.enummember",
      ],
      settings: { foreground: INK.type },
    },
    { scope: ["variable", "variable.parameter", "meta.object-literal.key"], settings: { foreground: INK.text } },
    { scope: ["invalid", "markup.deleted", "punctuation.definition.deleted"], settings: { foreground: INK.bad } },
    { scope: ["markup.inserted", "punctuation.definition.inserted"], settings: { foreground: INK.good } },
    { scope: ["meta.diff.header", "markup.changed"], settings: { foreground: INK.type } },
    { scope: ["markup.bold"], settings: { fontStyle: "bold" } },
    { scope: ["markup.italic"], settings: { fontStyle: "italic" } },
  ],
};

/** The module shape every `@shikijs/langs/<id>` entry point exports. */
type GrammarModule = { default: LanguageRegistration[] };

/*
 * The grammars this blog is allowed to download, keyed by what an author can
 * type after the backticks.
 *
 * An allow-list rather than a lookup into the full set: a fence language comes
 * out of stored content, and turning arbitrary stored text into an import
 * specifier is how you end up fetching a chunk that does not exist on every
 * typo. Aliases are listed explicitly so `sh` and `yml` resolve without the
 * author having to know the grammar's canonical name.
 */
const GRAMMARS: Record<string, () => Promise<GrammarModule>> = {
  bash: () => import("@shikijs/langs/bash"),
  sh: () => import("@shikijs/langs/sh"),
  shell: () => import("@shikijs/langs/shell"),
  zsh: () => import("@shikijs/langs/zsh"),
  console: () => import("@shikijs/langs/console"),
  shellsession: () => import("@shikijs/langs/shellsession"),
  typescript: () => import("@shikijs/langs/typescript"),
  ts: () => import("@shikijs/langs/ts"),
  tsx: () => import("@shikijs/langs/tsx"),
  javascript: () => import("@shikijs/langs/javascript"),
  js: () => import("@shikijs/langs/js"),
  jsx: () => import("@shikijs/langs/jsx"),
  json: () => import("@shikijs/langs/json"),
  jsonc: () => import("@shikijs/langs/jsonc"),
  yaml: () => import("@shikijs/langs/yaml"),
  yml: () => import("@shikijs/langs/yml"),
  toml: () => import("@shikijs/langs/toml"),
  ini: () => import("@shikijs/langs/ini"),
  dockerfile: () => import("@shikijs/langs/dockerfile"),
  docker: () => import("@shikijs/langs/docker"),
  nginx: () => import("@shikijs/langs/nginx"),
  sql: () => import("@shikijs/langs/sql"),
  python: () => import("@shikijs/langs/python"),
  py: () => import("@shikijs/langs/py"),
  go: () => import("@shikijs/langs/go"),
  rust: () => import("@shikijs/langs/rust"),
  http: () => import("@shikijs/langs/http"),
  diff: () => import("@shikijs/langs/diff"),
  html: () => import("@shikijs/langs/html"),
  css: () => import("@shikijs/langs/css"),
  markdown: () => import("@shikijs/langs/markdown"),
  md: () => import("@shikijs/langs/md"),
  makefile: () => import("@shikijs/langs/makefile"),
  make: () => import("@shikijs/langs/make"),
};

/*
 * Which grammars this one post needs.
 *
 * Deliberately a scan of the raw markdown rather than a walk of the parsed
 * tree: it runs once per post, before anything is loaded, and a false positive
 * costs one unused grammar while a tree walk would cost a second parse of the
 * whole body on the main thread.
 */
const FENCE = /^[ \t]{0,3}(?:`{3,}|~{3,})[ \t]*([A-Za-z0-9_+#.-]+)/gm;

export function grammarsIn(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(FENCE)) {
    const lang = match[1]?.toLowerCase();
    if (lang && lang in GRAMMARS) found.add(lang);
  }
  return [...found];
}

/** react-markdown's own plugin list type, so this never has to name `unified`. */
type RehypePlugins = ComponentProps<typeof ReactMarkdown>["rehypePlugins"];

/**
 * Builds a rehype pipeline that colours the code blocks in `body`, or returns
 * `undefined` while it is still loading and if it never loads at all.
 */
export function useCodeHighlight(body: string | null): RehypePlugins {
  const [plugins, setPlugins] = useState<RehypePlugins>(undefined);

  useEffect(() => {
    setPlugins(undefined);
    if (!body) return;

    // A post with no fenced code never touches the network for any of this.
    const wanted = grammarsIn(body);
    if (wanted.length === 0) return;

    let alive = true;
    let built: HighlighterCore | null = null;

    void (async () => {
      try {
        const [core, engine, rehype] = await Promise.all([
          import("shiki/core"),
          import("shiki/engine/javascript"),
          import("@shikijs/rehype/core"),
        ]);
        const modules = await Promise.all(wanted.map((lang) => GRAMMARS[lang]()));

        const highlighter = await core.createHighlighterCore({
          themes: [SODIUM_DARK],
          langs: modules.flatMap((module) => module.default),
          /*
           * `forgiving` because the JS engine cannot express every pattern
           * oniguruma can. Without it one unsupported lookbehind anywhere in a
           * grammar throws and the whole post loses its colouring; with it the
           * offending rule is skipped and the other ninety-nine still run.
           */
          engine: engine.createJavaScriptRegexEngine({ forgiving: true }),
        });

        if (!alive) {
          highlighter.dispose();
          return;
        }
        built = highlighter;
        setPlugins([
          /*
           * Three entries, not two: unified spreads everything after the
           * attacher as its arguments, and this attacher takes the highlighter
           * first and its options second.
           */
          [
            rehype.default,
            highlighter,
            {
              theme: SODIUM_DARK.name,
              // A fence with no language, or one outside the allow-list above,
              // still gets the block's ground and spacing — just no colour.
              defaultLanguage: "text",
              fallbackLanguage: "text",
              // A single grammar that chokes on one sample must not take the
              // article down with it; that block renders plain instead.
              onError: () => undefined,
            },
          ],
        ]);
      } catch {
        // Highlighting is a finish, not a feature. Anything that goes wrong
        // here leaves the plain <pre> in place and says nothing to the reader.
      }
    })();

    return () => {
      alive = false;
      // Grammars are compiled regex tables and are not small; a reader moving
      // through six posts should not accumulate six highlighters.
      built?.dispose();
    };
  }, [body]);

  return plugins;
}
