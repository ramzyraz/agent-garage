// Builds site/research/briefs.json from the brief files, for the research page.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const dir = "site/research/briefs";
const briefs = readdirSync(dir)
  .filter((f) => /^\d+-.*\.md$/.test(f))
  .sort()
  .map((file) => {
    const lines = readFileSync(`${dir}/${file}`, "utf8").split("\n");
    const title = (lines.find((l) => l.startsWith("# ")) || file).replace(/^#\s*/, "").trim();
    const summary = (lines.find((l) => l.startsWith("> ")) || "").replace(/^>\s*/, "").trim();
    const meta = lines.find((l) => l.startsWith("**Found:**")) || "";
    const score = (k) => Number((meta.match(new RegExp(`\\*\\*${k}\\*\\*\\s*(\\d)`)) || [])[1]) || null;
    return {
      file, title, summary,
      found: (meta.match(/\d{4}-\d{2}-\d{2}/) || [""])[0],
      pain: score("Pain"), reach: score("Reach"), buildable: score("Buildable"), wow: score("Wow potential"),
    };
  });

writeFileSync("site/research/briefs.json", JSON.stringify(briefs, null, 2) + "\n");
console.log(`${briefs.length} briefs`);
