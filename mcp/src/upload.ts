import { readFile, stat } from "node:fs/promises";
import { basename, isAbsolute } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PortfolioApi } from "./api.js";
import { dryRun, fail, json, safe, type MediaItem, type MediaKind } from "./tools.js";

/*
 * upload_media: stdio only, and deliberately NOT in tools.ts.
 *
 * It reads a local path. Registered by the remote server that would be an
 * arbitrary-file read on the API's pod for any mcp:write client, so the
 * backend must never import this file.
 */
export const STDIO_TOOLS = ["upload_media"] as const;

const MB = 1024 * 1024;
/* The server checks the bytes; TYPES and RULES only keep an obviously wrong file from being read. */
const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  vtt: "text/vtt",
};
const RULES: Record<MediaKind | "poster" | "captions", { exts: string[]; max: number }> = {
  image: { exts: ["jpg", "jpeg", "png", "webp", "avif", "svg"], max: 10 * MB },
  icon: { exts: ["svg", "png"], max: 64 * 1024 },
  video: { exts: ["mp4", "webm"], max: 25 * MB },
  poster: { exts: ["jpg", "jpeg", "png", "webp", "avif"], max: 5 * MB },
  captions: { exts: ["vtt"], max: 200 * 1024 },
};
const sizeText = (n: number) => (n >= MB ? `${+(n / MB).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

/** A local file checked against a kind's rule, or the reason it cannot be. */
async function localFile(path: string, rule: keyof typeof RULES): Promise<{ name: string; type: string; size: number } | string> {
  if (!isAbsolute(path)) return `${path}: path must be absolute.`;
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const { exts, max } = RULES[rule];
  if (!exts.includes(ext)) return `${basename(path)}: a ${rule} must be ${exts.map((e) => `.${e}`).join(", ")}.`;
  let size: number;
  try {
    const s = await stat(path);
    if (!s.isFile()) return `${path} is not a file.`;
    size = s.size;
  } catch {
    return `Cannot read ${path}.`;
  }
  if (size > max) return `${basename(path)} is ${sizeText(size)}; a ${rule} may be ${sizeText(max)} at most.`;
  return { name: basename(path), type: TYPES[ext], size };
}

export function registerUploadTools(server: McpServer, api: PortfolioApi) {
  server.registerTool(
    "upload_media",
    {
      title: "Upload to the media library",
      description:
        "Uploads one local file with its alt text, as a `kind`: an image (JPEG, PNG, WebP, AVIF or plain SVG; 10 MB; " +
        "EXIF and location stripped, AVIF and WebP sizes made), an icon (a plain SVG or a PNG; 64 KB; kept as drawn), " +
        "or a video (MP4 H.264/AAC or WebM VP9|AV1/Opus; 25 MB and 60 s; location and device tags stripped). A video " +
        "needs `posterPath`, a still image the server cannot make itself, and may take `captionsPath` (WebVTT). " +
        "dryRun defaults to true: it checks the files and reports what would be uploaded, and sends nothing. Returns " +
        "the stable `url` to use in a coverImage, a project image or an area's icon.",
      inputSchema: {
        path: z.string().min(1).max(1024).describe("Absolute path of the local file"),
        alt: z.string().trim().min(1).max(300).describe("Alt text: what it shows. Required."),
        kind: z.enum(["image", "icon", "video"]).default("image"),
        posterPath: z.string().min(1).max(1024).optional().describe("A video's poster image (absolute path). Required for a video."),
        captionsPath: z.string().min(1).max(1024).optional().describe("A video's WebVTT captions (absolute path)."),
        captionsLang: z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/).optional(),
        caption: z.string().max(500).optional(),
        credit: z.string().max(200).optional(),
        dryRun,
      },
      annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    safe(async ({ path, alt, kind, posterPath, captionsPath, captionsLang, caption, credit, dryRun }) => {
      const main = await localFile(path, kind);
      if (typeof main === "string") return fail(main);
      if (kind !== "video" && (posterPath || captionsPath)) return fail("posterPath and captionsPath are for a video.");
      if (captionsLang && !captionsPath) return fail("captionsLang is the language of captionsPath; give captionsPath too.");
      if (kind === "video" && !posterPath) {
        return fail("A video needs posterPath: a still image to show before it plays (the server has no ffmpeg to make one).");
      }
      const poster = posterPath ? await localFile(posterPath, "poster") : null;
      if (typeof poster === "string") return fail(poster);
      const captions = captionsPath ? await localFile(captionsPath, "captions") : null;
      if (typeof captions === "string") return fail(captions);

      const { items } = await api.adminGet<{ items: MediaItem[] }>("/api/admin/media", { q: main.name });
      const same = items.filter((m) => m.name === main.name).map((m) => m.id);
      const plan = {
        dryRun,
        action: "upload_media",
        kind,
        file: main.name,
        bytes: main.size,
        type: main.type,
        ...(poster ? { poster: poster.name } : {}),
        ...(captions ? { captions: captions.name, captionsLang: captionsLang ?? "en" } : {}),
        alt,
        caption: caption ?? "",
        credit: credit ?? "",
        ...(same.length ? { warning: `The library already has ${same.length} item(s) named ${main.name}: ${same.join(", ")}.` } : {}),
      };
      if (dryRun) return json({ ...plan, note: "Dry run: nothing was uploaded. Call again with dryRun: false to upload." });

      const query = { alt, caption, credit, filename: main.name, kind, captionsLang: captions ? captionsLang : undefined };
      let res: { item: MediaItem };
      if (kind === "video") {
        const form = new FormData();
        form.append("file", new Blob([await readFile(path)], { type: main.type }), main.name);
        form.append("poster", new Blob([await readFile(posterPath!)], { type: poster!.type }), poster!.name);
        if (captions) form.append("captions", new Blob([await readFile(captionsPath!)], { type: "text/vtt" }), captions.name);
        res = await api.adminUploadForm<{ item: MediaItem }>("/api/admin/media", query, form);
      } else {
        res = await api.adminUpload<{ item: MediaItem }>("/api/admin/media", query, new Uint8Array(await readFile(path)), main.type);
      }
      return json({
        ...plan,
        result: { id: res.item.id, kind: res.item.kind, url: res.item.url, size: `${res.item.width}x${res.item.height}` },
      });
    }),
  );
}
