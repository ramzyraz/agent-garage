// What still needs a person before export. Pure: reads Earshot's state.
import { buildLines, union } from './analyze.js';

// A review hint, never an automatic table. Dense cells and wrapped lines can
// defeat findTables; repeated alignments should not silently pass as prose.
function possibleTables(S) {
  const out = [];
  for (const page of S.ex?.pages || []) {
    const covered = new Set(S.blocks.filter(b => b.page === page.n && (b.type === 'table' || b.type === 'artifact'))
      .flatMap(b => b.items.map(it => it.i)));
    const lines = buildLines(page.items.filter(it => !covered.has(it.i) && !it.rot));
    const size = S.bodySize || 12;
    const rows = [];
    for (const l of lines.sort((a, b) => b.y - a.y)) {
      const last = rows.at(-1);
      if (last && Math.abs(last.y - l.y) < .35 * l.size) last.cells.push(l);
      else rows.push({ y: l.y, cells: [l] });
    }
    rows.forEach(r => r.cells.sort((a, b) => a.x0 - b.x0));
    let run = [], between = [];
    const flush = () => {
      // Repeated full-width prose in two columns is not a useful table hint.
      // Require three rows with substantial space between their cell text.
      const spaced = run.filter(r => r.cells.reduce((n, c) => n + c.bbox[2] - c.bbox[0], 0) /
        (r.cells.at(-1).bbox[2] - r.cells[0].x0) < .8);
      if (spaced.length >= 3) {
        const cells = [...run.flatMap(r => r.cells), ...between];
        const box = union(cells.map(c => c.bbox));
        out.push({ status: 'todo', title: `Aligned text on page ${page.n + 1} needs review`,
          detail: 'These aligned lines may be a missed table. Values may be read with the wrong headings. Open the cell preview, check the region and adjust rows or dividers before using it.',
          tableRegion: { page: page.n, box: [box[0] - 2, box[1] - 2, box[2] + 2, box[3] + 2] } });
      }
      run = []; between = [];
    };
    for (const r of rows) {
      const first = run[0], prev = run.at(-1);
      const separated = r.cells.length >= 2 && r.cells.every((c, k) => c.text.length < 120 &&
        (!k || c.x0 - r.cells[k - 1].bbox[2] >= .8 * size));
      // Narrow gaps may also merge two cells into one line; a subset of the
      // same column starts is enough to request review, never to assign cells.
      const matches = first && r.cells.length <= first.cells.length && r.cells.every(c => first.cells.some(a =>
        Math.abs(c.x0 - a.x0) < .8 * size || Math.abs(c.bbox[2] - a.bbox[2]) < .8 * size));
      // Keep a wrapped continuation between full rows, but never infer its cell.
      const lastY = Math.min(between.at(-1)?.y ?? Infinity, prev?.y ?? Infinity);
      const continuation = first && r.cells.length < first.cells.length && lastY - r.y < 1.8 * size &&
        r.cells.every(c => first.cells.some((a, k) => Math.abs(c.x0 - a.x0) < .8 * size &&
          (k === first.cells.length - 1 || c.bbox[2] < first.cells[k + 1].x0)));
      if (separated && matches && prev.y - r.y < 6 * size) run.push(r);
      else if (continuation) between.push(...r.cells);
      else { flush(); if (separated) run.push(r); }
    }
    flush();
  }
  return out;
}

const JUNK_TITLE = /^(untitled.*|document\d*|doc\d*|microsoft (word|powerpoint|excel) - .*|.*\.(docx?|pptx?|xlsx?|pdf|indd|qxd|rtf|odt|html?|txt|md|csv|pages)|(https?|file):\/\/.*|title|new document|\s*)$/i;

export function suggestTitle(fileTitle, blocks) {
  const t = (fileTitle || '').trim();
  if (t && !JUNK_TITLE.test(t)) return t;
  const h1 = blocks.find(b => b.type === 'h' && b.level === 1) || blocks.find(b => b.type === 'h');
  return h1 ? h1.text.slice(0, 160) : t && !JUNK_TITLE.test(t) ? t : '';
}

export function buildChecks(S) {
  const out = [{ status: 'info', title: 'Structure still needs your review',
    detail: 'The checks below find missing fields and level gaps. They cannot confirm that headings, reading order or table associations are correct. Read through every page before export.' }, ...possibleTables(S)];
  const bs = S.blocks;
  const real = bs.filter(b => b.type !== 'artifact');
  out.push(S.title && S.title.trim()
    ? { status: 'ok', title: 'Document title', detail: `“${S.title.trim()}”${S.titleFromFile && S.titleFromFile !== S.title ? ` (the file said “${S.titleFromFile}”)` : ''}.` }
    : { status: 'todo', title: 'Add a document title', detail: 'Screen readers announce the title first. Type one above.' });

  const noAlt = bs.filter(b => b.type === 'figure' && !(b.alt || '').trim());
  const figs = bs.filter(b => b.type === 'figure');
  if (noAlt.length) out.push({ status: 'todo', title: `${noAlt.length} ${noAlt.length === 1 ? 'picture needs' : 'pictures need'} a description`, detail: 'Write what a sighted reader gets from it, or mark it decorative if it adds nothing.', goto: noAlt[0].id, gotoLabel: 'Describe it' });
  else if (figs.length) out.push({ status: 'ok', title: `${figs.length === 1 ? 'The picture has' : `All ${figs.length} pictures have`} a description`, detail: 'Read them once more: only a person can tell whether they are accurate.' });

  const heads = real.filter(b => b.type === 'h');
  if (!heads.length) out.push({ status: 'todo', title: 'No headings', detail: 'Mark section titles as headings so people can jump between sections.', goto: real[0] && real[0].id, gotoLabel: 'Start at the top' });
  else {
    if (heads[0].level !== 1) out.push({ status: 'todo', title: `The first heading is level ${heads[0].level}`, detail: 'Documents usually start with one Heading 1, normally the title.', goto: heads[0].id });
    let prev = 0, skip = null;
    for (const hd of heads) { if (hd.level > prev + 1 && prev) { skip = { hd, prev }; break; } prev = hd.level; }
    if (skip) out.push({ status: 'todo', title: `Heading levels skip from ${skip.prev} to ${skip.hd.level}`, detail: `“${skip.hd.text.slice(0, 60)}” jumps a level, which suggests a missing section to screen-reader users.`, goto: skip.hd.id });
    if (heads[0].level === 1 && !skip) out.push({ status: 'ok', title: `${heads.length} headings with no level gaps`, detail: heads.slice(0, 4).map(hd => `${'  '.repeat(hd.level - 1)}H${hd.level} ${hd.text.slice(0, 40)}`).join(' · ') + (heads.length > 4 ? ' …' : '') + '. Check that these really are section titles.' });
  }

  bs.filter(b => b.type === 'table').forEach(t => {
    out.push(t.headerRows
      ? { status: 'ok', title: `Table on page ${t.page + 1} has column headers`, detail: `${t.rows[0].map(c => c.text).join(', ')}.${t.headerCols ? ' The first column also provides row headers.' : ''} Check that every value belongs to the right header.`, goto: t.id, gotoLabel: 'Check it' }
      : { status: 'todo', title: `Table on page ${t.page + 1} has no header row`, detail: 'Without headers, a screen reader reads cells with no context. Tick “first row holds the column headers” if it does.', goto: t.id });
  });
  out.push({ status: 'info', title: 'Check for missed tables', detail: 'Aligned text can be mistaken for headings or prose. If a table is missing, choose “Make a table”, draw around it and review the cell preview.' });

  const hidden = bs.filter(b => b.type === 'artifact');
  if (hidden.length) out.push({ status: 'info', title: `${hidden.length} ${hidden.length === 1 ? 'piece' : 'pieces'} of page furniture hidden`, detail: `${[...new Set(hidden.map(b => b.why))].join(', ')}. They stay visible on the page but aren’t read aloud. Check nothing important is hidden.`, goto: hidden[0].id, gotoLabel: 'Show the first' });

  let jumps = 0, prevIdx = -1;
  for (const b of real) {
    if (b.page !== (real[real.indexOf(b) - 1] || b).page) prevIdx = -1;
    if (b.fileIndex < prevIdx) jumps++;
    prevIdx = Math.max(prevIdx, b.fileIndex);
  }
  if (jumps) out.push({ status: 'info', title: 'Reading order follows the layout, not the file', detail: `The file stores its text in a different order; Earshot’s order differs from it in ${jumps} ${jumps === 1 ? 'place' : 'places'}. Press Read aloud to check it sounds right.` });

  const scanned = (S.ex ? S.ex.pages : []).filter(p => !p.items.some(it => it.s.trim()) && p.images.length);
  if (scanned.length) out.push({ status: 'todo', title: `${scanned.length === 1 ? 'Page' : 'Pages'} ${scanned.map(p => p.n + 1).join(', ')} look${scanned.length === 1 ? 's' : ''} scanned`, detail: 'There is no real text to tag. These pages need text recognition (OCR) first, which Earshot doesn’t do yet.' });

  if (S.ex && S.ex.tagged) {
    out.push({ status: 'info', title: S.source === 'existing' ? 'Starting from existing tags' : 'This file already had tags', detail: '“As it is now” previews the original tag order. Export rebuilds the structure shown in the editor; “Keep original PDF” saves every original tag unchanged.' });
    for (const issue of S.existing?.issues || []) out.push({ status: 'todo', title: 'Existing structure needs review', detail: issue });
  }
  return out;
}
