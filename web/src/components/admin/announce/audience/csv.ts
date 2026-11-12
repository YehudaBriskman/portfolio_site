/* A small CSV reader for the import preview: quotes, doubled quotes, commas and newlines inside quotes. The server parses again; this only shows what it is likely to see. */
export type CsvRow = { email: string; name: string; lang: string; valid: boolean };

export function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === "," || c === ";") {
      row.push(cell);
      cell = "";
    }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export function previewCsv(text: string): CsvRow[] {
  const rows = parseRows(text);
  if (rows.length && /^\s*e-?mail/i.test(rows[0][0] ?? "")) rows.shift();
  return rows.map((r) => {
    const email = (r[0] ?? "").trim();
    return { email, name: (r[1] ?? "").trim(), lang: (r[2] ?? "").trim().toLowerCase(), valid: EMAIL.test(email) };
  });
}
