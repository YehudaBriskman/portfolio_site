import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import type { Request, Response } from "express";
import { ImagesController } from "./images.controller";
import { ImagesService } from "../services/images.service";

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "uploads-"));
  writeFileSync(join(dir, "a.png"), Buffer.alloc(64, 1));
  const service = new ImagesService(dir);
  return { controller: new ImagesController(service), service };
}

function run(controller: ImagesController, headers: Record<string, string>, id = "a.png") {
  const res = Object.assign(new EventEmitter(), {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: [] as Buffer[],
    status(c: number) { this.statusCode = c; return this; },
    setHeader(k: string, v: string) { this.headers[k] = v; },
    json() { return this.end(); },
    writable: true,
    write(c: Buffer) { this.body.push(Buffer.from(c)); return true; },
    end(c?: Buffer) { if (c) this.body.push(Buffer.from(c)); (this as unknown as EventEmitter).emit("finish"); return this; },
  });
  const done = new Promise<void>((ok) => res.once("finish", ok));
  const req = { params: { imageId: id }, headers } as unknown as Request;
  return controller.getById(req, res as unknown as Response).then(() => done.then(() => res));
}

describe("legacy image route conditional GET", () => {
  it("serves a quoted ETag", async () => {
    const { controller } = setup();
    const res = await run(controller, {});
    expect(res.statusCode).toBe(200);
    expect(res.headers["ETag"]).toMatch(/^"\d+-[\d.]+"$/);
  });

  it("304 on a matching If-None-Match", async () => {
    const { controller } = setup();
    const etag = (await run(controller, {})).headers["ETag"];
    expect((await run(controller, { "if-none-match": etag })).statusCode).toBe(304);
  });

  it("ignores If-Modified-Since when If-None-Match is present and stale", async () => {
    const { controller } = setup();
    const res = await run(controller, {
      "if-none-match": '"0-0"',
      "if-modified-since": new Date(Date.now() + 3600_000).toUTCString(),
    });
    expect(res.statusCode).toBe(200);
  });

  it("still honours If-Modified-Since alone", async () => {
    const { controller } = setup();
    const res = await run(controller, { "if-modified-since": new Date(Date.now() + 3600_000).toUTCString() });
    expect(res.statusCode).toBe(304);
  });
});

describe("ImagesService path check", () => {
  it("rejects names outside the uploads directory", async () => {
    const { service } = setup();
    await expect(service.getImage("..png")).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.getImage("../a.png")).rejects.toMatchObject({ statusCode: 400 });
  });
});
