/*
 * The one escaper for XML, HTML text and attributes, and SVG. Characters XML
 * 1.0 forbids (most C0 controls, U+FFFE/U+FFFF) are dropped: a single stray
 * byte in stored text makes a strict parser reject the whole feed or sitemap.
 */
// eslint-disable-next-line no-control-regex
const XML_FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

export function escapeXml(s: string): string {
  return s
    .replace(XML_FORBIDDEN, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** A parsable date as a Date, else null: a bad stored timestamp must not throw out of a feed. */
export function validDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
