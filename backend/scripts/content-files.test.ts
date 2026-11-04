/*
 * Every reviewed draft in backend/content/ must be something the API would
 * accept, and must still say only what was reviewed.
 *
 * Two layers. The write schemas (`PostWrite`, `CollectionWrite`) are what
 * `PUT /api/admin/...` parses, so a file that fails here would be refused at
 * import time. The stored schemas (`PostSchema`, `CollectionSchema`) are what
 * the route checks again after building the document, so the drafts are run
 * through the same build here. Then a handful of house rules the schemas do
 * not know about: the file name is the slug, the area exists, the reading
 * time the header claims is the one the API will compute, and nothing that
 * reads like an address, a host or a private name has crept in.
 */
import { describe, expect, it } from "vitest";
import {
  areaSlugFromFile,
  loadContent,
  noteSlugFromFile,
  toCollectionHebrew,
  toCollectionWrite,
  toPostHebrew,
  toPostWrite,
  wordCount,
} from "./content-files.mjs";
import {
  CollectionHebrewSchema,
  CollectionSchema,
  PostHebrewSchema,
  PostSchema,
  readingMinutes,
} from "../src/schemas/content.js";
import { CollectionWrite, PostWrite } from "../src/routes/admin.route.js";
import { lintHebrew } from "../src/i18n/glossary.js";

const { areas, posts, orphanHebrew } = loadContent();
const NOW = "2026-11-03T00:00:00.000Z";
const areaSlugs = new Set(areas.map((a) => a.data.slug));

/*
 * Things that must never appear in public notes. Generic patterns, not a
 * list of the actual private values: a list of those would publish them.
 */
const FORBIDDEN: [string, RegExp][] = [
  ["an IPv4 address", /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/],
  ["a host:port", /\b(?:localhost|127\.0\.0\.1|[a-z0-9-]+\.(?:local|lan|internal|test)):\d+/i],
  ["a bare :port reference", /(?:^|[\s(`]):\d{2,5}\b/],
  ["a tailnet name", /\.ts\.net\b|\btailnet\b|\btailscale\b/i],
  ["a private network range note", /\b(?:10|172|192)\.\d+\.\d+\.\d+\/\d+\b/],
  ["a credential-shaped string", /\b(?:ghp|gho|github_pat|sk|xox[bap])_[A-Za-z0-9]{10,}/],
  ["a bot signature", /Claude-Bot|on behalf of @/i],
  /*
   * The owner's current employer is not named anywhere on the site, in
   * either language. Former employers are fine; these words are not.
   */
  ["the current employer", /\bIDF\b|\barmy\b|\bmilitary\b|צה["״]ל|צבא/i],
];

const HEBREW_LETTER = /[א-ת]/;

/** Every Hebrew string must pass the glossary's lint (prefixes, maqaf, forbidden transliterations). */
function expectCleanHebrew(where: string, text: string) {
  const issues = lintHebrew(text);
  expect(issues, `${where}: ${JSON.stringify(issues)}`).toEqual([]);
}

describe("content drafts: areas", () => {
  it("has the four areas the notes are filed under", () => {
    expect([...areaSlugs].sort()).toEqual(["bothy", "oci-free", "site", "windom"]);
  });

  it("every Hebrew file belongs to a note", () => {
    expect(orphanHebrew).toEqual([]);
  });

  for (const { file, data } of areas) {
    describe(areaSlugFromFile(file), () => {
      it("is named after its slug", () => {
        expect(data.slug).toBe(areaSlugFromFile(file));
      });

      it("is accepted by PUT /api/admin/collections/:slug", () => {
        const parsed = CollectionWrite.safeParse(toCollectionWrite(data));
        expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      });

      it("builds a document the stored schema accepts", () => {
        const doc = { ...toCollectionWrite(data), type: "collection", stats: null, createdAt: NOW, updatedAt: NOW };
        const parsed = CollectionSchema.safeParse(doc);
        expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      });

      it("has a cover that is a raw file URL or none", () => {
        // The live WindoM area once pointed at a `/blob/` page, which is HTML
        // and renders as a broken image.
        if (data.coverImage === null) return;
        expect(data.coverImage).toMatch(/^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\//);
        expect(data.coverImage).not.toContain("/blob/");
      });

      it("opts in only to presentable docs", () => {
        for (const p of data.repo?.docPaths ?? []) {
          expect(p.split("/")).not.toContain("..");
          // Operational history and internal plans stay in the repo, unlinked.
          expect(p).not.toMatch(/(^|\/)(kb|plans|host)\//);
          expect(p).toMatch(/\.md$/);
        }
      });

      it("has Hebrew the API accepts, one label per link", () => {
        const { he, linkLabels } = toCollectionHebrew(data);
        expect(he, "the area has no Hebrew").not.toBeNull();
        expect(CollectionHebrewSchema.safeParse(he).success).toBe(true);
        expect(data.he?.linkLabels?.length ?? 0).toBeLessThanOrEqual(data.links.length);
        for (const [i, label] of linkLabels.entries()) {
          expect(label, `link ${i} has no Hebrew label`).toBeTruthy();
          expect(label!.length).toBeLessThanOrEqual(60);
        }
        for (const [k, v] of Object.entries({ ...he, ...linkLabels })) {
          if (typeof v !== "string") continue;
          // A title may be a product name kept in Latin (Bothy, WindoM); the prose may not.
          if (k === "tagline" || k === "description") expect(v).toMatch(HEBREW_LETTER);
          expectCleanHebrew(`${file} ${k}`, v);
        }
      });

      it("says nothing that reads like an address, a host or a secret", () => {
        const text = JSON.stringify(data);
        for (const [what, re] of FORBIDDEN) {
          expect(re.test(text), `${file} contains ${what}: ${text.match(re)?.[0]}`).toBe(false);
        }
      });

      it("a project links its repository", () => {
        if (data.kind !== "project") return;
        expect(data.repo).not.toBeNull();
        expect(data.links.some((l) => l.url === `https://github.com/${data.repo!.owner}/${data.repo!.name}`)).toBe(true);
      });
    });
  }
});

describe("content drafts: notes", () => {
  it("has notes, each with a unique slug", () => {
    expect(posts.length).toBeGreaterThan(0);
    const slugs = posts.map((p) => p.meta.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("features at most three notes, each rank used once", () => {
    const ranks = posts.map((p) => p.meta.featured).filter((f) => f !== null);
    expect(ranks.length).toBeLessThanOrEqual(3);
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  for (const post of posts) {
    const { file, folder, meta, body } = post;
    describe(noteSlugFromFile(file), () => {
      it("is named after its slug and filed under its area", () => {
        expect(meta.slug).toBe(noteSlugFromFile(file));
        expect(meta.collection).toBe(folder);
        expect(areaSlugs.has(meta.collection)).toBe(true);
      });

      it("is accepted by PUT /api/admin/posts/:slug", () => {
        const parsed = PostWrite.safeParse(toPostWrite(post));
        expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      });

      it("builds a document the stored schema accepts", () => {
        const doc = {
          ...toPostWrite(post),
          type: "post",
          bodyFormat: "markdown",
          source: "authored",
          createdAt: NOW,
          updatedAt: NOW,
          readingMinutes: readingMinutes(body),
        };
        const parsed = PostSchema.safeParse(doc);
        expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      });

      it("claims the reading time the API will compute", () => {
        expect(meta.readingMinutes).toBe(readingMinutes(body));
      });

      it("is dated and published, with an excerpt and a subtitle", () => {
        expect(meta.status).toBe("published");
        expect(meta.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
        expect(meta.excerpt.length).toBeGreaterThan(40);
        expect(meta.subtitle).toBeTruthy();
      });

      it("is a short note, not a stub and not an essay", () => {
        const words = wordCount(body);
        expect(words).toBeGreaterThanOrEqual(150);
        expect(words).toBeLessThanOrEqual(700);
      });

      it("cites at least one public source", () => {
        expect(meta.sources.length).toBeGreaterThan(0);
        for (const s of meta.sources) expect(s.url).toMatch(/^https:\/\/(github\.com\/YehudaBriskman\/|windom\.app)/);
      });

      it("says nothing that reads like an address, a host or a secret", () => {
        const text = `${JSON.stringify(meta)}\n${body}`;
        for (const [what, re] of FORBIDDEN) {
          expect(re.test(text), `${file} contains ${what}: ${text.match(re)?.[0]}`).toBe(false);
        }
      });

      describe("in Hebrew", () => {
        it("has a Hebrew file with a title, an excerpt and a body", () => {
          expect(post.he, `${file} has no .he.md beside it`).not.toBeNull();
          const { meta: he, body: heBody } = post.he!;
          expect(he.title).toMatch(HEBREW_LETTER);
          expect(he.excerpt).toMatch(HEBREW_LETTER);
          expect(he.excerpt.length).toBeLessThanOrEqual(320);
          expect(heBody).toMatch(HEBREW_LETTER);
        });

        it("labels no more links than the note has, each short enough", () => {
          const labels = post.he?.meta.linkLabels ?? [];
          expect(labels.length).toBeLessThanOrEqual(meta.links.length);
          for (const l of labels) expect(l.length).toBeLessThanOrEqual(60);
        });

        it("is a block the API accepts", () => {
          const parsed = PostHebrewSchema.safeParse(toPostHebrew(post));
          expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
        });

        it("follows the glossary's rules", () => {
          const block = toPostHebrew(post) ?? {};
          for (const [k, v] of Object.entries(block)) expectCleanHebrew(`${file} ${k}`, String(v));
        });

        it("says nothing that reads like an address, a host or a secret", () => {
          const text = `${JSON.stringify(post.he?.meta)}\n${post.he?.body}`;
          for (const [what, re] of FORBIDDEN) {
            expect(re.test(text), `${file} (Hebrew) contains ${what}: ${text.match(re)?.[0]}`).toBe(false);
          }
        });
      });
    });
  }
});
