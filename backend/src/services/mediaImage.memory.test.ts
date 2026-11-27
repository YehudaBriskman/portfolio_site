import { crc32, deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { processUpload } from "./mediaImage.js";

/* A PNG whose header declares a size, with no pixels behind it: the limits are judged on the header. */
function declaredPng(width: number, height: number, bits: 8 | 16): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = bits;
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.alloc(1024))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

describe("how large an image may be once decoded", () => {
  it("refuses a deep image under the pixel limit that would decode past 160 MB", async () => {
    // 24 MP at 8 bytes a pixel: 192 MB.
    await expect(processUpload(declaredPng(6000, 4000, 16))).rejects.toMatchObject({ status: 413 });
  });

  it("still lets an 8-bit image at the pixel limit through to the decoder", async () => {
    // Past the limits, so it fails only on its missing pixels.
    await expect(processUpload(declaredPng(8000, 5000, 8))).rejects.toMatchObject({ status: 422 });
  }, 30_000);
});
