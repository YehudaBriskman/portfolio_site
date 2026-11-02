/* github/linguist's colours, for the languages this site's projects are in
   and a few neighbours. Anything else gets the soft ink: an unknown hue is
   better than a wrong one. */
const LANGUAGE: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Go: "#00add8",
  Python: "#3572a5",
  Rust: "#dea584",
  Java: "#b07219",
  Kotlin: "#a97bff",
  "C#": "#178600",
  "C++": "#f34b7d",
  C: "#555555",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#663399",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Dart: "#00b4ab",
  Swift: "#f05138",
  Ruby: "#701516",
  PHP: "#4f5d95",
  Dockerfile: "#384d54",
  HCL: "#844fba",
};

export function languageColour(lang: string | null | undefined): string | null {
  return lang ? (LANGUAGE[lang] ?? null) : null;
}
