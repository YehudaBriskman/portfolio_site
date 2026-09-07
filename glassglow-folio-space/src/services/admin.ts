import { z } from "zod";

const AdminPostSchema = z.object({
  _id: z.string().optional(),
  _rev: z.string().optional(),
  slug: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  excerpt: z.string(),
  body: z.string(),
  status: z.enum(["draft", "published", "archived"]),
  publishedAt: z.string().nullable(),
  updatedAt: z.string(),
  tags: z.array(z.string()),
  readingMinutes: z.number(),
});

export type AdminPost = z.infer<typeof AdminPostSchema>;

/* Admin endpoints only exist on the admin host. Using a relative path keeps the
   request on whatever origin the page is served from, which is the gated one. */
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (res.status === 401 || res.status === 403) throw new Error("not-authorised");
  if (res.status === 409) throw new Error("This post changed elsewhere. Reload and reapply your edit.");
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const admin = {
  me: () => call<{ ok: true; login: string; email: string | null }>("/me"),
  list: async () => {
    const r = await call<{ items: unknown[] }>("/posts");
    return z.array(AdminPostSchema).parse(r.items);
  },
  get: async (slug: string) => {
    const r = await call<{ post: unknown }>(`/posts/${encodeURIComponent(slug)}`);
    return AdminPostSchema.parse(r.post);
  },
  save: async (slug: string, body: Record<string, unknown>) => {
    const r = await call<{ post: unknown }>(`/posts/${encodeURIComponent(slug)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return AdminPostSchema.parse(r.post);
  },
  archive: (slug: string) => call<{ ok: true }>(`/posts/${encodeURIComponent(slug)}`, { method: "DELETE" }),
};

export function slugify(title: string) {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}
