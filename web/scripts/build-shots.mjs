#!/usr/bin/env node
/*
 * Project screenshots — every size and format a card can ask for.
 *
 * WHY THIS EXISTS
 *
 * The ladder these images were offered on had two rungs, `-card.jpg` at 800w
 * and the original at 1600w, under `sizes="(min-width: 640px) 50vw, 100vw"`.
 * A 390px phone at DPR 3 needs 1170px of pixels, so the browser correctly
 * took the 1600w original — 133 KB of JPEG — and painted it into a card
 * 300 CSS px wide. Desktop, needing only 470 CSS px, took the 800w variant
 * and spent a third of that. Measured over /projects, a phone pulled 352 KB
 * of screenshots where a 1440px desktop pulled 215 KB.
 *
 * Two rungs could never fix that on their own, because the phone is not
 * asking for the wrong one: it is asking for the only one that is big enough.
 * So this adds the sizes in between — 400 and 1200 — and, far more
 * importantly, the formats. A 1600px AVIF of the heaviest screenshot in the
 * set is 82 KB against the JPEG's 133 KB at the same fidelity, and that
 * saving applies to the rung the phone was always going to pick.
 *
 * WHERE THIS RUNS
 *
 * On a developer machine. Never inside the Docker build — this is the same
 * bargain the retired `build-plates.mjs` struck and the reasoning has not
 * changed: the image is built for arm64, CI reaches arm64 through QEMU, and
 * an AV1 encode is the most CPU-hungry thing this project could ask for.
 * Asking for it fifteen times under emulation turns a two-minute image build
 * into most of an hour, and leaves ImageMagick and libaom inside a runtime
 * image that only has to serve files.
 *
 * So the output is committed. `public/projects/` is build product checked into
 * the repo, like the self-hosted fonts: pay once here, and the Dockerfile
 * stays a `vite build` and a `COPY`.
 *
 * WHY IMAGEMAGICK AND NOT A NODE LIBRARY
 *
 * Adding `sharp` would put a devDependency with prebuilt native binaries into
 * every `npm ci` — on CI and on every developer install — to serve a script
 * that runs when a screenshot changes, which is to say almost never. `magick`
 * and `avifenc` are already on the machine of anyone who would regenerate
 * these. Nothing is added to package.json but the script entry.
 *
 * WHAT IS SOURCE AND WHAT IS PRODUCT
 *
 * The 1600px `<name>.jpg` files are both. They are the masters every variant
 * below is cut from, and they are also the address the content store holds for
 * a project's cover, so they are never rewritten and never deleted. They
 * double as the top JPEG rung, which is why no `-1600.jpg` is produced: it
 * would be the same picture at the same width under a second name.
 *
 * Everything matching `<name>-<width>.{avif,webp,jpg}` is this script's, and
 * is wiped and rebuilt on every run so that a dropped width cannot leave an
 * orphan shipping forever. `<name>-card.jpg`, the old single middle rung, is
 * swept up by the same rule — `-800.jpg` is its replacement.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const DIR = path.join(REPO, "public", "projects");

/*
 * A master is a bare lowercase name: `windom.jpg`, never `windom-800.jpg`.
 * The same shape `projectImage.ts` matches on, so a file this script ignores
 * is a file the site will never try to offer variants of either.
 */
const MASTER = /^([a-z0-9_]+)\.jpg$/;

/** Anything this script owns, and therefore anything it may delete. */
const GENERATED = /^[a-z0-9_]+-(?:\d+|card)\.(?:avif|webp|jpg)$/;

/*
 * The masters are all 1600px wide and the site's ladder is written assuming
 * it. 400 is a DPR-1 phone and the narrow end of a two-up grid; 800 is the
 * desktop card; 1200 is the rung that a DPR-3 phone lands on instead of
 * reaching for the full-size file, which is where most of the saving is; 1600
 * is the detail page's hero, which renders around 1072 CSS px and was the one
 * place the original was genuinely the right file.
 */
const MASTER_WIDTH = 1600;
const WIDTHS = [400, 800, 1200, MASTER_WIDTH];

/*
 * Quality was chosen against the masters rather than against taste, and the
 * JPEG numbers are the ones already in the repo: the masters are Q82 4:2:0 and
 * the old `-card` files were Q78, so the new JPEG rungs are Q78 and a reader
 * who cannot read AVIF or WebP sees exactly what they saw before.
 *
 * AVIF qcolor 68 was picked by sweeping the noisiest screenshot in the set
 * (WindoM — a dense dark dashboard, and at 133 KB nearly three times the
 * weight of any other master). Against that master, q=55 cost 62 KB at a
 * DSSIM of 0.021, q=68 lands near 90 KB at 0.012, and q=80 spends 118 KB to
 * reach 0.008. The knee is around 68, and below about 60 the mid-grey panel
 * fills in the dashboard start to band. speed=4 is the knee of libaom's effort
 * curve; speed=0 spends minutes per image for single-digit percentages.
 *
 * WebP sits at 82 because WebP needs roughly that to match AVIF 68 on this
 * material — 0.0246 DSSIM at 81 KB — and it only has to serve the Safari
 * versions between 14 and 16.3 that read WebP but not AVIF.
 */
const AVIF_QUALITY = 68;
const AVIF_SPEED = 4;
const WEBP_QUALITY = 82;
const JPEG_QUALITY = 78;

/**
 * @param {string} file
 * @param {readonly string[]} args
 */
function run(file, args) {
  try {
    execFileSync(file, args, { stdio: ["ignore", "ignore", "pipe"] });
  } catch (error) {
    const detail =
      error instanceof Error && "stderr" in error && error.stderr
        ? String(error.stderr).trim()
        : error instanceof Error
          ? error.message
          : String(error);
    throw new Error(`${file} failed\n  ${args.join(" ")}\n  ${detail}`);
  }
}

/** @param {string} binary */
function requireBinary(binary) {
  try {
    execFileSync("sh", ["-c", `command -v ${binary}`], { stdio: "ignore" });
  } catch {
    throw new Error(
      `${binary} not found on PATH. This script runs on a developer machine, ` +
        `not in the Docker build — install ImageMagick (magick) and libavif ` +
        `(avifenc), then re-run.`,
    );
  }
}

/** @param {string} file */
function widthOf(file) {
  return Number(execFileSync("magick", ["identify", "-format", "%w", file]).toString().trim());
}

/** @param {string} file */
function sizeOf(file) {
  return statSync(file).size;
}

/** @param {number} bytes */
function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * The resampled frame every encoder for one width works from.
 *
 * Resizing once and encoding three times from that frame, rather than letting
 * each encoder scale for itself, keeps the AVIF, the WebP and the JPEG at a
 * width the same picture — three different Lanczos passes would otherwise put
 * three slightly different images behind one `<picture>`.
 *
 * @param {string} master
 * @param {number} width
 * @param {string} destination
 */
function resample(master, width, destination) {
  run("magick", [master, "-filter", "Lanczos", "-resize", `${width}x`, "-strip", destination]);
}

function main() {
  requireBinary("magick");
  requireBinary("avifenc");

  const masters = readdirSync(DIR)
    .map((name) => ({ name, match: MASTER.exec(name) }))
    .filter((entry) => entry.match)
    .map((entry) => ({ file: path.join(DIR, entry.name), slug: entry.match[1] }))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  if (masters.length === 0) throw new Error(`no master screenshots found in ${DIR}`);

  /* Checked rather than worked around. The widths above are written into
     `projectImage.ts` as a fixed ladder, so a master that cannot fill every
     rung would leave the site offering a file that is not there — and silently
     upscaling it instead would be worse, because nobody would notice. */
  for (const { file, slug } of masters) {
    const width = widthOf(file);
    if (width !== MASTER_WIDTH) {
      throw new Error(
        `${slug}.jpg is ${width}px wide; every master must be exactly ${MASTER_WIDTH}px.\n` +
          `  The ladder in src/lib/projectImage.ts is fixed, so a short master would ` +
          `point the browser at a rung that does not exist.`,
      );
    }
  }

  mkdirSync(DIR, { recursive: true });
  for (const name of readdirSync(DIR)) {
    if (GENERATED.test(name)) rmSync(path.join(DIR, name));
  }

  /** @type {Array<{ slug: string, width: number, ext: string, bytes: number }>} */
  const rows = [];

  for (const { file: master, slug } of masters) {
    rows.push({ slug, width: MASTER_WIDTH, ext: "jpg", bytes: sizeOf(master) });

    for (const width of WIDTHS) {
      const frame = width === MASTER_WIDTH ? master : path.join(DIR, `${slug}-${width}.jpg`);

      /* The JPEG rung and the frame the other two encoders read are the same
         file, so the resample happens once. At 1600 there is nothing to do:
         the master is already that frame and already that rung. */
      if (width !== MASTER_WIDTH) {
        resample(master, width, frame);
        run("magick", [
          frame,
          "-quality", String(JPEG_QUALITY),
          "-sampling-factor", "4:2:0",
          "-interlace", "JPEG",
          "-strip",
          frame,
        ]);
        rows.push({ slug, width, ext: "jpg", bytes: sizeOf(frame) });
      }

      const avif = path.join(DIR, `${slug}-${width}.avif`);
      run("avifenc", [
        "--qcolor", String(AVIF_QUALITY),
        "--speed", String(AVIF_SPEED),
        "--yuv", "420",
        /* 4:2:0 halves the chroma resolution, and a plain box downsample of it
           is what puts coloured fringes on the hard edges a screenshot is made
           almost entirely of. --sharpyuv does that downsample in linear light,
           which is the difference between a readable UI label and a smeared
           one. */
        "--sharpyuv",
        "--jobs", "all",
        frame,
        avif,
      ]);
      rows.push({ slug, width, ext: "avif", bytes: sizeOf(avif) });

      const webp = path.join(DIR, `${slug}-${width}.webp`);
      run("magick", [frame, "-quality", String(WEBP_QUALITY), "-define", "webp:method=6", "-strip", webp]);
      rows.push({ slug, width, ext: "webp", bytes: sizeOf(webp) });
    }
  }

  report(rows, masters.map((m) => m.slug));
}

/**
 * @param {Array<{ slug: string, width: number, ext: string, bytes: number }>} rows
 * @param {string[]} slugs
 */
function report(rows, slugs) {
  const exts = ["avif", "webp", "jpg"];
  const cell = (slug, width, ext) => {
    const row = rows.find((r) => r.slug === slug && r.width === width && r.ext === ext);
    return row ? kb(row.bytes) : "—";
  };

  const head = ["project", "width", ...exts].map((h) => h.padEnd(12)).join("");
  console.log(`\n  ${head}`);
  console.log(`  ${"-".repeat(head.trimEnd().length)}`);

  for (const slug of slugs) {
    for (const width of WIDTHS) {
      const cells = exts.map((ext) => cell(slug, width, ext).padEnd(12));
      console.log(`  ${slug.slice(0, 11).padEnd(12)}${String(width).padEnd(12)}${cells.join("")}`);
    }
  }

  const total = (ext) => rows.filter((r) => r.ext === ext).reduce((sum, r) => sum + r.bytes, 0);
  console.log("");
  for (const ext of exts) console.log(`  total ${ext.padEnd(6)} ${kb(total(ext))}`);
  console.log(`\n  ${readdirSync(DIR).length} files in public/projects/\n`);
}

try {
  main();
} catch (error) {
  console.error(`\nbuild-shots: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
