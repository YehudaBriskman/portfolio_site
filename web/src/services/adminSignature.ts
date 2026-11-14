import { ContentConflictError, ContentInvalidError, type Issue } from "./adminContent";
import type { Strokes } from "@/lib/signature/strokes";

/*
 * The owner's signature image (/api/admin/signature). Same rules as
 * adminAnnounce.ts: relative paths so a request stays on the gated origin, 409
 * is a conflict, 400 carries `issues`. A drawn signature is sent as strokes
 * (the server writes the SVG); an upload is an SVG text or a cleaned PNG.
 */

export type SigLang = "en" | "he";
export const SIG_LANGS: readonly SigLang[] = ["en", "he"];
export type SigUse = "email" | "posts" | "cards";
export type SigShow = Record<SigUse, boolean>;

export type SigSlot = {
  lang: SigLang;
  mode: "drawn" | "uploaded";
  format: "svg" | "png";
  alt: string;
  ink: string;
  light: boolean;
  hash: string;
  width: number;
  height: number;
  updatedAt: string;
  strokes?: Strokes;
  urls: { web: string; email: string; emailLight: string | null };
  /** The owner's own copies, behind the admin gate (the public urls answer 404 until a use is on). */
  preview: { web: string; email: string; emailLight: string | null };
};

export type SigState = { ok: true; show: SigShow; slots: Record<SigLang, SigSlot | null> };

export type SigSaveBody =
  | { kind: "strokes"; alt: string; strokes: Strokes; ink: string; light: boolean }
  | { kind: "svg"; alt: string; svg: string; recolor: boolean; ink: string; light: boolean }
  | { kind: "png"; alt: string; png: string; light: boolean };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin/signature${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    throw new Error("api-down");
  }
  if (res.status === 401 || res.status === 403) throw new Error("not-authorised");
  if (res.status === 409) throw new ContentConflictError();
  if (res.status >= 400 && res.status < 500 && res.status !== 404) {
    const list = (body as { issues?: unknown } | null)?.issues;
    const issues: Issue[] = Array.isArray(list)
      ? list.flatMap((i: unknown) => {
          const { path: p, message } = (i ?? {}) as Record<string, unknown>;
          return typeof message === "string" ? [{ path: typeof p === "string" ? p : "", message }] : [];
        })
      : [];
    throw new ContentInvalidError("invalid", issues);
  }
  if (!res.ok) throw new Error(`status-${res.status}`);
  return body as T;
}

export const adminSignature = {
  get: () => call<SigState>(""),
  saveShow: (show: SigShow) => call<{ ok: true; show: SigShow }>("/show", { method: "PUT", body: JSON.stringify({ show }) }),
  save: (lang: SigLang, body: SigSaveBody) => call<{ ok: true; slot: SigSlot }>(`/${lang}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (lang: SigLang) => call<{ ok: true }>(`/${lang}`, { method: "DELETE" }),
};
