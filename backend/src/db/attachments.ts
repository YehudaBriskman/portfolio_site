import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import { CouchError, couchConfig } from "./couch.js";

/*
 * Binary attachments on the content database, for the media library (#253).
 *
 * Separate from `couch.ts` because that client speaks JSON only, in both
 * directions, and everything here is bytes. Same server, same database, same
 * credential, same failure class: a store that does not answer is a
 * CouchError with status 0, which the error handler maps to 502 like any
 * other store fault.
 *
 * Writes go as ONE multipart/related PUT — the document and every attachment
 * in a single request, so a media item is created or replaced atomically. A
 * replace that names only the new attachments drops the old ones in the same
 * revision; there is never a revision holding half a set of variants. Inline
 * base64 attachments would also be one request, but they inflate the body by
 * a third and count towards CouchDB's max_document_size (8 MB by default),
 * which a 10 MB original would break.
 */
const { base, db, auth } = couchConfig;

export type NewAttachment = { name: string; contentType: string; data: Buffer };

async function send(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`${base}/${db}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { Authorization: auth, ...(init.headers ?? {}) },
    });
  } catch (cause) {
    throw new CouchError(0, `couch unreachable on ${path}`, cause);
  } finally {
    clearTimeout(t);
  }
}

/** The multipart/related body CouchDB accepts for a document with its attachments. */
export function multipartBody(doc: Record<string, unknown>, files: NewAttachment[]) {
  const boundary = `media-${randomBytes(12).toString("hex")}`;
  const json = {
    ...doc,
    _attachments: Object.fromEntries(
      files.map((f) => [f.name, { follows: true, content_type: f.contentType, length: f.data.length }]),
    ),
  };
  const parts: Buffer[] = [
    Buffer.from(`--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(json)}\r\n`),
  ];
  for (const f of files) {
    // CouchDB matches parts to `follows` stubs by order; the headers are for humans.
    parts.push(Buffer.from(`--${boundary}\r\nContent-Type: ${f.contentType}\r\n\r\n`), f.data, Buffer.from("\r\n"));
  }
  parts.push(Buffer.from(`--${boundary}--`));
  return { boundary, body: Buffer.concat(parts) };
}

export const attachments = {
  /** Creates or replaces the document and its whole attachment set. */
  async putWith(id: string, doc: Record<string, unknown>, files: NewAttachment[]): Promise<{ rev: string }> {
    const { boundary, body } = multipartBody(doc, files);
    const path = `/${encodeURIComponent(id)}`;
    const res = await send(
      path,
      {
        method: "PUT",
        // A view, not a copy: a video upload is tens of MB on a small pod.
        body: new Uint8Array(body.buffer, body.byteOffset, body.length),
        headers: { "Content-Type": `multipart/related;boundary="${boundary}"`, Accept: "application/json" },
      },
      30_000,
    );
    if (!res.ok) throw new CouchError(res.status, `couch ${res.status} on ${path}`);
    const out = (await res.json()) as { rev: string };
    return { rev: out.rev };
  },

  /** Adds or replaces one attachment on an existing document; returns the new revision. */
  async putOne(id: string, rev: string, file: NewAttachment): Promise<{ rev: string }> {
    const path = `/${encodeURIComponent(id)}/${encodeURIComponent(file.name)}?rev=${encodeURIComponent(rev)}`;
    const res = await send(
      path,
      {
        method: "PUT",
        body: new Uint8Array(file.data.buffer, file.data.byteOffset, file.data.length),
        headers: { "Content-Type": file.contentType, Accept: "application/json" },
      },
      10_000,
    );
    if (!res.ok) throw new CouchError(res.status, `couch ${res.status} on /${id}/${file.name}`);
    const out = (await res.json()) as { rev: string };
    return { rev: out.rev };
  },

  /** One attachment's bytes, or null when the document or the name is absent. */
  async get(id: string, name: string): Promise<{ data: Buffer; contentType: string } | null> {
    const path = `/${encodeURIComponent(id)}/${encodeURIComponent(name)}`;
    const res = await send(path, { method: "GET" }, 10_000);
    if (res.status === 404) return null;
    if (!res.ok) throw new CouchError(res.status, `couch ${res.status} on ${path}`);
    return {
      data: Buffer.from(await res.arrayBuffer()),
      contentType: res.headers.get("content-type") ?? "application/octet-stream",
    };
  },

  /*
   * Bytes start..end (inclusive) of one attachment, as a stream, for a video's
   * Range requests: the pod passes the slice through instead of loading the
   * whole file per request. CouchDB answers a Range on an attachment it stores
   * uncompressed (video/* is not in its compressible types) with a 206; if it
   * ever answers 200 instead, the slice is cut here so the caller's 206 is
   * still true.
   */
  async range(id: string, name: string, start: number, end: number): Promise<Readable | null> {
    const path = `/${encodeURIComponent(id)}/${encodeURIComponent(name)}`;
    const res = await send(path, { method: "GET", headers: { Range: `bytes=${start}-${end}` } }, 60_000);
    if (res.status === 404) return null;
    if (res.status === 206 && res.body) return Readable.fromWeb(res.body as import("node:stream/web").ReadableStream);
    if (!res.ok) throw new CouchError(res.status, `couch ${res.status} on ${path}`);
    const all = Buffer.from(await res.arrayBuffer());
    return Readable.from([all.subarray(start, end + 1)]);
  },

  /** Deletes the document, and with it every attachment it holds. */
  async remove(id: string, rev: string): Promise<void> {
    const path = `/${encodeURIComponent(id)}?rev=${encodeURIComponent(rev)}`;
    const res = await send(path, { method: "DELETE", headers: { Accept: "application/json" } }, 8000);
    if (!res.ok) throw new CouchError(res.status, `couch ${res.status} on /${id}`);
  },
};
