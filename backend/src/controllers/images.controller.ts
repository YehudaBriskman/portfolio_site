import { Request, Response } from "express";
import { pipeline } from "node:stream/promises";
import { ImagesService } from "../services/images.service";

export class ImagesController {
  constructor(private readonly images: ImagesService) {}

  /** GET /images/:imageId */
  public getById = async (req: Request, res: Response) => {
    try {
      const id = req.params.imageId; // e.g. "icaros.png"
      const payload = await this.images.getImage(id);

      // Conditional GET
      const ifNoneMatch = req.headers["if-none-match"];
      const ifModifiedSince = req.headers["if-modified-since"];

      // RFC 9110: If-Modified-Since is ignored whenever If-None-Match is present.
      const fresh = ifNoneMatch !== undefined
        ? ifNoneMatch.split(",").some((t) => {
            const tag = t.trim().replace(/^W\//, "");
            return tag === "*" || tag === payload.etag;
          })
        : ifModifiedSince !== undefined && new Date(ifModifiedSince) >= payload.lastModified;
      if (fresh) {
        payload.stream.destroy();
        return res.status(304).end();
      }

      // A read error before the first byte must still become a clean 500 below.
      await new Promise<void>((ok, fail) => {
        payload.stream.once("open", () => ok());
        payload.stream.once("error", fail);
      });

      // Headers
      res.setHeader("Content-Type", payload.contentType);
      res.setHeader("Content-Length", String(payload.size));
      res.setHeader("ETag", payload.etag);
      res.setHeader("Last-Modified", payload.lastModified.toUTCString());
      // Tune as you like; if filenames are immutable → year+immutable.
      res.setHeader("Cache-Control", "public, max-age=86400");

      // Stream to client
      // pipeline destroys the file when the visitor goes away, and the response when the file fails
      // mid-body: headers are out by then, so there is no status left to send.
      await pipeline(payload.stream, res).catch(() => undefined);
    } catch (err: unknown) {
      // Never hand a raw thrown value to the client: narrow it first, and only
      // repeat a message we chose ourselves.
      const status =
        typeof err === "object" && err !== null && typeof (err as { statusCode?: unknown }).statusCode === "number"
          ? (err as { statusCode: number }).statusCode
          : 500;
      if (status >= 500) console.error("[ImageController] error:", err);
      const message =
        status >= 500
          ? "internal error"
          : err instanceof Error
            ? err.message
            : "bad request";
      res.status(status).json({ ok: false, error: message });
    }
  };
}
