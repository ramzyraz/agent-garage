#!/usr/bin/env bash
# Builds the downloadable book (PDF, Word, EPUB) from the published chapters.
# Output: site/story/download/<slug>.{pdf,docx,epub}
# Needs: node, pandoc, and Chrome (google-chrome on Linux, Google Chrome.app on macOS).
set -euo pipefail
cd "$(dirname "$0")/../.."

out=site/story/download
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$out"

meta() { node -e "const m=require('./site/story/book.json'),b=(m.books||[])[0]||{},c=require('./site/story/chapters.json');console.log($1)"; }
series=$(meta "m.series||'The Story'")
book=$(meta "b.title||''")
complete=$(meta "b.complete?'yes':'no'")
count=$(meta "c.length")
slug=$(echo "$series" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//; s/-$//')

if [ "$count" = 0 ]; then echo "No chapters yet."; exit 0; fi

subtitle="Book 1: $book"
[ "$complete" = yes ] || subtitle="$subtitle (chapters 1–$count, still being written)"

cat > "$tmp/meta.yaml" <<EOF
title: "$series"
subtitle: "$subtitle"
author: "Written by Claude Code, edited by OpenAI Codex"
lang: en
toc-title: Contents
EOF

node -e 'require("./site/story/chapters.json").forEach(c => console.log(c.file))' | while read -r f; do
  cat "site/story/chapters/$f"; printf '\n\n'
done > "$tmp/book.md"

pandoc "$tmp/book.md" --metadata-file "$tmp/meta.yaml" -o "$out/$slug.docx"
pandoc "$tmp/book.md" --metadata-file "$tmp/meta.yaml" --toc --toc-depth=1 --split-level=1 -o "$out/$slug.epub"

cat > "$tmp/style.html" <<'EOF'
<style>
  @page { size: A5; margin: 18mm 16mm 20mm; }
  html { font-family: "Literata", "Georgia", "DejaVu Serif", "Liberation Serif", serif; font-size: 10.5pt; }
  body { max-width: none; margin: 0; padding: 0; line-height: 1.55; color: #111; }
  header#title-block-header { text-align: center; padding-top: 32%; page-break-after: always; }
  header .title { font-size: 26pt; margin: 0 0 10pt; }
  header .subtitle { font-size: 13pt; font-weight: normal; font-style: italic; margin: 0 0 40pt; }
  header .author { font-size: 10pt; color: #555; }
  nav#TOC { page-break-after: always; }
  nav#TOC ul { list-style: none; padding: 0; }
  nav#TOC li { margin: 4pt 0; }
  nav#TOC a { color: inherit; text-decoration: none; }
  h1 { page-break-before: always; font-size: 16pt; text-align: center; margin: 22% 0 24pt; }
  p { margin: 0; text-indent: 1.4em; text-align: justify; hyphens: auto; }
  h1 + p, hr + p { text-indent: 0; }
  hr { border: 0; text-align: center; margin: 12pt 0; }
  hr::after { content: "⁂"; }
</style>
EOF
pandoc "$tmp/book.md" --metadata-file "$tmp/meta.yaml" -s --toc --toc-depth=1 \
  -H "$tmp/style.html" -o "$tmp/book.html"

chrome=$(command -v google-chrome || command -v chromium || echo "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
"$chrome" --headless=new --disable-gpu --no-sandbox --no-pdf-header-footer \
  --print-to-pdf="$out/$slug.pdf" "file://$tmp/book.html" 2>/dev/null

ls -la "$out"
