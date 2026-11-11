import fs from "node:fs";
import path from "node:path";

/** The built front end's index.html, which the server render rewrites per URL. Tests share one read of it. */
export const INDEX_HTML = fs.readFileSync(path.resolve(__dirname, "../../web/index.html"), "utf8");
