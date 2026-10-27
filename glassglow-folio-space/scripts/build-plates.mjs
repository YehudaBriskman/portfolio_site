#!/usr/bin/env node
/*
 * Photographic plates — the four backdrops the interface sits on.
 *
 * WHERE THIS RUNS
 *
 * On a developer machine, or on an amd64 CI job. Never inside the Docker
 * build. The image is built for arm64 and CI reaches arm64 through QEMU, where
 * everything runs 5-20x slower than native; an AV1 encode is the single most
 * CPU-hungry thing this project could ask for, and asking for it twelve times
 * under emulation turns a two-minute image build into most of an hour. It also
 * puts ImageMagick, libaom and a 500KB pile of source photographs inside the
 * runtime image for no reason.
 *
 * So the output is committed. `public/plates/` is build product checked into
 * the repo, the same bargain as the self-hosted fonts: pay once here, and the
 * Dockerfile stays a `vite build` and a `COPY`.
 *
 * WHY IMAGEMAGICK AND NOT A NODE LIBRARY
 *
 * Reaching for `sharp` would add a devDependency with prebuilt native binaries
 * to `npm ci` — on every CI run and every developer install — to serve a script
 * that runs perhaps twice a year. `magick` and `avifenc` are already on the
 * machine of anyone who would regenerate these. Nothing is added to
 * package.json but the script entry.
 *
 * WHY THE SOURCES LIVE OUTSIDE THE REPO
 *
 * The four photographs are 525KB of input that must never reach a browser.
 * Committing them under `public/` would ship them; committing them elsewhere
 * would bloat the clone for a file nobody but this script opens. They stay in
 * the sibling repo they came from, and because the output is committed, no CI
 * job ever needs to find them. Override with PLATE_SRC_DIR.
 *
 * THE GRADE
 *
 * The sources are bright pastel stock: a pink dawn, white sun-glitter on water,
 * a violently green wisteria temple, an aurora. The palette they have to join
 * is the one at the top of src/index.css — dark teal-grey ground, #E8814A
 * sodium as the only accent — so each is pulled down and the colour drained out
 * of it, and then all four are passed through one shared tritone that puts
 * their shadows on the page ground and their highlights on the bone text
 * colour. The tritone is what makes them a set: four photographs that happen to
 * share a brightness are still four photographs, but four that share a floor
 * and a ceiling read as one descent through a day.
 *
 * Per-image numbers differ because the problems differ, not because they were
 * nudged until they looked nice. Each is annotated below.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const OUT_DIR = path.join(REPO, "public", "plates");

const SRC_DIR =
  process.env.PLATE_SRC_DIR ??
  path.resolve(REPO, "../../extentions/WindoM/site/public/images");

/*
 * Every plate is cut to 16:9 and the same pixel dimensions. The sources are
 * not: 1920x1080, 1920x1155, 1920x960, 1920x1281. Left alone, swapping plates
 * would reflow the page, and a single `aspect-ratio` in CSS could not describe
 * all four. Cover-crop from the centre — these are landscapes, the subject is
 * never in a corner.
 */
const ASPECT_W = 16;
const ASPECT_H = 9;

/* 800 for phones, 1200 for laptops, 1920 for everything above it. A 2560 tier
 * was considered and dropped: these sit behind glass and blur, and nobody has
 * ever caught a backdrop being upscaled 1.33x. */
const WIDTHS = [800, 1200, 1920];

/* The <img src> fallback only has to exist. Every browser that cannot read
 * either AVIF or WebP is old enough that it is not the one we are tuning for,
 * so this is deliberately cheap and deliberately offered at one size. */
const FALLBACK_WIDTH = 1200;

/*
 * AVIF q=64 / WebP q=78 were picked by sweeping both against the noisiest plate
 * in the set (afternoon — sun-glitter on rippled water is nearly incompressible
 * detail). Below q=58 the water develops visible blocking in the mid-greys;
 * above q=70 the file grows with nothing to show for it. speed=4 is the knee of
 * libaom's effort curve: speed=0 spends minutes per image to save single-digit
 * percentages.
 */
const AVIF_QUALITY = 64;
const AVIF_SPEED = 4;
const WEBP_QUALITY = 78;
const JPEG_QUALITY = 62;

/* Reported, not enforced — but if the AVIF set ever crosses this, the plates
 * have stopped being a backdrop and started being the page weight. */
const AVIF_BUDGET_BYTES = 900 * 1024;

/*
 * Shared finish, applied identically to all four.
 *
 * The chroma blur comes first and is the only per-image part of it: the sources
 * are already WebP, and lossy WebP stores colour at half resolution, so every
 * clipped highlight in them carries a ring of cyan and magenta that the grade
 * then amplifies. Blurring Cb/Cr in YCbCr removes the ring and leaves the
 * luma — the actual sparkle — untouched.
 *
 * Then a few percent of flat teal for atmosphere, and the tritone: black is
 * remapped to roughly the page ground and white to roughly the bone text
 * colour, so no plate ever contains a pure black that punches a hole in the
 * page or a pure white that outshines the type on top of it. The warm middle
 * survives it, which is why the sun, the glitter, the paper lamp and the cabin
 * windows all still read as the sodium accent.
 */
const FINISH_TINT = "#223033";

/** @typedef {{ source: string, modulate: string, chromaBlur: number, tint: number, floor: string, ceiling: string, note: string }} PlateGrade */

/** @type {Record<string, PlateGrade>} */
const PLATES = {
  /* A pink-and-lavender dawn, by far the brightest source and the only one
   * already carrying the accent — the sun's band in the cloud is close to
   * #E8814A once the pastel is taken out of it. Brightness 50 / saturation 72
   * is the grade that was verified against the palette; the rest of the set was
   * built to meet it. Lightest plate in the descent. */
  morning: {
    source: "day-morning.webp",
    modulate: "50,72,100",
    chromaBlur: 0.8,
    tint: 10,
    floor: "#101718",
    ceiling: "#D8CFC6",
    note: "dawn over still water — the opening plate, and the brightest",
  },

  /* Sun-glitter on open water. The hard case: the specular highlights are
   * blown, and any saturation left in them turns the whole surface into gold
   * glitter that fights the accent instead of being it. Saturation drops to 40
   * — much further than anything else here — and the chroma blur goes to 3.0 to
   * kill the fringing around several hundred individual sparkles. */
  afternoon: {
    source: "day-afternoon.webp",
    modulate: "46,40,100",
    chromaBlur: 3.0,
    tint: 12,
    floor: "#101718",
    ceiling: "#D2CAC2",
    note: "sun on water — saturation pushed hardest, the glitter demanded it",
  },

  /* A wisteria temple lit hard green, and the only plate needing a hue change
   * rather than a grade: nothing in the palette is green. +43 degrees carries
   * it from green into the haze teal (#7A8583 / #556262). Brightness goes *up*,
   * not down — this source is already dark, and the descent needs it above
   * night. Saturation 38 because a rotated hue at full strength looks dyed. */
  evening: {
    source: "day-evening.webp",
    modulate: "120,38,124",
    chromaBlur: 1.0,
    tint: 12,
    floor: "#0F1516",
    ceiling: "#CFC9C2",
    note: "wisteria at dusk — green rotated +43 degrees into the haze teal",
  },

  /* Aurora over a lit cabin: the source closest to the palette before anything
   * is done to it, teal sky against sodium windows. The hue nudge is small and
   * goes the other way (-5 degrees), pulling the sky off cyan and back toward
   * the teal the rest of the set settled on. Darkest plate, and the one with
   * the most concentrated accent. */
  night: {
    source: "day-night.webp",
    modulate: "52,66,97",
    chromaBlur: 1.0,
    tint: 8,
    floor: "#0E1415",
    ceiling: "#C8C3BE",
    note: "aurora over a lit cabin — darkest, and the purest sodium in the set",
  },
};

const STAGES = Object.keys(PLATES);

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

/**
 * The graded master, at full plate size, written once per stage and then only
 * resized. Grading at each width separately would give three slightly different
 * pictures, because resampling and the tone curve do not commute.
 *
 * @param {PlateGrade} grade
 * @param {string} destination
 */
function renderMaster(grade, destination) {
  const height = Math.round((WIDTHS.at(-1) / ASPECT_W) * ASPECT_H);
  const geometry = `${WIDTHS.at(-1)}x${height}`;

  run("magick", [
    path.join(SRC_DIR, grade.source),
    "-resize", `${geometry}^`,
    "-gravity", "center",
    "-extent", geometry,
    "-modulate", grade.modulate,
    "-colorspace", "YCbCr",
    "-channel", "GB",
    "-blur", `0x${grade.chromaBlur}`,
    "+channel",
    "-colorspace", "sRGB",
    "-fill", FINISH_TINT,
    "-colorize", String(grade.tint),
    "+level-colors", `${grade.floor},${grade.ceiling}`,
    "-strip",
    destination,
  ]);
}

/**
 * @param {string} master
 * @param {number} width
 * @param {string} destination
 */
function resample(master, width, destination) {
  run("magick", [
    master,
    "-filter", "Lanczos",
    "-resize", `${width}x`,
    "-strip",
    destination,
  ]);
}

/** @param {string} file */
function sizeOf(file) {
  return statSync(file).size;
}

/** @param {number} bytes */
function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function main() {
  requireBinary("magick");
  requireBinary("avifenc");

  try {
    statSync(SRC_DIR);
  } catch {
    throw new Error(
      `source images not found at ${SRC_DIR}\n` +
        `  These live outside the repo on purpose (see the header). Set ` +
        `PLATE_SRC_DIR to the directory holding day-{morning,afternoon,evening,night}.webp.`,
    );
  }

  /* Wiped rather than overwritten: a rename or a dropped width would otherwise
   * leave an orphan in public/plates/ that ships forever. */
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const scratch = mkdtempSync(path.join(tmpdir(), "plates-"));

  /** @type {Array<{ stage: string, width: number, ext: string, bytes: number }>} */
  const rows = [];

  try {
    for (const stage of STAGES) {
      const grade = PLATES[stage];
      const master = path.join(scratch, `${stage}-master.png`);
      renderMaster(grade, master);

      for (const width of WIDTHS) {
        const frame =
          width === WIDTHS.at(-1)
            ? master
            : path.join(scratch, `${stage}-${width}.png`);
        if (frame !== master) resample(master, width, frame);

        const avif = path.join(OUT_DIR, `plate-${stage}-${width}.avif`);
        run("avifenc", [
          "--qcolor", String(AVIF_QUALITY),
          "--speed", String(AVIF_SPEED),
          "--yuv", "420",
          /* 4:2:0 halves the chroma resolution, and a plain box downsample of
           * it is what puts coloured fringes on every hard highlight — the
           * exact artefact the chroma blur above exists to remove. --sharpyuv
           * downsamples in linear light instead, so the encoder does not hand
           * back the problem the grade just fixed. */
          "--sharpyuv",
          "--jobs", "all",
          frame,
          avif,
        ]);
        rows.push({ stage, width, ext: "avif", bytes: sizeOf(avif) });

        const webp = path.join(OUT_DIR, `plate-${stage}-${width}.webp`);
        run("magick", [
          frame,
          "-quality", String(WEBP_QUALITY),
          "-define", "webp:method=6",
          "-strip",
          webp,
        ]);
        rows.push({ stage, width, ext: "webp", bytes: sizeOf(webp) });

        if (width === FALLBACK_WIDTH) {
          const jpeg = path.join(OUT_DIR, `plate-${stage}-${width}.jpg`);
          run("magick", [
            frame,
            "-quality", String(JPEG_QUALITY),
            "-sampling-factor", "4:2:0",
            "-interlace", "JPEG",
            "-strip",
            jpeg,
          ]);
          rows.push({ stage, width, ext: "jpg", bytes: sizeOf(jpeg) });
        }
      }
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  report(rows);
}

/** @param {Array<{ stage: string, width: number, ext: string, bytes: number }>} rows */
function report(rows) {
  const exts = ["avif", "webp", "jpg"];
  const cell = (stage, width, ext) => {
    const row = rows.find(
      (r) => r.stage === stage && r.width === width && r.ext === ext,
    );
    return row ? kb(row.bytes) : "—";
  };

  const head = ["stage", "width", ...exts].map((h) => h.padEnd(10)).join("");
  console.log(`\n  ${head}`);
  console.log(`  ${"-".repeat(head.trimEnd().length)}`);

  for (const stage of STAGES) {
    for (const width of WIDTHS) {
      const cells = exts.map((ext) => cell(stage, width, ext).padEnd(10));
      console.log(
        `  ${stage.padEnd(10)}${String(width).padEnd(10)}${cells.join("")}`,
      );
    }
    console.log(`  ${PLATES[stage].note}`);
  }

  const total = (ext) =>
    rows.filter((r) => r.ext === ext).reduce((sum, r) => sum + r.bytes, 0);

  const avifTotal = total("avif");
  console.log("");
  for (const ext of exts) {
    console.log(`  total ${ext.padEnd(6)} ${kb(total(ext))}`);
  }

  const verdict = avifTotal <= AVIF_BUDGET_BYTES ? "within" : "OVER";
  console.log(
    `\n  AVIF set ${kb(avifTotal)} — ${verdict} the ${kb(AVIF_BUDGET_BYTES)} budget.`,
  );
  console.log(`  ${readdirSync(OUT_DIR).length} files in public/plates/\n`);
}

try {
  main();
} catch (error) {
  console.error(
    `\nbuild-plates: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
