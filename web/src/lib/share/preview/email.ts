/** The CSP an email preview is shown under: no scripts, no fonts, no frames; styles inline, images by https. */
export const EMAIL_FRAME_CSP = "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'";

const HEAD_TAGS =
  `<meta http-equiv="Content-Security-Policy" content="${EMAIL_FRAME_CSP}">` +
  `<meta name="color-scheme" content="light dark">`;

/**
 * The document put in the preview's `srcdoc`: the server-built email with a
 * policy meta added so the frame stays inert even if the sandbox attribute
 * were ever loosened. The email's own markup is not rewritten.
 */
export function emailFrameDoc(html: string): string {
  const head = /<head(\s[^>]*)?>/i.exec(html);
  if (head) return html.slice(0, head.index + head[0].length) + HEAD_TAGS + html.slice(head.index + head[0].length);
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html);
  if (doctype) return `${doctype[0]}<head>${HEAD_TAGS}</head>${html.slice(doctype[0].length)}`;
  return `<!doctype html><head>${HEAD_TAGS}</head>${html}`;
}
