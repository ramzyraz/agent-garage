// Merges two versions of projects/investigator/BACKLOG.md:
// the Investigator owns the rows and their order, the Builders own the Status column.
// Rows are matched by brief number; a status set by the Builders always wins over "open".
// Usage: node merge-backlog.mjs <versionA> <versionB>  (prints the merged file)
import { readFileSync } from "node:fs";

const rank = (s) => /built|dropped/i.test(s) ? 3 : /progress/i.test(s) ? 2 : 1;

function parse(text) {
  const lines = text.split("\n");
  const rows = new Map();
  lines.forEach((line, i) => {
    const key = (line.match(/\[(\d{3})\]/) || [])[1];
    if (key && line.trim().startsWith("|")) rows.set(key, { i, cells: line.split("|") });
  });
  return { lines, rows };
}

const [a, b] = process.argv.slice(2).map((f) => parse(readFileSync(f, "utf8")));
const base = a.rows.size >= b.rows.size ? a : b;
const other = base === a ? b : a;

// Rows only the other version has go at the end of the table.
const extra = [...other.rows.entries()].filter(([k]) => !base.rows.has(k));

const out = [...base.lines];
for (const [key, row] of base.rows) {
  const theirs = other.rows.get(key);
  if (!theirs) continue;
  const mine = row.cells[row.cells.length - 2], their = theirs.cells[theirs.cells.length - 2];
  if (rank(their) > rank(mine)) {
    row.cells[row.cells.length - 2] = their;
    out[row.i] = row.cells.join("|");
  }
}
if (extra.length) {
  const last = Math.max(...[...base.rows.values()].map((r) => r.i));
  out.splice(last + 1, 0, ...extra.map(([, r]) => r.cells.join("|")));
}
process.stdout.write(out.join("\n"));
