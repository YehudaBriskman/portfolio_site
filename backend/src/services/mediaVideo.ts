import { MediaRejected, hashOf, processUpload, type Processed } from "./mediaImage.js";

/*
 * Short videos for the media library (#253): checked, measured and cleaned
 * in plain TypeScript, with no ffmpeg in the image.
 *
 * WHY NO FFMPEG. Alpine's ffmpeg package pulls x264, x265, libaom, dav1d,
 * libvpx, SDL and friends: well over 100 MB onto a ~200 MB image, and every
 * one of those libraries joins the image scan the release gates on. What the
 * library needs from a video is small — is it really MP4/WebM, which codecs,
 * how long, how big, and no location or device metadata — and all of that is
 * in the container's own headers. So the container is parsed here, and the
 * one thing that genuinely needs a decoder, a poster frame, is uploaded by
 * the owner beside the video (and goes through the image pipeline).
 *
 * The rules:
 *   - The container is read from the bytes (ISO-BMFF `ftyp`, or the EBML
 *     magic with DocType "webm"), never from the name or the Content-Type.
 *   - MP4 carries H.264 video (avc1/avc3) and AAC (mp4a) audio only; WebM
 *     carries VP9 or AV1 video and Opus or Vorbis audio only. Any other track
 *     — a timed-metadata track, which is where a phone puts its GPS trace,
 *     subtitles, timecode — is refused rather than half-removed, because its
 *     samples would stay in the file's data even with the track unlisted.
 *   - At most VIDEO_MAX_BYTES and VIDEO_MAX_MS, and a duration must be stated
 *     (a browser's raw MediaRecorder output states none: re-export it).
 *   - Metadata is removed IN PLACE, without moving a byte: MP4 `udta`, `meta`
 *     and `uuid` boxes become zero-filled `free` boxes of the same size, and the creation
 *     and modification times in mvhd/tkhd/mdhd are zeroed; WebM Tags,
 *     Attachments, Info/Title and Info/DateUTC become Void elements of the
 *     same size. Every sample offset stays valid, so nothing is re-muxed.
 */

export const VIDEO_MAX_BYTES = 25 * 1024 * 1024;
export const VIDEO_MAX_MS = 60_000;
const MAX_SIDE = 3840;

export type VideoFormat = "mp4" | "webm";
export const VIDEO_MIME: Record<VideoFormat, string> = { mp4: "video/mp4", webm: "video/webm" };

export type VideoInfo = {
  format: VideoFormat;
  width: number;
  height: number;
  durationMs: number;
  codecs: string[];
  hasAudio: boolean;
  /** Names of what was blanked, for the tests and the audit trail. */
  stripped: string[];
};

const bad = (why: string) => new MediaRejected(422, `The video could not be read: ${why}.`);

/* MP4 brands that are pictures, not video (HEIF, AVIF). */
const IMAGE_BRANDS = new Set(["avif", "avis", "heic", "heix", "mif1", "msf1", "heim", "heis"]);
const VIDEO_BRANDS = new Set(["isom", "iso2", "iso3", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V ", "dash", "mmp4"]);

export function sniffVideo(buf: Buffer): VideoFormat | null {
  if (buf.length >= 4 && buf.readUInt32BE(0) === 0x1a45dfa3) return "webm"; // DocType is checked in the parse
  if (buf.length >= 12 && buf.toString("latin1", 4, 8) === "ftyp") {
    const size = Math.min(buf.readUInt32BE(0), buf.length, 128);
    const brands = [buf.toString("latin1", 8, 12)];
    for (let i = 16; i + 4 <= size; i += 4) brands.push(buf.toString("latin1", i, i + 4));
    if (brands.some((b) => IMAGE_BRANDS.has(b))) return null;
    if (brands[0] === "qt  ") return null; // QuickTime .mov: not on the list
    return brands.some((b) => VIDEO_BRANDS.has(b)) ? "mp4" : null;
  }
  return null;
}

/** Checks, measures and strips `buf` IN PLACE. Throws MediaRejected. */
export function inspectVideo(buf: Buffer): VideoInfo {
  if (buf.length === 0) throw new MediaRejected(400, "The upload is empty.");
  if (buf.length > VIDEO_MAX_BYTES) {
    throw new MediaRejected(413, `Videos are limited to ${VIDEO_MAX_BYTES / 1024 / 1024} MB.`);
  }
  const format = sniffVideo(buf);
  if (!format) throw new MediaRejected(415, "Only MP4 (H.264/AAC) and WebM (VP9 or AV1) videos are accepted.");
  const info = format === "mp4" ? mp4(buf) : webm(buf);
  if (!(info.durationMs > 0)) throw bad("it does not say how long it is; re-export it from an editor");
  if (info.durationMs > VIDEO_MAX_MS) {
    throw new MediaRejected(413, `Videos are limited to ${VIDEO_MAX_MS / 1000} seconds.`);
  }
  if (!info.width || !info.height) throw bad("it has no picture size");
  if (info.width > MAX_SIDE || info.height > MAX_SIDE) {
    throw new MediaRejected(413, `Videos are limited to ${MAX_SIDE} pixels on a side.`);
  }
  return info;
}

/* ------------------------------------------------------------------ MP4 -- */

type Box = { type: string; start: number; header: number; size: number };

function boxes(buf: Buffer, start: number, end: number): Box[] {
  const out: Box[] = [];
  let p = start;
  while (p < end) {
    if (p + 8 > end) throw bad("a box runs past its parent");
    let size = buf.readUInt32BE(p);
    const type = buf.toString("latin1", p + 4, p + 8);
    let header = 8;
    if (size === 1) {
      if (p + 16 > end) throw bad("a box runs past its parent");
      const big = buf.readBigUInt64BE(p + 8);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) throw bad("a box is impossibly large");
      size = Number(big);
      header = 16;
    } else if (size === 0) {
      size = end - p; // to the end of the file
    }
    if (size < header || p + size > end) throw bad("a box runs past its parent");
    out.push({ type, start: p, header, size });
    p += size;
  }
  return out;
}

const body = (b: Box) => ({ from: b.start + b.header, to: b.start + b.size });
const child = (buf: Buffer, b: Box, type: string) => boxes(buf, body(b).from, body(b).to).find((x) => x.type === type);

/** Zero the creation and modification times of an mvhd/tkhd/mdhd full box. */
function zeroTimes(buf: Buffer, b: Box) {
  const at = body(b).from;
  const version = buf[at];
  buf.fill(0, at + 4, at + 4 + (version === 1 ? 16 : 8));
}

const META_BOXES = new Set(["udta", "meta", "uuid"]);
function freeMeta(buf: Buffer, list: Box[], where: string, stripped: string[]) {
  for (const b of list) {
    if (!META_BOXES.has(b.type)) continue;
    // Renamed AND emptied: a `free` box is skipped by players, but its bytes would still be there to read.
    buf.write("free", b.start + 4, "latin1");
    buf.fill(0, b.start + b.header, b.start + b.size);
    stripped.push(`${where}/${b.type}`);
  }
}

function mp4(buf: Buffer): VideoInfo {
  const stripped: string[] = [];
  const top = boxes(buf, 0, buf.length);
  if (top[0]?.type !== "ftyp") throw bad("it does not start with ftyp");
  const moov = top.find((b) => b.type === "moov");
  if (!moov) throw bad("it has no moov box");
  if (top.some((b) => b.type === "moof")) throw bad("fragmented MP4 is not supported; re-export it as a plain MP4");
  freeMeta(buf, top, "", stripped);

  const inMoov = boxes(buf, body(moov).from, body(moov).to);
  freeMeta(buf, inMoov, "moov", stripped);
  const mvhd = inMoov.find((b) => b.type === "mvhd");
  if (!mvhd) throw bad("it has no movie header");
  const m = body(mvhd).from;
  const v1 = buf[m] === 1;
  const timescale = buf.readUInt32BE(m + (v1 ? 20 : 12));
  const duration = v1 ? Number(buf.readBigUInt64BE(m + 24)) : buf.readUInt32BE(m + 16);
  zeroTimes(buf, mvhd);

  let width = 0;
  let height = 0;
  let hasAudio = false;
  const codecs: string[] = [];
  for (const trak of inMoov.filter((b) => b.type === "trak")) {
    const inTrak = boxes(buf, body(trak).from, body(trak).to);
    freeMeta(buf, inTrak, "trak", stripped);
    const tkhd = inTrak.find((b) => b.type === "tkhd");
    const mdia = inTrak.find((b) => b.type === "mdia");
    if (!tkhd || !mdia) throw bad("a track is incomplete");
    zeroTimes(buf, tkhd);
    const inMdia = boxes(buf, body(mdia).from, body(mdia).to);
    freeMeta(buf, inMdia, "mdia", stripped);
    const mdhd = inMdia.find((b) => b.type === "mdhd");
    if (mdhd) zeroTimes(buf, mdhd);
    const hdlr = inMdia.find((b) => b.type === "hdlr");
    const minf = inMdia.find((b) => b.type === "minf");
    if (!hdlr || !minf) throw bad("a track is incomplete");
    const handler = buf.toString("latin1", body(hdlr).from + 8, body(hdlr).from + 12);
    const stbl = child(buf, minf, "stbl");
    const stsd = stbl && child(buf, stbl, "stsd");
    if (!stsd) throw bad("a track has no sample description");
    const entries = boxes(buf, body(stsd).from + 8, body(stsd).to);
    const codec = entries[0]?.type ?? "";

    if (handler === "vide") {
      if (codec !== "avc1" && codec !== "avc3") {
        throw new MediaRejected(415, `MP4 video must be H.264; this one is ${codec.trim() || "unknown"}.`);
      }
      const t = body(tkhd).to;
      width = Math.max(width, Math.round(buf.readUInt32BE(t - 8) / 65536));
      height = Math.max(height, Math.round(buf.readUInt32BE(t - 4) / 65536));
    } else if (handler === "soun") {
      if (codec !== "mp4a") throw new MediaRejected(415, `MP4 audio must be AAC; this one is ${codec.trim() || "unknown"}.`);
      hasAudio = true;
    } else {
      throw new MediaRejected(
        415,
        `The video has a "${handler}" track (metadata, subtitles or timecode). Export it with only picture and sound.`,
      );
    }
    codecs.push(codec);
  }
  if (!codecs.some((c) => c.startsWith("avc"))) throw bad("it has no video track");
  return {
    format: "mp4",
    width,
    height,
    durationMs: timescale ? Math.round((duration / timescale) * 1000) : 0,
    codecs,
    hasAudio,
    stripped,
  };
}

/* ----------------------------------------------------------------- WebM -- */

type El = { id: number; start: number; dataStart: number; end: number; unknown: boolean };

function vint(buf: Buffer, at: number, keepMarker: boolean): { value: number; len: number; allOnes: boolean } {
  const first = buf[at];
  if (first === undefined || first === 0) throw bad("an element header is malformed");
  const len = Math.clz32(first) - 23; // 1..8
  if (at + len > buf.length) throw bad("an element runs past the end");
  let value = keepMarker ? first : first & (0xff >> len);
  let allOnes = value === (0xff >> len);
  for (let i = 1; i < len; i += 1) {
    value = value * 256 + buf[at + i];
    if (buf[at + i] !== 0xff) allOnes = false;
  }
  return { value, len, allOnes };
}

function elements(buf: Buffer, start: number, end: number, stopAtUnknown = false): El[] {
  const out: El[] = [];
  let p = start;
  while (p < end) {
    const id = vint(buf, p, true);
    const size = vint(buf, p + id.len, false);
    const dataStart = p + id.len + size.len;
    const unknown = size.allOnes;
    const elEnd = unknown ? end : dataStart + size.value;
    if (elEnd > end) throw bad("an element runs past its parent");
    out.push({ id: id.value, start: p, dataStart, end: elEnd, unknown });
    if (unknown && stopAtUnknown) break;
    p = elEnd;
  }
  return out;
}

const uintOf = (buf: Buffer, e: El) => {
  let v = 0;
  for (let i = e.dataStart; i < e.end; i += 1) v = v * 256 + buf[i];
  return v;
};
const floatOf = (buf: Buffer, e: El) =>
  e.end - e.dataStart === 4 ? buf.readFloatBE(e.dataStart) : e.end - e.dataStart === 8 ? buf.readDoubleBE(e.dataStart) : 0;
const strOf = (buf: Buffer, e: El) => buf.toString("latin1", e.dataStart, e.end).replace(/\0+$/, "");

/** Overwrite an element with a Void (0xEC) of exactly the same length. */
export function voidOut(buf: Buffer, e: El) {
  const total = e.end - e.start;
  buf.fill(0, e.start, e.end);
  buf[e.start] = 0xec;
  if (total - 2 < 127) {
    buf[e.start + 1] = 0x80 | (total - 2);
  } else {
    buf[e.start + 1] = 0x01; // an 8-byte size
    buf.writeUIntBE(Math.floor((total - 9) / 2 ** 32), e.start + 2, 3);
    buf.writeUInt32BE((total - 9) % 2 ** 32, e.start + 5);
  }
}

const ID = {
  EBML: 0x1a45dfa3,
  DocType: 0x4282,
  Segment: 0x18538067,
  Info: 0x1549a966,
  TimecodeScale: 0x2ad7b1,
  Duration: 0x4489,
  DateUTC: 0x4461,
  Title: 0x7ba9,
  Tracks: 0x1654ae6b,
  TrackEntry: 0xae,
  TrackType: 0x83,
  CodecID: 0x86,
  Video: 0xe0,
  PixelWidth: 0xb0,
  PixelHeight: 0xba,
  Tags: 0x1254c367,
  Attachments: 0x1941a469,
  Cluster: 0x1f43b675,
};

function webm(buf: Buffer): VideoInfo {
  const stripped: string[] = [];
  const top = elements(buf, 0, buf.length, true);
  const head = top[0];
  if (head?.id !== ID.EBML) throw bad("it has no EBML header");
  const docType = elements(buf, head.dataStart, head.end).find((e) => e.id === ID.DocType);
  if (!docType || strOf(buf, docType) !== "webm") throw new MediaRejected(415, "Only WebM is accepted, not other Matroska files.");
  const segment = top.find((e) => e.id === ID.Segment);
  if (!segment) throw bad("it has no segment");

  const kids = elements(buf, segment.dataStart, segment.end, true);
  if (kids.some((e) => e.unknown)) {
    throw bad("it was not finalised (a recording straight from a browser); re-export it from an editor");
  }
  let scale = 1_000_000;
  let duration = 0;
  let width = 0;
  let height = 0;
  let hasAudio = false;
  const codecs: string[] = [];
  let sawTracks = false;

  for (const e of kids) {
    if (e.id === ID.Tags || e.id === ID.Attachments) {
      voidOut(buf, e);
      stripped.push(e.id === ID.Tags ? "Tags" : "Attachments");
    } else if (e.id === ID.Info) {
      for (const f of elements(buf, e.dataStart, e.end)) {
        if (f.id === ID.TimecodeScale) scale = uintOf(buf, f);
        else if (f.id === ID.Duration) duration = floatOf(buf, f);
        else if (f.id === ID.DateUTC || f.id === ID.Title) {
          voidOut(buf, f);
          stripped.push(f.id === ID.Title ? "Info/Title" : "Info/DateUTC");
        }
      }
    } else if (e.id === ID.Tracks) {
      sawTracks = true;
      for (const t of elements(buf, e.dataStart, e.end).filter((x) => x.id === ID.TrackEntry)) {
        const f = elements(buf, t.dataStart, t.end);
        const type = f.find((x) => x.id === ID.TrackType);
        const codecEl = f.find((x) => x.id === ID.CodecID);
        const codec = codecEl ? strOf(buf, codecEl) : "";
        const kind = type ? uintOf(buf, type) : 0;
        if (kind === 1) {
          if (codec !== "V_VP9" && codec !== "V_AV1") {
            throw new MediaRejected(415, `WebM video must be VP9 or AV1; this one is ${codec || "unknown"}.`);
          }
          const video = f.find((x) => x.id === ID.Video);
          if (video) {
            for (const g of elements(buf, video.dataStart, video.end)) {
              if (g.id === ID.PixelWidth) width = Math.max(width, uintOf(buf, g));
              if (g.id === ID.PixelHeight) height = Math.max(height, uintOf(buf, g));
            }
          }
        } else if (kind === 2) {
          if (codec !== "A_OPUS" && codec !== "A_VORBIS") {
            throw new MediaRejected(415, `WebM audio must be Opus or Vorbis; this one is ${codec || "unknown"}.`);
          }
          hasAudio = true;
        } else {
          throw new MediaRejected(415, "The video has a track that is neither picture nor sound. Export it with only those.");
        }
        codecs.push(codec);
      }
    }
  }
  if (!sawTracks || !codecs.some((c) => c.startsWith("V_"))) throw bad("it has no video track");
  return {
    format: "webm",
    width,
    height,
    durationMs: Math.round((duration * scale) / 1_000_000),
    codecs,
    hasAudio,
    stripped,
  };
}

/* ------------------------------------------------------------ captions -- */

export const CAPTIONS_MAX_BYTES = 200 * 1024;

/** A WebVTT file: text, under the cap, starting with the signature. Returns it normalised to UTF-8. */
export function checkCaptions(buf: Buffer): Buffer {
  if (buf.length > CAPTIONS_MAX_BYTES) throw new MediaRejected(413, "Captions are limited to 200 KB.");
  const text = buf.toString("utf8").replace(/^﻿/, "");
  if (!/^WEBVTT(?:[ \t][^\n]*)?\r?\n/.test(text + "\n")) {
    throw new MediaRejected(415, "Captions must be a WebVTT (.vtt) file.");
  }
  if (text.includes("\0") || text.includes("�")) throw new MediaRejected(415, "Captions must be UTF-8 text.");
  return Buffer.from(text, "utf8");
}

/* -------------------------------------------------------------- process -- */

export const POSTER_MAX_BYTES = 5 * 1024 * 1024;
/** The most one video upload can be: the video, its poster, its captions, and the form around them. */
export const VIDEO_UPLOAD_MAX_BYTES = VIDEO_MAX_BYTES + POSTER_MAX_BYTES + CAPTIONS_MAX_BYTES + 64 * 1024;

export type CaptionsInput = { data: Buffer; lang: string; label: string };

/*
 * A video item: the cleaned video (served as-is, with Range), its poster
 * through the image pipeline (so the poster is AVIF/WebP at the usual widths,
 * with its EXIF gone like any photo's), and optional WebVTT captions.
 */
export async function processVideo(
  video: Buffer,
  poster: Buffer | null,
  captions: CaptionsInput | null,
): Promise<Processed> {
  const info = inspectVideo(video);
  if (!poster || poster.length === 0) {
    throw new MediaRejected(400, "A video needs a poster image: the first thing a visitor sees, and all they see with motion off.");
  }
  const p = await processUpload(poster, { maxBytes: POSTER_MAX_BYTES, raster: true });
  const cap = captions ? checkCaptions(captions.data) : null;
  return {
    kind: "video",
    format: info.format,
    width: info.width,
    height: info.height,
    original: { name: `video.${info.format}`, contentType: VIDEO_MIME[info.format], data: video, hash: hashOf(video) },
    variants: p.variants,
    durationMs: info.durationMs,
    codecs: info.codecs,
    hasAudio: info.hasAudio,
    captions:
      cap && captions
        ? {
            name: "captions.vtt",
            contentType: "text/vtt; charset=utf-8",
            data: cap,
            hash: hashOf(cap),
            lang: captions.lang,
            label: captions.label,
          }
        : null,
  };
}
