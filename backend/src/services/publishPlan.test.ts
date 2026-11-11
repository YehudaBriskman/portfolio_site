import { planPublish } from "./publishPlan.js";
import type { Post, PostContent } from "../schemas/content.js";

const content = (over: Partial<PostContent> = {}): PostContent =>
  ({
    title: "T",
    subtitle: null,
    excerpt: "e",
    body: "b",
    tags: [],
    collection: "site",
    coverImage: null,
    links: [],
    featured: null,
    publishedAt: null,
    seo: { title: null, description: null, canonical: null, noindex: false },
    he: null,
    heMeta: null,
    ...over,
  }) as PostContent;

const published = (over: Partial<Post> = {}): Post =>
  ({ _id: "post:a", type: "post", slug: "a", status: "published", title: "Old", excerpt: "e", body: "old", tags: [], collection: "site", he: { title: "ישן" }, ...over }) as Post;

describe("planPublish", () => {
  it("both: the whole edit goes live and nothing waits", () => {
    const plan = planPublish(published(), content({ title: "New", he: { title: "חדש" } }), "both")!;
    expect(plan.content.title).toBe("New");
    expect(plan.content.he).toEqual({ title: "חדש" });
    expect(plan.waiting).toBeNull();
  });

  it("en: English goes live over the live Hebrew; the whole edit waits", () => {
    const plan = planPublish(published(), content({ title: "New", he: { title: "חדש" } }), "en")!;
    expect(plan.content.title).toBe("New");
    expect(plan.content.he).toEqual({ title: "ישן" });
    expect(plan.waiting?.he).toEqual({ title: "חדש" });
  });

  it("he: Hebrew goes live over the live English; the edit's English waits", () => {
    const plan = planPublish(published(), content({ title: "New", he: { title: "חדש" } }), "he")!;
    expect(plan.content.title).toBe("Old");
    expect(plan.content.he).toEqual({ title: "חדש" });
    expect(plan.waiting?.title).toBe("New");
  });

  it("he: nothing waits when the edit's English equals what is live", () => {
    const plan = planPublish(published(), content({ title: "Old", body: "old", he: { title: "חדש" } }), "he")!;
    expect(plan.waiting).toBeNull();
  });

  it("he: refused when nothing is live", () => {
    expect(planPublish(null, content(), "he")).toBeNull();
    expect(planPublish(published({ status: "draft" }), content(), "he")).toBeNull();
  });
});
