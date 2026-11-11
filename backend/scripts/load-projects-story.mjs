#!/usr/bin/env node
/*
 * Loads the two projects added on 2026-11-04 (this site and oci-free), their
 * pictures, and the Hebrew of projects, the story and the site copy into the
 * running content store, through the admin API.
 *
 *   CONTENT_API_BASE=https://yehudabriskman.com \
 *   CONTENT_ADMIN_TOKEN=... \
 *   node backend/scripts/load-projects-story.mjs            # dry run: says what it would do
 *   node backend/scripts/load-projects-story.mjs --apply    # does it
 *
 * Environment: the same as import-media.mjs (CONTENT_API_BASE,
 * CONTENT_ADMIN_TOKEN, CONTENT_ADMIN_LOGIN, CONTENT_ADMIN_COOKIE), or
 * CONTENT_ADMIN_BEARER for a write-scoped API token. https, or loopback.
 *
 * WHERE THE WORDS COME FROM
 * -------------------------
 * `backend/src/content/seed.ts`: the seed the web suite generates from
 * web/src/data/*.ts (projects.ts, story.ts, site.ts and hebrew.ts), so the
 * loader, the seed and the site's offline fallback are the same bytes, and a
 * suite holds them to each other. Nothing is typed twice.
 *
 * WHAT IT DOES, IN ORDER
 * ----------------------
 *   1. Pictures. Each new project's cover (web/public/projects/<name>.jpg) is
 *      uploaded to the media library unless a file of that name is already
 *      there, then its Hebrew alt and caption are set with PUT /media/:id.
 *   2. projects, story, site-copy, in that order: the story's pictures may
 *      only name beats that exist, and a project's beat exists once the
 *      project table that holds it is published. For each, onto the
 *      document's draft if it has one, else onto what is published:
 *        - a project the store does not have is added, whole, with its cover
 *          pointed at the library;
 *        - a missing Hebrew is filled in, but only where the store's English
 *          is still the English the Hebrew was written against. An English
 *          line the owner has since edited keeps no Hebrew rather than a
 *          stale one, and Hebrew already there is never touched;
 *        - the story gets a picture for a new project's beat, if that beat
 *          has none: the project's own cover;
 *        - everything else (story.images, layouts, interludes, order, any
 *          project the seed does not know) is carried over exactly.
 *   3. Publishes the result (POST /content/<key>/publish), unless the
 *      document has a pending draft: a publish would replace it, so the
 *      result is saved as that draft instead, and the run says so.
 *
 * Dry run unless `--apply`. Idempotent: a second run uploads nothing and
 * finds nothing to change.
 */
import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(HERE, "../../web/public");
const SEED = resolve(HERE, "../src/content/seed.ts");

/** In the order they are written: projects before the story that names them. */
export const KEYS = ["projects", "story", "site-copy"];
const FIELD = { projects: "projects", story: "story", "site-copy": "siteCopy" };

/** The projects this run adds, and the cover each one is shown with. */
export const NEW_PROJECTS = {
  "portfolio-site": "portfolio_site.jpg",
  "oci-free": "oci_free.jpg",
};

/*
 * The covers' words in the library. The alt says what is in the picture;
 * the caption names it. Both languages, because the library holds both.
 */
export const PICTURES = {
  "portfolio_site.jpg": {
    alt: "The home page of yehudabriskman.com: PORTFOLIO in large black capitals on a cream page, the name and \"full-stack, mostly frontend\" beneath, and a cut-out photograph of Yehuda in sunglasses below them.",
    caption: "yehudabriskman.com, the live home page.",
    credit: "",
    he: {
      alt: "עמוד הבית של yehudabriskman.com: המילה PORTFOLIO באותיות שחורות גדולות על רקע שמנת, השם ו־\"full-stack, mostly frontend\" מתחתיה, ותצלום גזור של יהודה במשקפי שמש מתחת להם.",
      caption: "yehudabriskman.com, עמוד הבית כפי שהוא באוויר.",
    },
  },
  "oci_free.jpg": {
    alt: "A diagram of oci-free: the repository's Terraform and manifests, and the site's CI, feed one Ampere A1 ARM instance on Oracle Cloud's Always Free tier. It runs k3s with Traefik in front, and three namespaces: prod, preprod and monitoring.",
    caption: "oci-free: one Always Free ARM node, written as code.",
    credit: "",
    he: {
      alt: "תרשים של oci-free: ה־Terraform וה־manifests שבמאגר, וה־CI של האתר, מזינים מכונת Ampere A1 ARM אחת בשכבת Always Free של Oracle Cloud. היא מריצה k3s עם Traefik בכניסה, ושלושה namespaces: ‏prod,‏ preprod ו־monitoring.",
      caption: "oci-free: שרת ARM חינמי אחד, כתוב כקוד.",
    },
  },
};

/** The seed bundle, read from the generated file without running it. */
export function readPayload(file = SEED) {
  const src = readFileSync(file, "utf8");
  const at = src.indexOf("= {");
  const end = src.lastIndexOf("};");
  if (at < 0 || end < 0) throw new Error(`${file}: not the generated seed`);
  return JSON.parse(src.slice(at + 2, end + 1));
}

const isText = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v) && typeof v.en === "string";

/**
 * English → Hebrew, from every `Text` in the seed that has both. An English
 * line translated two different ways is left out: which one is meant is not
 * something the loader can tell.
 */
export function hebrewIndex(seedDoc) {
  const seen = new Map();
  const clash = new Set();
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    if (isText(v)) {
      if (!v.he) return;
      const was = seen.get(v.en);
      if (was !== undefined && was !== v.he) clash.add(v.en);
      seen.set(v.en, v.he);
      return;
    }
    Object.values(v).forEach(walk);
  };
  walk(seedDoc);
  for (const en of clash) seen.delete(en);
  return seen;
}

/**
 * The document with each missing Hebrew filled in from `index`, and the dotted
 * path of every one filled. Never changes an English, never replaces a Hebrew,
 * never mutates its input. `{en, he}` pairs that are not `Text` (an
 * interlude's words, which always hold both) are passed through as they are.
 */
export function fillHebrew(doc, index) {
  const filled = [];
  const walk = (v, path) => {
    if (Array.isArray(v)) return v.map((x, i) => walk(x, path ? `${path}.${i}` : String(i)));
    if (!v || typeof v !== "object") return v;
    if (isText(v)) {
      if (v.he) return v;
      const he = index.get(v.en);
      if (!he) return v;
      filled.push(path);
      return { ...v, he };
    }
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, path ? `${path}.${k}` : k)]));
  };
  return { next: walk(doc, ""), filled };
}

/**
 * One document, merged: `current` is the store's (draft ?? published),
 * `payload` the seed bundle, `library` file name → URL. Returns the next
 * document and what changed, in words.
 *
 * `livePublished` (story only) is the set of project slugs the published
 * project table will hold once this run's projects step is done; a picture
 * for a beat outside it would be refused on publish, so it is not added.
 */
export function mergeKey(key, current, payload, library, livePublished = null) {
  const seedDoc = payload[FIELD[key]];
  const changes = [];
  let next = structuredClone(current);

  if (key === "projects") {
    const have = new Set(next.items.map((p) => p.slug));
    for (const [slug, file] of Object.entries(NEW_PROJECTS)) {
      if (have.has(slug)) continue;
      const seedProject = seedDoc.items.find((p) => p.slug === slug);
      if (!seedProject) throw new Error(`the seed has no project "${slug}"; run the web suite with UPDATE_SEED=1`);
      const image = library.get(file) ?? seedProject.image;
      next.items.push({ ...structuredClone(seedProject), image });
      changes.push(`+ project ${slug} (cover ${image})`);
    }
  }

  if (key === "story") {
    const slugs = livePublished ?? new Set(Object.keys(NEW_PROJECTS));
    for (const [slug, file] of Object.entries(NEW_PROJECTS)) {
      if (next.images[slug]) continue;
      const src = library.get(file);
      if (!src || !/^(\/|https:\/\/)/.test(src)) continue;
      if (!slugs.has(slug)) {
        changes.push(`! no picture for beat ${slug}: its project is not published yet`);
        continue;
      }
      const words = PICTURES[file];
      next.images = { ...next.images, [slug]: { src, alt: { en: words.alt, he: words.he.alt } } };
      changes.push(`+ picture for beat ${slug}`);
    }
  }

  const { next: filledDoc, filled } = fillHebrew(next, hebrewIndex(seedDoc));
  next = filledDoc;
  if (filled.length) changes.push(`~ Hebrew filled in at ${filled.length} place(s): ${filled.slice(0, 6).join(", ")}${filled.length > 6 ? ", …" : ""}`);

  return { next, changes: changes.filter((c) => !c.startsWith("!")), notes: changes.filter((c) => c.startsWith("!")) };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const APPLY = args.has("--apply");
  for (const a of args) {
    if (a !== "--apply") {
      console.error(`unknown argument ${a}. Usage: load-projects-story.mjs [--apply]`);
      process.exit(2);
    }
  }
  const BASE = (process.env.CONTENT_API_BASE ?? "").replace(/\/+$/, "");
  const TOKEN = process.env.CONTENT_ADMIN_TOKEN ?? "";
  const BEARER = process.env.CONTENT_ADMIN_BEARER ?? "";
  const LOGIN = process.env.CONTENT_ADMIN_LOGIN ?? "YehudaBriskman";
  const COOKIE = process.env.CONTENT_ADMIN_COOKIE ?? "";
  if (!BASE || (!TOKEN && !BEARER)) {
    console.error("CONTENT_API_BASE and CONTENT_ADMIN_TOKEN (or CONTENT_ADMIN_BEARER) are required (see the header of this script).");
    process.exit(2);
  }
  const baseUrl = new URL(BASE);
  if (baseUrl.protocol !== "https:" && !["127.0.0.1", "localhost", "[::1]", "::1"].includes(baseUrl.hostname)) {
    console.error(`refusing plain ${baseUrl.protocol} to ${baseUrl.hostname}: the admin token would travel unencrypted`);
    process.exit(2);
  }
  const auth = BEARER
    ? { Authorization: `Bearer ${BEARER}` }
    : { "X-Admin-Proxy-Secret": TOKEN, "X-Auth-Request-User": LOGIN, ...(COOKIE ? { Cookie: COOKIE } : {}) };

  const ORIGIN = baseUrl.origin;
  const PREFIX = `${baseUrl.pathname.replace(/\/+$/, "")}/api/admin`;
  async function api(method, path, body, type) {
    const url = new URL(`${PREFIX}${path}`, ORIGIN);
    if (url.origin !== ORIGIN) throw new Error(`refusing a request off ${ORIGIN}: ${url.origin}`);
    const res = await fetch(url, {
      method,
      headers: { ...auth, Accept: "application/json", ...(type ? { "Content-Type": type } : {}) },
      body,
      redirect: "manual",
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    if (!res.ok || !json?.ok) {
      const why = json?.error ?? (res.status >= 300 && res.status < 400 ? "redirected (an SSO login page?)" : text.slice(0, 120));
      const detail = json?.issues ? ` ${JSON.stringify(json.issues).slice(0, 400)}` : "";
      throw new Error(`${method} ${path}: ${res.status} ${why}${detail}`);
    }
    return json;
  }
  /** A cover from web/public, sent to the validated ORIGIN: the intended file-to-network flow. */
  function upload(path, file) {
    const bytes = readFileSync(file);
    // codeql[js/file-access-to-http] Intended: an owner-run loader uploading the site's own project covers to the https/loopback origin validated from CONTENT_API_BASE.
    return api("POST", path, bytes, "image/jpeg");
  }
  const json = (method, path, body) => api(method, path, JSON.stringify(body), "application/json");

  const payload = readPayload();
  console.log(`${APPLY ? "APPLY" : "dry run"} against ${BASE}\n\nPictures:`);

  /* 1. Pictures. */
  const { items } = await api("GET", "/media");
  const library = new Map(items.filter((i) => i.kind === undefined || i.kind === "image").map((i) => [i.name, i.url]));
  for (const [name, words] of Object.entries(PICTURES)) {
    if (library.has(name)) {
      console.log(`  = ${name}  already in the library: ${library.get(name)}`);
      continue;
    }
    const file = join(PUBLIC, "projects", name);
    console.log(`  + ${name}  ${(statSync(file).size / 1024).toFixed(0)} KB, with its alt and caption in both languages`);
    if (!APPLY) {
      library.set(name, `<library URL of ${name}>`);
      continue;
    }
    const qs = new URLSearchParams({ alt: words.alt, caption: words.caption, credit: words.credit, filename: name });
    const up = await upload(`/media?${qs}`, file);
    const put = await json("PUT", `/media/${encodeURIComponent(up.item.id)}`, {
      alt: words.alt,
      caption: words.caption,
      credit: words.credit,
      he: words.he,
      _rev: up.item._rev,
    });
    console.log(`      -> ${put.item.id}  ${put.item.url}`);
    library.set(name, put.item.url);
  }

  /* 2 and 3. The documents, in order. */
  console.log("\nContent:");
  let publishedSlugs = null;
  const pending = [];
  for (const key of KEYS) {
    const doc = await api("GET", `/content/${key}`);
    const current = doc.draft ?? doc.published;
    const { next, changes, notes } = mergeKey(key, current, payload, library, key === "story" ? publishedSlugs : null);
    for (const n of notes) console.log(`  ${n}`);
    if (key === "projects") {
      /* What the published table will hold after this step: the new slugs
         only if this step publishes, else whatever is published now. */
      const willPublish = changes.length > 0 && !doc.draft;
      publishedSlugs = new Set((willPublish ? next : doc.published).items.map((p) => p.slug));
    }
    if (changes.length === 0) {
      console.log(`  = ${key}  nothing to change${doc.draft ? " (it has a draft pending)" : ""}`);
      continue;
    }
    const how = doc.draft ? "saved into its pending draft (publishing would replace that draft)" : "published";
    console.log(`  ~ ${key}  ${how}:`);
    for (const c of changes) console.log(`      ${c}`);
    if (!APPLY) continue;
    const body = { data: next, ...(doc._rev ? { _rev: doc._rev } : {}) };
    if (doc.draft) {
      await json("PUT", `/content/${key}/draft`, body);
      pending.push(key);
    } else {
      await json("POST", `/content/${key}/publish`, body);
    }
  }
  if (!APPLY) console.log("\nNothing was written; run with --apply to upload and publish.");
  else if (pending.length) console.log(`\nDone. ${pending.join(", ")} had a draft pending, so the change is in that draft: review and publish it in the admin.`);
  else console.log("\nDone: published.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
