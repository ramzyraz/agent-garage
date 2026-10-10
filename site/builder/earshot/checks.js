// What still needs a person before export. Pure: reads Earshot's state.

const JUNK_TITLE = /^(untitled.*|document\d*|doc\d*|microsoft (word|powerpoint) - .*|.*\.(docx?|pptx?|pdf|indd|qxd|rtf|odt)|title|new document|\s*)$/i;

export function suggestTitle(fileTitle, blocks) {
  const t = (fileTitle || '').trim();
  if (t && !JUNK_TITLE.test(t)) return t;
  const h1 = blocks.find(b => b.type === 'h' && b.level === 1) || blocks.find(b => b.type === 'h');
  return h1 ? h1.text.slice(0, 160) : t && !JUNK_TITLE.test(t) ? t : '';
}

export function buildChecks(S) {
  const out = [];
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
    if (heads[0].level === 1 && !skip) out.push({ status: 'ok', title: `${heads.length} headings in a sensible outline`, detail: heads.slice(0, 4).map(hd => `${'  '.repeat(hd.level - 1)}H${hd.level} ${hd.text.slice(0, 40)}`).join(' · ') + (heads.length > 4 ? ' …' : '') });
  }

  bs.filter(b => b.type === 'table').forEach(t => {
    out.push(t.headerRows
      ? { status: 'ok', title: `Table on page ${t.page + 1} has column headers`, detail: `${t.rows[0].map(c => c.text).join(', ')}. Each cell will be read with its header.`, goto: t.id, gotoLabel: 'Check it' }
      : { status: 'todo', title: `Table on page ${t.page + 1} has no header row`, detail: 'Without headers, a screen reader reads cells with no context. Tick “first row holds the column headers” if it does.', goto: t.id });
  });

  const hidden = bs.filter(b => b.type === 'artifact');
  if (hidden.length) out.push({ status: 'info', title: `${hidden.length} ${hidden.length === 1 ? 'piece' : 'pieces'} of page furniture hidden`, detail: `${[...new Set(hidden.map(b => b.why))].join(', ')}. They stay visible on the page but aren’t read aloud. Check nothing important is hidden.`, goto: hidden[0].id, gotoLabel: 'Show the first' });

  let jumps = 0, prevIdx = -1;
  for (const b of real) {
    if (b.page !== (real[real.indexOf(b) - 1] || b).page) prevIdx = -1;
    if (b.fileIndex < prevIdx) jumps++;
    prevIdx = Math.max(prevIdx, b.fileIndex);
  }
  if (jumps) out.push({ status: 'info', title: 'Reading order follows the layout, not the file', detail: `The file stores its text in a different order; Earshot’s order differs from it in ${jumps} ${jumps === 1 ? 'place' : 'places'}. Press Listen to check it sounds right.` });

  const scanned = (S.ex ? S.ex.pages : []).filter(p => !p.items.some(it => it.s.trim()) && p.images.length);
  if (scanned.length) out.push({ status: 'todo', title: `${scanned.length === 1 ? 'Page' : 'Pages'} ${scanned.map(p => p.n + 1).join(', ')} look${scanned.length === 1 ? 's' : ''} scanned`, detail: 'There is no real text to tag. These pages need text recognition (OCR) first, which Earshot doesn’t do yet.' });

  if (S.ex && S.ex.tagged) out.push({ status: 'info', title: 'This file already had tags', detail: 'Downloading replaces them with the structure you see here.' });
  return out;
}
