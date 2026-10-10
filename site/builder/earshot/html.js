// An accessible HTML version of the reviewed document.
import { stripBullet } from './analyze.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NUMBERED = /^\(?(\d{1,2}|[a-z])[.)]\s/;

export function toHtml(S, crops = {}) {
  const parts = [];
  const real = S.blocks.filter(b => b.type !== 'artifact');
  for (let i = 0; i < real.length; i++) {
    const b = real[i];
    if (b.type === 'li') {
      const run = [];
      while (i < real.length && real[i].type === 'li') run.push(real[i++]);
      i--;
      const tag = NUMBERED.test(run[0].text) ? 'ol' : 'ul';
      parts.push(`<${tag}>\n${run.map(x => `  <li>${esc(stripBullet(x.text))}</li>`).join('\n')}\n</${tag}>`);
    } else if (b.type === 'h') {
      const l = Math.min(6, b.level || 2);
      parts.push(`<h${l}>${esc(b.text)}</h${l}>`);
    } else if (b.type === 'table') {
      const head = b.headerRows ? b.rows.slice(0, b.headerRows) : [];
      const body = b.rows.slice(b.headerRows || 0);
      parts.push(`<table>\n${head.length ? `  <thead>\n${head.map(r => `    <tr>${r.map(c => `<th scope="col">${esc(c.text)}</th>`).join('')}</tr>`).join('\n')}\n  </thead>\n` : ''}  <tbody>\n${body.map(r => `    <tr>${r.map(c => `<td>${esc(c.text)}</td>`).join('')}</tr>`).join('\n')}\n  </tbody>\n</table>`);
    } else if (b.type === 'figure') {
      const src = crops[b.id];
      parts.push(src ? `<figure><img src="${src}" alt="${esc(b.alt || '')}"></figure>` : b.alt ? `<p>[Picture: ${esc(b.alt)}]</p>` : '');
    } else {
      parts.push(`<p>${esc(b.text)}</p>`);
    }
  }
  return `<!doctype html>
<html lang="${esc(S.lang || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(S.title || S.name)}</title>
<style>
body { font: 18px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1b1f24; background: #fff; margin: 0; }
main { max-width: 44rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
h1, h2, h3, h4 { line-height: 1.2; margin: 1.6em 0 .5em; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; }
th, td { border: 1px solid #c8ccd2; padding: .4em .6em; text-align: left; vertical-align: top; }
th { background: #eef2f0; }
img { max-width: 100%; height: auto; }
figure { margin: 1.4em 0; }
footer { margin-top: 3rem; font-size: .85em; color: #555; }
</style>
</head>
<body>
<main>
${parts.filter(Boolean).join('\n')}
<footer>Accessible HTML version of “${esc(S.name)}”, made with Earshot. Check it before publishing.</footer>
</main>
</body>
</html>
`;
}
