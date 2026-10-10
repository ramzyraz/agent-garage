// Earshot UI: load a PDF, propose structure, review/fix, listen, export.
import * as pdfjs from './vendor/pdf.min.mjs';
import { extractDocument } from './extract.js';
import { analyze, fileOrder, spoken, stripBullet, union } from './analyze.js';
import { buildChecks, suggestTitle } from './checks.js';
import { toHtml } from './html.js';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;
const PDF_OPTS = {
  cMapUrl: new URL('./vendor/cmaps/', import.meta.url).href, cMapPacked: true,
  standardFontDataUrl: new URL('./vendor/standard_fonts/', import.meta.url).href,
  wasmUrl: new URL('./vendor/wasm/', import.meta.url).href,
  isEvalSupported: false,
};

const $ = s => document.querySelector(s);
const track = n => { try { window.ESAnalytics && window.ESAnalytics.track(n); } catch { /* never block */ } };
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}

const TYPE_LABEL = { h: 'Heading', p: 'Text', li: 'List item', table: 'Table', figure: 'Picture', artifact: 'Hidden' };
const LANGS = [['en-US', 'English (US)'], ['en-GB', 'English (UK)'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['pt', 'Portuguese'], ['it', 'Italian'], ['nl', 'Dutch'], ['zh', 'Chinese'], ['ja', 'Japanese'], ['ko', 'Korean'], ['ar', 'Arabic'], ['vi', 'Vietnamese'], ['tl', 'Tagalog'], ['ru', 'Russian'], ['pl', 'Polish']];

const S = {
  name: '', bytes: null, pdf: null, ex: null, blocks: [], mode: 'after', sel: null,
  title: '', lang: 'en-US', history: [], pageEls: [], scale: [], speaking: false, tab: 'order', panel: 'pages',
};
window.Earshot = S; // handy for tests and the curious

// ---------- loading ----------
async function openBytes(bytes, name, isSample) {
  const err = $('#loadError'), prog = $('#loadProgress');
  err.hidden = true;
  prog.hidden = false;
  prog.textContent = 'Reading the PDF…';
  try {
    const t0 = performance.now();
    const pdf = await pdfjs.getDocument({ ...PDF_OPTS, data: bytes.slice() }).promise;
    const ex = await extractDocument(pdfjs, pdf, (n, total) => { prog.textContent = `Reading page ${n} of ${total}…`; });
    const { blocks, bodySize } = analyze(ex.pages);
    const textChars = ex.pages.reduce((n, p) => n + p.items.reduce((m, it) => m + it.s.trim().length, 0), 0);
    if (!textChars) throw new Error('scanned');
    Object.assign(S, { name, bytes, pdf, ex, blocks, bodySize, sel: null, history: [], mode: 'before', ms: Math.round(performance.now() - t0) });
    S.title = suggestTitle(ex.title, blocks);
    S.titleFromFile = ex.title;
    S.lang = ex.lang || (navigator.language && /^en/i.test(navigator.language) ? 'en-US' : 'en-US');
    S.isSample = !!isSample;
    $('#landing').hidden = true;
    $('#app').hidden = false;
    $('#fileBar').hidden = false;
    $('#fileName').textContent = name;
    $('#fileName').title = name;
    document.title = `${name} · Earshot`;
    prog.hidden = true;
    await renderPages();
    setMode('before');
    track(isSample ? 'sample-opened' : 'file-opened');
  } catch (e) {
    console.error(e);
    prog.hidden = true;
    err.hidden = false;
    const msg = String(e && (e.name === 'PasswordException' ? 'password' : e.message));
    err.textContent = msg === 'scanned'
      ? 'This PDF has no selectable text, so it is probably a scan. Earshot needs real text; run it through text recognition (OCR) first, then try again.'
      : msg === 'password' ? 'This PDF is password-protected. Open it with the password in another app, save an unprotected copy, and try that.'
        : /Invalid PDF|FormatError|PDF header/i.test(msg) ? 'That file doesn’t look like a PDF Earshot can read. Is it really a .pdf?' : `Earshot couldn’t read this PDF: ${msg}`;
  }
}
async function openFile(f) {
  if (!f) return;
  const buf = new Uint8Array(await f.arrayBuffer());
  openBytes(buf, f.name, false);
}
async function openSample() {
  const res = await fetch('sample.pdf');
  openBytes(new Uint8Array(await res.arrayBuffer()), 'Millbrook summer programs notice.pdf', true);
}

// ---------- pages ----------
async function renderPages() {
  const host = $('#pages');
  host.textContent = '';
  S.pageEls = [];
  const width = Math.min(host.clientWidth || 700, 820) - 2;
  for (let n = 0; n < S.ex.pages.length; n++) {
    const p = S.ex.pages[n];
    const scale = width / p.w;
    const wrap = h('div', { class: 'page', style: `width:${Math.round(p.w * scale)}px;height:${Math.round(p.h * scale)}px`, 'data-page': n, role: 'group', 'aria-label': `Page ${n + 1}` });
    const canvas = h('canvas', { 'aria-hidden': 'true' });
    const overlay = h('div', { class: 'overlay' });
    wrap.append(canvas, overlay, h('span', { class: 'pageno', 'aria-hidden': 'true' }, `Page ${n + 1}`));
    host.append(wrap);
    S.pageEls[n] = { wrap, canvas, overlay, scale, drawn: false };
  }
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) drawPage(+e.target.dataset.page);
  }, { rootMargin: '600px' });
  S.pageEls.forEach(pe => io.observe(pe.wrap));
  await drawPage(0);
}
async function drawPage(n) {
  const pe = S.pageEls[n];
  if (!pe || pe.drawn) return;
  pe.drawn = true;
  const page = await S.pdf.getPage(n + 1);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const vp = page.getViewport({ scale: pe.scale * dpr });
  pe.canvas.width = Math.round(vp.width);
  pe.canvas.height = Math.round(vp.height);
  await page.render({ canvasContext: pe.canvas.getContext('2d'), viewport: vp }).promise;
}

// Units shown for a mode: in "before" mode table cells are separate, in file order.
function units() {
  if (S.mode === 'after') {
    let n = 0;
    return S.blocks.map(b => ({ b, key: String(b.id), page: b.page, bbox: b.bbox, num: b.type === 'artifact' ? null : ++n }));
  }
  const out = [];
  for (const b of S.blocks) {
    if (b.type === 'table') {
      b.rows.forEach((r, ri) => r.forEach((c, ci) => out.push({ b, key: `${b.id}:${ri}:${ci}`, page: b.page, bbox: c.bbox, text: c.text, fileIndex: Math.min(...c.items.map(it => it.i)) })));
    } else out.push({ b, key: String(b.id), page: b.page, bbox: b.bbox, text: b.text, fileIndex: b.fileIndex });
  }
  out.sort((a, c) => a.page - c.page || a.fileIndex - c.fileIndex);
  let n = 0;
  for (const u of out) u.num = u.b.type === 'figure' ? null : ++n;
  return out;
}

function drawOverlays(list) {
  for (const pe of S.pageEls) pe.overlay.textContent = '';
  for (const u of list) {
    const pe = S.pageEls[u.page];
    if (!pe || !u.bbox) continue;
    const p = S.ex.pages[u.page], s = pe.scale;
    const [x0, y0, x1, y1] = u.bbox;
    const pad = 2;
    const type = S.mode === 'before' ? (u.b.type === 'figure' ? 'figure skipped' : 'plain') : u.b.type;
    const box = h('button', {
      class: `ov t-${type}${S.sel === u.b.id ? ' sel' : ''}`, type: 'button', tabindex: '-1',
      style: `left:${x0 * s - pad}px;top:${(p.h - y1) * s - pad}px;width:${(x1 - x0) * s + 2 * pad}px;height:${(y1 - y0) * s + 2 * pad}px`,
      'data-key': u.key, 'data-id': u.b.id, 'aria-hidden': 'true',
      onclick: () => select(u.b.id, true),
    });
    if (u.num != null) box.append(h('span', { class: 'badge' }, String(u.num)));
    else if (S.mode === 'after' && u.b.type === 'artifact') box.append(h('span', { class: 'hidden-tag' }, 'hidden'));
    else if (S.mode === 'before' && u.b.type === 'figure') box.append(h('span', { class: 'hidden-tag' }, 'not announced'));
    pe.overlay.append(box);
  }
}

// ---------- mode, banner ----------
function setMode(mode) {
  stopSpeaking();
  S.mode = mode;
  document.querySelectorAll('.seg [data-mode]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.mode === mode)));
  $('#app').classList.toggle('before', mode === 'before');
  renderAll();
}
function banner() {
  const el = $('#banner');
  el.textContent = '';
  const c = count();
  if (S.mode === 'before') {
    const order = units().filter(u => u.num != null);
    const moved = disorder(order);
    el.className = 'banner warn';
    el.append(
      h('strong', {}, S.ex.tagged ? 'This PDF already has tags. ' : 'This PDF has no tags. '),
      S.ex.tagged
        ? `Below is the order its text is stored in. Earshot proposes a fresh structure from the page layout; comparing it with the existing tags is coming next.`
        : `A screen reader has to guess what is a heading, list or table, and many read text in the order it is stored in the file. Here that order ${moved ? `jumps around the page ${moved} times` : 'follows the page'}, includes ${c.artifacts} pieces of repeated page furniture and skips ${c.figures} ${c.figures === 1 ? 'picture' : 'pictures'}. Nothing is marked as a heading.`,
      ' ',
      h('button', { class: 'linkish', type: 'button', onclick: () => setMode('after') }, 'See Earshot’s fix →'),
    );
  } else {
    el.className = 'banner ok';
    const chk = buildChecks(S);
    const todo = chk.filter(x => x.status === 'todo').length;
    el.append(
      h('strong', {}, `Earshot found ${c.headings} headings, ${c.paragraphs} paragraphs${c.lists ? `, ${c.lists} list items` : ''}${c.tables ? `, ${c.tables} ${c.tables === 1 ? 'table' : 'tables'}` : ''}${c.figures ? ` and ${c.figures} ${c.figures === 1 ? 'picture' : 'pictures'}` : ''}`),
      ` across ${S.ex.pages.length} ${S.ex.pages.length === 1 ? 'page' : 'pages'}, and hid ${c.artifacts} pieces of page furniture. `,
      todo ? h('button', { class: 'linkish', type: 'button', onclick: () => showTab('checks') }, `${todo} ${todo === 1 ? 'thing needs' : 'things need'} you before export →`) : 'Ready to export. Check the order and wording once more before you publish.',
    );
  }
}
function count() {
  const bs = S.blocks;
  return {
    headings: bs.filter(b => b.type === 'h').length, paragraphs: bs.filter(b => b.type === 'p').length,
    lists: bs.filter(b => b.type === 'li').length, tables: bs.filter(b => b.type === 'table').length,
    figures: bs.filter(b => b.type === 'figure').length, artifacts: bs.filter(b => b.type === 'artifact').length,
  };
}
// How many times reading goes back up the page or across columns, against the proposed order.
function disorder(order) {
  const pos = new Map();
  let n = 0;
  for (const b of S.blocks) if (b.type !== 'artifact') pos.set(b.id, n++);
  let jumps = 0, prev = -1;
  for (const u of order) {
    const p = pos.has(u.b.id) ? pos.get(u.b.id) : null;
    if (p == null) continue;
    if (p < prev) jumps++;
    prev = p;
  }
  return jumps;
}

// ---------- reading order list ----------
function renderAll() {
  const list = units();
  drawOverlays(list);
  renderList(list);
  renderChecks();
  banner();
  $('#undo').disabled = !S.history.length;
}
function renderList(list) {
  const ol = $('#order');
  ol.textContent = '';
  ol.classList.toggle('readonly', S.mode === 'before');
  $('#keys').hidden = S.mode === 'before';
  let lastPage = -1;
  for (const u of list) {
    if (u.page !== lastPage) {
      ol.append(h('li', { class: 'pagehead', 'aria-hidden': 'true' }, `Page ${u.page + 1}`));
      lastPage = u.page;
    }
    const b = u.b;
    if (S.mode === 'before') {
      const isFig = b.type === 'figure';
      ol.append(h('li', { class: `item plain${isFig ? ' skipped' : ''}`, 'data-key': u.key },
        h('span', { class: 'num' }, u.num != null ? String(u.num) : '–'),
        h('div', { class: 'body' }, h('span', { class: 'chip c-plain' }, isFig ? 'Picture: skipped' : 'Text'), h('p', { class: 'txt' }, isFig ? 'No description, so a screen reader doesn’t know it’s here.' : (u.text || b.text)))));
      continue;
    }
    const selected = S.sel === b.id;
    const li = h('li', {
      class: `item t-${b.type}${selected ? ' sel' : ''}`, 'data-id': b.id, tabindex: selected || (S.sel == null && u === list[0]) ? '0' : '-1',
      'aria-selected': String(selected), role: 'option',
      'aria-label': `${u.num != null ? u.num + '. ' : ''}${label(b)}: ${preview(b)}`,
      onclick: e => { if (!e.target.closest('.editor')) select(b.id); },
    },
    h('span', { class: 'num', 'aria-hidden': 'true' }, u.num != null ? String(u.num) : ''),
    h('div', { class: 'body' },
      h('span', { class: `chip c-${b.type}` }, label(b)),
      b.type === 'figure' && !b.alt ? h('span', { class: 'flag' }, 'needs a description') : null,
      h('p', { class: 'txt' }, preview(b)),
      b.why && b.type !== 'p' ? h('p', { class: 'why' }, b.type === 'artifact' ? `${b.why}: not read aloud` : b.why) : null,
      selected ? editor(b) : null));
    ol.append(li);
  }
  ol.setAttribute('role', S.mode === 'after' ? 'listbox' : 'list');
  ol.setAttribute('aria-label', S.mode === 'after' ? 'Reading order with Earshot’s fixes' : 'Reading order as stored in the file');
}
function label(b) {
  if (b.type === 'h') return `Heading ${b.level}`;
  return TYPE_LABEL[b.type];
}
function preview(b) {
  if (b.type === 'figure') return b.alt || 'Picture with no description yet';
  if (b.type === 'table') return `${b.rows.length} rows × ${b.rows[0].length} columns${b.headerRows ? `, headers: ${b.rows[0].map(c => c.text).join(' · ')}` : ', no header row'}`;
  if (b.type === 'li') return stripBullet(b.text);
  return b.text;
}

function editor(b) {
  const ed = h('div', { class: 'editor', role: 'group', 'aria-label': 'Fix this piece' });
  const typeBtn = (lbl, fn, on, key) => h('button', { type: 'button', class: `tbtn${on ? ' on' : ''}`, 'aria-pressed': String(!!on), title: key ? `Shortcut: ${key}` : null, onclick: fn }, lbl);
  if (b.type === 'figure') {
    const ta = h('textarea', { rows: '3', 'aria-label': 'Picture description (alt text)', placeholder: 'Describe what matters in this picture, e.g. “Two canoes on a pond below green hills”.' });
    ta.value = b.alt || '';
    ta.addEventListener('change', () => { mutate(() => { b.alt = ta.value.trim(); }); });
    ta.addEventListener('keydown', e => e.stopPropagation());
    ed.append(h('label', { class: 'lbl' }, 'Picture description'), ta,
      h('p', { class: 'hint' }, 'Say what a sighted reader gets from it, in a sentence. Don’t start with “image of”.'),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'tbtn', onclick: () => mutate(() => { b.type = 'artifact'; b.why = 'Decorative picture'; }) }, 'It’s decorative: hide it')));
  } else if (b.type === 'table') {
    const grid = h('table', { class: 'mini' });
    b.rows.slice(0, 8).forEach((r, ri) => grid.append(h('tr', {}, r.map(c => h(ri < b.headerRows ? 'th' : 'td', {}, c.text)))));
    const cb = h('input', { type: 'checkbox', id: 'hdr' + b.id });
    cb.checked = !!b.headerRows;
    cb.addEventListener('change', () => mutate(() => { b.headerRows = cb.checked ? 1 : 0; }));
    ed.append(grid, h('label', { class: 'check' }, cb, ' First row holds the column headers'),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'tbtn', onclick: () => tableToText(b) }, 'Not a table: make it text')));
  } else if (b.type === 'artifact') {
    ed.append(h('p', { class: 'hint' }, 'Hidden pieces stay on the page but screen readers skip them. Use this for page numbers, running headers and decoration.'),
      h('div', { class: 'row' }, b.image ? h('button', { type: 'button', class: 'tbtn', onclick: () => mutate(() => { b.type = 'figure'; b.alt = b.alt || ''; b.why = 'Picture'; }) }, 'Unhide as a picture') : typeBtn('Unhide as text', () => setType(b, 'p'), false, 'P')));
  } else {
    ed.append(h('div', { class: 'row', role: 'group', 'aria-label': 'What is this?' },
      [1, 2, 3, 4].map(l => typeBtn(`H${l}`, () => setType(b, 'h', l), b.type === 'h' && b.level === l, String(l))),
      typeBtn('Text', () => setType(b, 'p'), b.type === 'p', 'P'),
      typeBtn('List item', () => setType(b, 'li'), b.type === 'li', 'L'),
      typeBtn('Hide', () => setType(b, 'artifact'), false, 'H')));
  }
  const i = S.blocks.indexOf(b);
  const next = S.blocks[i + 1];
  ed.append(h('div', { class: 'row move', role: 'group', 'aria-label': 'Order' },
    h('button', { type: 'button', class: 'tbtn', disabled: i === 0, onclick: () => move(b, -1), title: 'Alt+↑' }, '↑ Read earlier'),
    h('button', { type: 'button', class: 'tbtn', disabled: i === S.blocks.length - 1, onclick: () => move(b, 1), title: 'Alt+↓' }, '↓ Read later'),
    canMerge(b, next) ? h('button', { type: 'button', class: 'tbtn', onclick: () => merge(b), title: 'M' }, 'Merge with next') : null));
  return ed;
}

// ---------- edits ----------
function snapshot() {
  return S.blocks.map(b => ({ ...b, rows: b.rows && b.rows.map(r => r.slice()), items: b.items.slice(), lines: b.lines && b.lines.slice() }));
}
function mutate(fn, keepSel) {
  S.history.push({ blocks: snapshot(), sel: S.sel });
  if (S.history.length > 100) S.history.shift();
  fn();
  if (!keepSel && S.sel != null && !S.blocks.some(b => b.id === S.sel)) S.sel = null;
  renderAll();
  focusSel();
}
function undo() {
  const last = S.history.pop();
  if (!last) return;
  S.blocks = last.blocks;
  S.sel = last.sel;
  renderAll();
  focusSel();
}
function setType(b, type, level) {
  mutate(() => {
    b.type = type;
    if (type === 'h') b.level = level || b.level || 2; else delete b.level;
    b.why = type === 'artifact' ? 'Hidden by you' : 'Set by you';
  });
}
function move(b, d) {
  const i = S.blocks.indexOf(b), j = i + d;
  if (j < 0 || j >= S.blocks.length) return;
  mutate(() => { [S.blocks[i], S.blocks[j]] = [S.blocks[j], S.blocks[i]]; });
}
function canMerge(b, next) {
  return next && next.page === b.page && ['p', 'h', 'li'].includes(b.type) && ['p', 'h', 'li'].includes(next.type);
}
function merge(b) {
  const i = S.blocks.indexOf(b), next = S.blocks[i + 1];
  if (!canMerge(b, next)) return;
  mutate(() => {
    b.items = b.items.concat(next.items);
    b.lines = (b.lines || []).concat(next.lines || []);
    b.text = `${b.text} ${b.type === 'li' ? next.text : next.text}`.replace(/\s+/g, ' ').trim();
    b.bbox = union([b.bbox, next.bbox]);
    b.fileIndex = Math.min(b.fileIndex, next.fileIndex);
    S.blocks.splice(i + 1, 1);
  });
}
function tableToText(b) {
  mutate(() => {
    const i = S.blocks.indexOf(b);
    let id = Math.max(...S.blocks.map(x => x.id)) + 1;
    const rows = b.rows.map(r => {
      const items = r.flatMap(c => c.items);
      return { id: id++, page: b.page, type: 'p', text: r.map(c => c.text).join('  '), items, bbox: union(r.map(c => c.bbox)), why: 'Set by you', fileIndex: Math.min(...items.map(it => it.i)) };
    });
    S.blocks.splice(i, 1, ...rows);
    S.sel = rows[0].id;
  }, true);
}

// ---------- selection & keyboard ----------
function select(id, fromPage) {
  if (S.mode === 'before') { setMode('after'); }
  S.sel = id;
  renderAll();
  if (window.matchMedia('(max-width: 899px)').matches && fromPage) showPanel('order');
  showTab('order');
  focusSel(true);
}
function focusSel(scroll) {
  const li = S.sel != null && document.querySelector(`#order .item[data-id="${S.sel}"]`);
  if (li) {
    li.focus({ preventScroll: true });
    if (scroll !== false) li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  const ov = S.sel != null && document.querySelector(`.ov[data-id="${S.sel}"]`);
  if (ov && scroll) ov.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
$('#order').addEventListener('keydown', e => {
  if (S.mode !== 'after' || e.target.closest('textarea, input')) return;
  const real = S.blocks;
  const i = real.findIndex(b => b.id === S.sel);
  const b = real[i];
  const k = e.key;
  if ((k === 'ArrowDown' || k === 'ArrowUp') && e.altKey && b) { e.preventDefault(); move(b, k === 'ArrowDown' ? 1 : -1); return; }
  if (k === 'ArrowDown' || k === 'j') { e.preventDefault(); S.sel = real[Math.min(real.length - 1, i + 1)].id; renderAll(); focusSel(); highlightPage(); return; }
  if (k === 'ArrowUp' || k === 'k') { e.preventDefault(); S.sel = real[Math.max(0, i - 1)].id; renderAll(); focusSel(); highlightPage(); return; }
  if (!b || e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^[1-6]$/.test(k) && ['p', 'h', 'li'].includes(b.type)) { e.preventDefault(); setType(b, 'h', +k); }
  else if (k === 'p' && ['h', 'li', 'artifact'].includes(b.type) && !b.image) { e.preventDefault(); setType(b, 'p'); }
  else if (k === 'l' && ['p', 'h'].includes(b.type)) { e.preventDefault(); setType(b, 'li'); }
  else if (k === 'h' && ['p', 'h', 'li'].includes(b.type)) { e.preventDefault(); setType(b, 'artifact'); }
  else if (k === 'm') { e.preventDefault(); merge(b); }
});
function highlightPage() {
  const ov = document.querySelector(`.ov[data-id="${S.sel}"]`);
  if (ov) ov.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.target.closest('textarea, input') && !$('#app').hidden) { e.preventDefault(); undo(); }
  if (e.key === 'Escape' && S.speaking) stopSpeaking();
});

// ---------- checks panel ----------
function renderChecks() {
  const panel = $('#checksPanel');
  panel.textContent = '';
  const checks = buildChecks(S);
  const todo = checks.filter(c => c.status === 'todo').length;
  $('#checkCount').textContent = todo ? String(todo) : '✓';
  $('#mCheckCount').textContent = todo ? String(todo) : '✓';
  const titleIn = h('input', { type: 'text', id: 'docTitle', value: S.title, placeholder: 'e.g. Summer Recreation Programs 2027' });
  titleIn.addEventListener('input', () => { S.title = titleIn.value; });
  titleIn.addEventListener('change', () => renderAll());
  const langSel = h('select', { id: 'docLang' }, LANGS.map(([v, l]) => h('option', { value: v, selected: v === S.lang }, l)));
  if (!LANGS.some(l => l[0] === S.lang)) langSel.prepend(h('option', { value: S.lang, selected: true }, S.lang));
  langSel.addEventListener('change', () => { S.lang = langSel.value; renderAll(); });
  panel.append(
    h('div', { class: 'field' }, h('label', { for: 'docTitle' }, 'Document title'), titleIn,
      h('p', { class: 'hint' }, S.titleFromFile && S.titleFromFile !== S.title ? `The file’s own title is “${S.titleFromFile}”. Screen readers announce the title first, so make it say what the document is.` : 'Screen readers announce this first, and it shows in the window title.')),
    h('div', { class: 'field' }, h('label', { for: 'docLang' }, 'Language'), langSel, h('p', { class: 'hint' }, 'So the screen reader uses the right voice and pronunciation.')),
    h('ul', { class: 'checks' }, checks.map(c => h('li', { class: `chk s-${c.status}` },
      h('span', { class: 'ico', 'aria-hidden': 'true' }, c.status === 'ok' ? '✓' : c.status === 'todo' ? '!' : 'i'),
      h('div', {}, h('strong', {}, c.title), h('p', {}, c.detail),
        c.goto != null ? h('button', { type: 'button', class: 'linkish', onclick: () => { select(c.goto, true); } }, c.gotoLabel || 'Show me') : null)))),
    h('p', { class: 'honest' }, 'Automated checks can’t tell whether a description is accurate or the order makes sense to a person. That judgement is the part you’re doing here, and it is why Earshot never calls a file “compliant”.'),
  );
}
function showTab(tab) {
  S.tab = tab;
  document.querySelectorAll('.side-tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  $('#orderPanel').hidden = tab !== 'order';
  $('#checksPanel').hidden = tab !== 'checks';
  if (window.matchMedia('(max-width: 899px)').matches) showPanel(tab);
}
function showPanel(p) {
  S.panel = p;
  document.querySelectorAll('.mtabs [data-panel]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.panel === p)));
  $('#app').dataset.panel = p;
  if (p !== 'pages') {
    $('#orderPanel').hidden = p !== 'order';
    $('#checksPanel').hidden = p !== 'checks';
    document.querySelectorAll('.side-tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === p)));
  }
}

// ---------- listen ----------
function speechList() {
  if (S.mode === 'before') return units().filter(u => u.num != null).map(u => ({ key: u.key, id: u.b.id, text: u.text || u.b.text }));
  const out = [];
  if (S.title) out.push({ id: null, text: `Document: ${S.title}.` });
  let prevList = false;
  for (const b of S.blocks) {
    if (b.type === 'artifact') continue;
    let t = spoken(b);
    if (b.type === 'li' && !prevList) {
      const n = countRun(b);
      t = `List, ${n} ${n === 1 ? 'item' : 'items'}. ${t}`;
    }
    prevList = b.type === 'li';
    out.push({ id: b.id, key: String(b.id), text: t });
  }
  return out;
}
function countRun(b) {
  let i = S.blocks.indexOf(b), n = 0;
  while (i < S.blocks.length && (S.blocks[i].type === 'li' || S.blocks[i].type === 'artifact')) { if (S.blocks[i].type === 'li') n++; i++; }
  return n;
}
function speak() {
  if (S.speaking) { stopSpeaking(); return; }
  if (!('speechSynthesis' in window)) {
    $('#banner').textContent = 'This browser can’t read aloud. The reading-order list shows exactly what would be read.';
    return;
  }
  const queue = speechList();
  S.speaking = true;
  $('#listen').setAttribute('aria-pressed', 'true');
  $('#listen').innerHTML = '<span aria-hidden="true">■</span> Stop';
  track('listened');
  let k = 0;
  const next = () => {
    if (!S.speaking || k >= queue.length) { stopSpeaking(); return; }
    const q = queue[k++];
    document.querySelectorAll('.speaking').forEach(e => e.classList.remove('speaking'));
    if (q.key) {
      const sel = S.mode === 'before' ? `[data-key="${q.key}"]` : `[data-id="${q.id}"]`;
      document.querySelectorAll(`.ov${sel}, #order .item${sel}`).forEach(e => e.classList.add('speaking'));
      const ov = document.querySelector(`.ov${sel}`);
      if (ov) ov.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    const u = new SpeechSynthesisUtterance(q.text);
    u.lang = S.lang;
    u.rate = 1.05;
    u.onend = next;
    u.onerror = next;
    speechSynthesis.speak(u);
  };
  speechSynthesis.cancel();
  next();
}
function stopSpeaking() {
  if (!S.speaking) return;
  S.speaking = false;
  try { speechSynthesis.cancel(); } catch { /* none */ }
  document.querySelectorAll('.speaking').forEach(e => e.classList.remove('speaking'));
  $('#listen').setAttribute('aria-pressed', 'false');
  $('#listen').innerHTML = '<span aria-hidden="true">▶</span> Listen';
}

// ---------- export ----------
function baseName() {
  return (S.name || 'document.pdf').replace(/\.pdf$/i, '');
}
function download(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
async function exportPdf() {
  const btn = $('#exportPdf');
  btn.disabled = true;
  btn.textContent = 'Writing tags…';
  try {
    const L = await import('./vendor/pdf-lib.esm.min.js');
    const { tagPdf } = await import('./tagger.js');
    const { bytes, report } = await tagPdf(L, S.bytes, { pages: S.ex.pages, blocks: S.blocks, title: S.title, lang: S.lang });
    const verify = await verifyTagged(bytes);
    S.lastExport = { report, verify, size: bytes.length };
    const name = `${baseName()} (tagged).pdf`;
    download(bytes, name, 'application/pdf');
    track('pdf-exported');
    showResult(name, report, verify);
  } catch (e) {
    console.error(e);
    showError(/encrypt/i.test(String(e && e.message)) ? 'This PDF is encrypted, so Earshot can’t rewrite it. Save an unencrypted copy and try again.' : `Earshot couldn’t write the tagged PDF: ${e && e.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Download tagged PDF';
  }
}
// Re-open the written file with pdf.js and count what a reader will find.
async function verifyTagged(bytes) {
  const doc = await pdfjs.getDocument({ ...PDF_OPTS, data: bytes.slice() }).promise;
  const roles = {};
  let untagged = 0, tagged = 0, realChars = 0;
  const alnum = t => (t.match(/[\p{L}\p{N}]/gu) || []).length;
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const tree = await page.getStructTree();
    (function walk(x) { if (x.role && x.role !== 'Root') roles[x.role] = (roles[x.role] || 0) + 1; (x.children || []).forEach(walk); })(tree || {});
    const tc = await page.getTextContent({ includeMarkedContent: true });
    const stack = [];
    for (const it of tc.items) {
      if (it.type === 'beginMarkedContent' || it.type === 'beginMarkedContentProps') stack.push(it.tag);
      else if (it.type === 'endMarkedContent') stack.pop();
      else if (it.str && it.str.trim()) {
        if (stack.length) tagged++; else untagged++;
        if (stack.length && !stack.includes('Artifact')) realChars += alnum(it.str);
      }
    }
  }
  // Characters the reviewed structure says should be read aloud.
  let expected = 0;
  for (const b of S.blocks) {
    if (b.type === 'artifact' || b.type === 'figure') continue;
    expected += b.rows ? b.rows.flat().reduce((k, c) => k + alnum(c.text), 0) : alnum(b.text || '');
  }
  const md = await doc.getMetadata();
  const mark = await doc.getMarkInfo();
  doc.destroy();
  return { roles, untagged, tagged, realChars, expected, title: md.info.Title || '', marked: !!(mark && mark.Marked) };
}
function showResult(name, report, verify) {
  const body = $('#resultBody');
  body.textContent = '';
  const roleOrder = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'L', 'LI', 'Table', 'TH', 'TD', 'Figure', 'Link'];
  const roles = roleOrder.filter(r => verify.roles[r]).map(r => `${r} ×${verify.roles[r]}`).join(' · ');
  const warn = [];
  if (report.figuresWithoutAlt) warn.push(`${report.figuresWithoutAlt} ${report.figuresWithoutAlt === 1 ? 'picture has' : 'pictures have'} no description yet. Validators will flag ${report.figuresWithoutAlt === 1 ? 'it' : 'them'}.`);
  if (report.unembeddedFonts.length) warn.push(`Fonts not embedded in the original: ${[...new Set(report.unembeddedFonts)].join(', ')}. PDF/UA requires embedded fonts; Earshot can’t add them yet.`);
  if (report.unmatchedText) warn.push(`${report.unmatchedText} text drawing ${report.unmatchedText === 1 ? 'operation' : 'operations'} didn’t match any piece and ${report.unmatchedText === 1 ? 'was' : 'were'} hidden. Check the file in a screen reader.`);
  if (report.emptyLeaves.length) warn.push(`${report.emptyLeaves.length} ${report.emptyLeaves.length === 1 ? 'piece' : 'pieces'} couldn’t be matched to the file’s drawing instructions and ${report.emptyLeaves.length === 1 ? 'is' : 'are'} missing from the tags.`);
  if (report.formsWithText) warn.push(`${report.formsWithText} reusable drawing ${report.formsWithText === 1 ? 'group contains' : 'groups contain'} text; ${report.formsWithText === 1 ? 'it was' : 'they were'} tagged as one piece.`);
  if (report.fieldsWithoutName) warn.push(`${report.fieldsWithoutName} form ${report.fieldsWithoutName === 1 ? 'field has' : 'fields have'} no name (tooltip). Screen readers will announce ${report.fieldsWithoutName === 1 ? 'it' : 'them'} without a label; Earshot can’t name fields yet.`);
  if (verify.expected && verify.realChars < verify.expected * 0.995) warn.push(`Some text you kept (${verify.expected - verify.realChars} characters) ended up hidden. Earshot couldn’t place it exactly on the page; rotated text and charts are the usual cause.`);
  if (!S.title.trim()) warn.push('The document has no title.');
  body.append(
    h('h2', { id: 'resultTitle' }, warn.length ? 'Saved, with things to check' : 'Saved your tagged PDF'),
    h('p', { class: 'fname2' }, name),
    h('ul', { class: 'facts' },
      h('li', {}, h('strong', {}, `${verify.tagged} of ${verify.tagged + verify.untagged}`), ' text pieces are inside tags or marked as page furniture (Earshot re-opened the file to check).'),
      verify.expected ? h('li', {}, h('strong', {}, `${pct(verify.realChars, verify.expected)}`), ' of the text you kept is tagged to be read aloud.') : null,
      h('li', {}, h('strong', {}, 'Structure: '), roles || 'none'),
      h('li', {}, h('strong', {}, 'Title: '), verify.title || '(none)', ' · ', h('strong', {}, 'Language: '), S.lang),
      report.links ? h('li', {}, `${report.links} ${report.links === 1 ? 'link' : 'links'} tagged with descriptions.`) : null,
      report.forms ? h('li', {}, `${report.forms} form ${report.forms === 1 ? 'field' : 'fields'} tagged.`) : null),
    warn.length ? h('ul', { class: 'warns' }, warn.map(w => h('li', {}, w))) : '',
    h('p', { class: 'hint' }, 'Next: open it with a screen reader (NVDA is free) or check it with PAC or veraPDF. Automated checks can’t judge whether your descriptions and order make sense, so a person should always do a final read.'),
  );
  $('#result').showModal();
}
function pct(a, b) {
  const v = b ? (100 * Math.min(a, b)) / b : 100;
  return `${v >= 99.95 ? 100 : v.toFixed(1)}%`;
}
function showError(msg) {
  const body = $('#resultBody');
  body.textContent = '';
  body.append(h('h2', { id: 'resultTitle' }, 'Something went wrong'), h('p', {}, msg));
  $('#result').showModal();
}
async function exportHtml() {
  const btn = $('#exportHtml');
  btn.disabled = true;
  try {
    const crops = {};
    for (const b of S.blocks.filter(x => x.type === 'figure')) crops[b.id] = await cropFigure(b);
    const html = toHtml(S, crops);
    download(new TextEncoder().encode(html), `${baseName()} (accessible).html`, 'text/html');
    track('html-exported');
  } catch (e) {
    console.error(e);
    showError(`Earshot couldn’t write the HTML version: ${e && e.message}`);
  } finally { btn.disabled = false; }
}
async function cropFigure(b) {
  const page = await S.pdf.getPage(b.page + 1);
  const p = S.ex.pages[b.page];
  const scale = 2;
  const vp = page.getViewport({ scale });
  const c = document.createElement('canvas');
  c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  const [x0, y0, x1, y1] = b.bbox;
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round((x1 - x0) * scale)); out.height = Math.max(1, Math.round((y1 - y0) * scale));
  out.getContext('2d').drawImage(c, x0 * scale, (p.h - y1) * scale, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL('image/jpeg', 0.86);
}

// ---------- wiring ----------
const drop = $('#drop');
$('#file').addEventListener('change', e => openFile(e.target.files[0]));
drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#file').click(); } });
['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => openFile(e.dataTransfer.files[0]));
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files[0]) openFile(e.dataTransfer.files[0]); });
$('#trySample').addEventListener('click', openSample);
$('#openAnother').addEventListener('click', () => { stopSpeaking(); $('#file').value = ''; $('#file').click(); });
document.querySelectorAll('.seg [data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
document.querySelectorAll('.side-tabs [data-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
document.querySelectorAll('.mtabs [data-panel]').forEach(b => b.addEventListener('click', () => showPanel(b.dataset.panel)));
$('#listen').addEventListener('click', speak);
$('#undo').addEventListener('click', undo);
$('#exportPdf').addEventListener('click', exportPdf);
$('#exportHtml').addEventListener('click', exportHtml);
let resizeT;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(async () => {
    if (!S.ex) return;
    const w = Math.min($('#pages').clientWidth, 820) - 2;
    if (S.pageEls[0] && Math.abs(S.pageEls[0].scale * S.ex.pages[0].w - w) < 8) return;
    await renderPages();
    renderAll();
  }, 250);
});
showPanel('pages');
if (location.hash === '#sample') openSample();
window.addEventListener('hashchange', () => { if (location.hash === '#sample') openSample(); });
