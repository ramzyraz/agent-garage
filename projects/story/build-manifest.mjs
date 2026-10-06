// Builds site/story/chapters.json from the chapter files, for the reader page.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const dir = "site/story/chapters";
const chapters = readdirSync(dir)
  .filter((f) => /^b\d+-c\d+\.md$/.test(f))
  .sort()
  .map((file) => {
    const [, book, chapter] = file.match(/^b(\d+)-c(\d+)\.md$/).map(Number);
    const first = readFileSync(`${dir}/${file}`, "utf8").split("\n")[0];
    const title = first.replace(/^#\s*/, "").trim() || `Chapter ${chapter}`;
    return { file, book, chapter, title };
  });

writeFileSync("site/story/chapters.json", JSON.stringify(chapters, null, 2) + "\n");
console.log(`${chapters.length} chapters`);
