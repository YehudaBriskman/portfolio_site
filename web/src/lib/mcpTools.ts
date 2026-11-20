/*
 * The remote MCP server's tools, as /developers/mcp lists them (#263).
 * Mirrors mcp/src/tools.ts; src/pages/__tests__/DevelopersMcp.test.tsx
 * fails if the two drift.
 */

export type Tool = { name: string; does: string };

export const PUBLIC: Tool[] = [
  { name: "list_posts", does: "Published posts, newest first; filter by tag or area." },
  { name: "get_post", does: "One published post, in full." },
  { name: "list_tags", does: "Tags on published posts, with counts." },
  { name: "list_areas", does: "The site's areas: its own notes and each project." },
  { name: "get_area", does: "One area, with its links and repository." },
  { name: "list_activity", does: "The channel log: posts, releases and pushes." },
];

export const OWNER_READ: Tool[] = [
  { name: "admin_list_posts", does: "Every post, drafts and archived included." },
  { name: "admin_get_post", does: "Any post, in full." },
  { name: "admin_list_areas", does: "Every area, hidden ones included, with all its fields." },
  { name: "list_content", does: "The site's content documents (projects, story, site-copy) and whether each has a draft." },
  { name: "get_content", does: "One content document, or a part of it by path; the draft or the live version." },
  { name: "get_settings", does: "The site settings and their version history." },
  { name: "read_audit_log", does: "Who changed what, and through which client." },
  { name: "list_media", does: "The media library: pictures, icons and videos, with what uses each." },
  { name: "list_translations", does: "What is missing, stale or done in Hebrew, across the site." },
  { name: "get_translation", does: "One item in English and Hebrew, side by side." },
];

export const OWNER_WRITE: Tool[] = [
  { name: "save_post_draft", does: "Create or edit a post. Dry run unless told otherwise." },
  { name: "publish_post", does: "Publish a post. Dry run unless told otherwise." },
  { name: "unpublish_post", does: "Return a post to draft. Dry run unless told otherwise." },
  { name: "delete_post", does: "Archive a post. Needs confirm: true." },
  { name: "save_area", does: "Create or edit an area. Dry run unless told otherwise." },
  { name: "delete_area", does: "Hide an area. Needs confirm: true." },
  { name: "save_content_draft", does: "Edit projects, story or site copy, by path, as a draft. Dry run unless told otherwise." },
  { name: "publish_content", does: "Make a content draft live. Dry run unless told otherwise." },
  { name: "discard_content_draft", does: "Throw away a content draft. Needs confirm: true." },
  { name: "save_settings", does: "Change the site settings, by path. Dry run unless told otherwise." },
  { name: "revert_settings", does: "Put an earlier settings version back. Dry run unless told otherwise." },
  { name: "update_media", does: "Edit a picture's alt text, caption, credit and Hebrew. Dry run unless told otherwise." },
  { name: "delete_media", does: "Delete an unused media item. Needs confirm: true." },
  { name: "sync_area", does: "Refresh an area's repository numbers now." },
  { name: "ack_translation", does: "Mark a Hebrew text as still correct after its English changed." },
  { name: "put_translation", does: "Write Hebrew: a draft for posts and content, LIVE at once for areas and media (no draft). Dry run unless told otherwise." },
];
