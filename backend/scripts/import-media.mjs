#!/usr/bin/env node
/*
 * Imports the site's content pictures from web/public into the media library
 * (#253), through the admin API.
 *
 *   CONTENT_API_BASE=http://localhost:8080 \
 *   CONTENT_ADMIN_TOKEN=... \
 *   node backend/scripts/import-media.mjs            # dry run: lists what it would upload
 *   node backend/scripts/import-media.mjs --apply    # uploads it
 *
 * Environment: the same as import-content.mjs (CONTENT_API_BASE,
 * CONTENT_ADMIN_TOKEN, CONTENT_ADMIN_LOGIN, CONTENT_ADMIN_COOKIE), or
 * CONTENT_ADMIN_BEARER for a write-scoped API token (#252) instead of the
 * proxy secret.
 *
 * What it imports: the content pictures, not the build's assets.
 *   - public/projects/<name>.jpg — each project screenshot's master only.
 *     The -400/-800/-1200/-1600 files beside it are variants the library
 *     makes again from the master, so they are not imported.
 *   - public/img/yehuda-cut.webp — the portrait (the -sm crop is a variant).
 *   - public/story/* — the story's pictures, when there are any.
 * Not: fonts, favicons, app icons, the OG cards. Those are part of the build.
 *
 * What it will and will not do:
 *   - Dry run unless `--apply` is given. The dry run reads, never writes.
 *   - Never deletes, never touches web/public. The static files stay where
 *     they are until the follow-up that switches references (after #163).
 *   - Idempotent: a picture whose file name is already in the library is
 *     skipped, so a second `--apply` uploads nothing.
 *   - Every upload goes through POST /api/admin/media, so it passes the same
 *     type allowlist, size cap and EXIF stripping as one from the admin.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(HERE, "../../web/public");

/*
 * Alt text is required by the library, and a file name is not alt text. Each
 * known picture carries the words it should have; a new file under
 * public/story/ without an entry here is reported and skipped, never
 * uploaded with a made-up description.
 */
export const MANIFEST = {
  "projects/windom.jpg": {
    alt: "WindoM's new-tab page: a large clock and a good-evening greeting over a photograph of the aurora above a lit cabin, with a row of shortcuts along the top.",
    caption: "WindoM, the Chrome extension.",
  },
  "projects/programing_with_yehuda.jpg": {
    alt: "The Programming with Yehuda site: a Hebrew title card over a photograph of Yehuda in a suit beside a waterfall, with a short introduction beside it.",
    caption: "Programming with Yehuda.",
  },
  "projects/icaros.jpg": {
    alt: "Icaros, a car-listing web app: its home page shows an orange sports car on a coastal highway under the line \"Our company will bring you luxury vehicles suitable for all driving situations\".",
    caption: "Icaros, a learning project.",
  },
  "img/yehuda-cut.webp": {
    alt: "Yehuda Briskman: a cut-out photograph from the waist up, in round sunglasses and a pale T-shirt, a bag strap across one shoulder, looking off to the side.",
    caption: "",
  },
};

const VARIANT = /-(?:\d{3,4}|sm|card)\.[a-z]+$/i;
const IMAGE = /\.(jpe?g|png|webp|avif|svg)$/i;

/** The content pictures under web/public, as paths relative to it. */
export function discover(root = PUBLIC) {
  const out = [];
  for (const dir of ["projects", "img", "story"]) {
    const abs = join(root, dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs).sort()) {
      if (!IMAGE.test(f) || VARIANT.test(f) || !statSync(join(abs, f)).isFile()) continue;
      out.push(`${dir}/${f}`);
    }
  }
  return out;
}

const TYPES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif", svg: "image/svg+xml" };

async function main() {
  const args = new Set(process.argv.slice(2));
  const APPLY = args.has("--apply");
  for (const a of args) {
    if (a !== "--apply") {
      console.error(`unknown argument ${a}. Usage: import-media.mjs [--apply]`);
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

  async function api(method, path, body, type) {
    const res = await fetch(`${BASE}/api/admin${path}`, {
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
      throw new Error(`${method} ${path}: ${res.status} ${why}`);
    }
    return json;
  }

  const found = discover();
  const { items } = await api("GET", "/media");
  const have = new Set(items.map((i) => i.name));
  console.log(`${APPLY ? "APPLY" : "dry run"} against ${BASE}: ${found.length} content pictures in web/public, ${items.length} in the library\n`);

  let uploaded = 0;
  let skipped = 0;
  let missing = 0;
  for (const rel of found) {
    const name = rel.split("/").pop();
    const meta = MANIFEST[rel];
    const size = statSync(join(PUBLIC, rel)).size;
    if (have.has(name)) {
      console.log(`  = ${rel}  already in the library`);
      skipped += 1;
      continue;
    }
    if (!meta) {
      console.log(`  ! ${rel}  no alt text in MANIFEST; add an entry, then run again`);
      missing += 1;
      continue;
    }
    console.log(`  + ${rel}  ${(size / 1024).toFixed(0)} KB  alt: "${meta.alt.slice(0, 70)}${meta.alt.length > 70 ? "..." : ""}"`);
    if (!APPLY) continue;
    const qs = new URLSearchParams({ alt: meta.alt, caption: meta.caption ?? "", credit: meta.credit ?? "", filename: name });
    const ext = name.split(".").pop().toLowerCase();
    const r = await api("POST", `/media?${qs}`, readFileSync(join(PUBLIC, rel)), TYPES[ext]);
    console.log(`      -> ${r.item.id}  ${r.item.url}`);
    uploaded += 1;
  }
  console.log(
    `\n${APPLY ? `${uploaded} uploaded` : `${found.length - skipped - missing} would be uploaded`}, ${skipped} already there, ${missing} need alt text.` +
      (APPLY ? "" : " Nothing was written; run with --apply to upload."),
  );
  if (missing > 0) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
