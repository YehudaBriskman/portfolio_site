import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useCodeHighlight } from "@/components/notes/CodeHighlight";

/*
 * The highlighter is loaded, configured and handed to unified at runtime, in
 * three steps that all fail silently by design — a mistake in any of them
 * leaves exactly the plain code blocks the site shipped before, which is
 * indistinguishable from "it has not finished loading yet". That is precisely
 * the kind of thing that needs a test rather than a look at the page.
 *
 * This one already earned itself: the attacher takes the highlighter as its
 * first argument and its options as the second, and passing them as a
 * two-element tuple threw inside unified on every post with code in it.
 */

const BODY = [
  "```bash",
  "docker compose up -d",
  "```",
  "",
  "```ts",
  "const x: number = 1;",
  "```",
  "",
  "```notalanguage",
  "whatever",
  "```",
].join("\n");

function Article({ body }: { body: string }) {
  const rehypePlugins = useCodeHighlight(body);
  return (
    <div data-testid="article">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={rehypePlugins}>
        {body}
      </ReactMarkdown>
    </div>
  );
}

describe("useCodeHighlight", () => {
  it("renders readable code before the highlighter exists, and colours it after", async () => {
    render(<Article body={BODY} />);
    const article = screen.getByTestId("article");

    // Nothing is highlighted on the first paint, and the code is still there.
    expect(article.querySelectorAll("pre.shiki")).toHaveLength(0);
    expect(article.textContent).toContain("docker compose up -d");

    await waitFor(() => expect(article.querySelectorAll("pre.shiki")).toHaveLength(3), {
      timeout: 15_000,
    });

    // --sodium on a reserved word, rather than whatever GitHub Dark would pick.
    // jsdom reports inline colours in rgb(), hence the form of this assertion.
    expect(article.innerHTML).toContain("rgb(232, 129, 74)");
    // A fence in a language nobody loaded still renders its text.
    expect(article.textContent).toContain("whatever");
    expect(article.textContent).toContain("const x: number = 1;");
  }, 20_000);

  it("stays out of the way of a post with no code in it", async () => {
    render(<Article body={"Just a paragraph, and `inline code` which is not a block."} />);
    const article = screen.getByTestId("article");
    await waitFor(() => expect(article.textContent).toContain("inline code"));
    expect(article.querySelectorAll("pre")).toHaveLength(0);
  });
});
