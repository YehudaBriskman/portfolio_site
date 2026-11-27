/** Every tag in use, once, in dictionary order: the editor's suggestions. */
export const knownTagsOf = (posts: { tags: string[] }[]): string[] =>
  [...new Set(posts.flatMap((p) => p.tags))].sort((a, b) => a.localeCompare(b));
