import path from "path";
import fs from "fs";
import { createReadStream, ReadStream } from "fs";
import mime from "mime-types";

export type ImagePayload = {
  stream: ReadStream;
  size: number;
  contentType: string;
  etag: string;
  lastModified: Date;
};

export class ImagesService {
  private readonly uploadsDir: string;
  private static readonly SAFE_NAME = /^[a-zA-Z0-9._-]+$/;
  private static readonly ALLOWED_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"]);

  constructor(uploadsDir?: string) {
    this.uploadsDir = path.resolve(uploadsDir ?? path.join(process.cwd(), "uploads"));
  }

  /** Validate and resolve absolute path, preventing traversal */
  private resolveFile(name: string): string {
    if (!name || !ImagesService.SAFE_NAME.test(name)) {
      throw Object.assign(new Error("Invalid image id"), { statusCode: 400 });
    }
    const ext = path.extname(name).toLowerCase();
    if (!ImagesService.ALLOWED_EXTS.has(ext)) {
      throw Object.assign(new Error("Unsupported file extension"), { statusCode: 400 });
    }

    const abs = path.resolve(this.uploadsDir, name);
    if (!abs.startsWith(this.uploadsDir)) {
      throw Object.assign(new Error("Invalid path"), { statusCode: 400 });
    }
    return abs;
  }

  /** Compute strong-ish ETag from stat */
  private makeETag(stat: fs.Stats): string {
    return `${stat.size}-${Number(stat.mtimeMs)}`;
  }

  /** Main API: return stream + metadata (no framework bindings here) */
  async getImage(name: string): Promise<ImagePayload> {
    const abs = this.resolveFile(name);

    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(abs);
    } catch {
      throw Object.assign(new Error("Image not found"), { statusCode: 404 });
    }
    if (!stat.isFile()) {
      throw Object.assign(new Error("Not a file"), { statusCode: 404 });
    }

    const etag = this.makeETag(stat);
    const contentType = (mime.lookup(abs) || "application/octet-stream").toString();

    const stream = createReadStream(abs);
    stream.on("error", () => {
      // bubble up as generic 500; controller will handle
    });

    return {
      stream,
      size: stat.size,
      contentType,
      etag,
      lastModified: stat.mtime,
    };
  }
}
