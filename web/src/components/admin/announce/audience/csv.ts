/* A small CSV reader for the import preview. It mirrors the server's parser and column rules (backend/src/audience), so the preview shows what the import will do: commas only, and a quote opens a cell only at its start. */
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
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === ",") {
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
  // Same rule as the server: a header row exists only if a first-row cell is exactly "email"; columns are then found by name.
  const first = rows[0]?.map((c) => c.trim().toLowerCase()) ?? [];
  const header = first.includes("email");
  const col = (name: string, fallback: number) => (header ? first.indexOf(name) : fallback);
  const [ie, inm, il] = [col("email", 0), col("name", 1), col("lang", 2)];
  return (header ? rows.slice(1) : rows).map((r) => {
    const email = (r[ie] ?? "").trim();
    return { email, name: inm >= 0 ? (r[inm] ?? "").trim() : "", lang: il >= 0 ? (r[il] ?? "").trim().toLowerCase() : "", valid: EMAIL.test(email) };
  });
}
