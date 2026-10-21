import { Request, Response } from "express";
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

      if (ifNoneMatch === payload.etag) {
        return res.status(304).end();
      }
      if (ifModifiedSince && new Date(ifModifiedSince) >= payload.lastModified) {
        return res.status(304).end();
      }

      // Headers
      res.setHeader("Content-Type", payload.contentType);
      res.setHeader("Content-Length", String(payload.size));
      res.setHeader("ETag", payload.etag);
      res.setHeader("Last-Modified", payload.lastModified.toUTCString());
      // Tune as you like; if filenames are immutable → year+immutable.
      res.setHeader("Cache-Control", "public, max-age=86400");

      // Stream to client
      payload.stream.on("error", () => res.status(500).end());
      payload.stream.pipe(res);
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
