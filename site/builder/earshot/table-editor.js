import { regionItems, suggestGrid, regionTable } from './table.js';
import { spoken } from './analyze.js';

export async function editTable({ state: S, h, onApply, onError }, block) {
  const dialog = h('dialog', { class: 'table-dialog', 'aria-labelledby': 'tableTitle' });
  const pageSelect = h('select', { 'aria-label': 'Table page' }, S.ex.pages.map((p, i) => h('option', { value: i }, `Page ${i + 1}`)));
  pageSelect.value = String(block?.page || 0);
  const stage = h('canvas', { class: 'table-stage', 'aria-label': 'Drag a rectangle around the table on this page' });
  const instruction = h('p', { class: 'hint' }, 'Drag a rectangle around the whole table, including its headers. Or select text pieces with the keyboard-accessible list below.');
  const choices = h('div', { class: 'region-choices' });
  const controls = h('div', { class: 'table-controls', hidden: true });
  const preview = h('div', { class: 'table-preview', 'aria-live': 'polite' });
  const apply = h('button', { type: 'button', class: 'primary', disabled: true }, 'Use this table');
  const status = h('p', { class: 'load-error', role: 'alert', hidden: true });
  const again = h('button', { type: 'button', class: 'ghost', hidden: true }, 'Choose region again');
  const cancel = h('button', { type: 'button', class: 'ghost', onclick: () => dialog.close() }, 'Cancel');
  dialog.append(h('h2', { id: 'tableTitle' }, 'Make a table'), instruction,
    h('div', { class: 'row' }, pageSelect, again),
    h('div', { class: 'table-layout' }, h('div', {}, stage, choices), h('div', {}, controls, preview)), status,
    h('div', { class: 'row table-actions' }, cancel, apply));
  document.body.append(dialog);
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.showModal();
  let page, vp, source, box = null, cutsX = [], cutsY = [], draft, drawing = null, token = 0;
  let headerRows = block?.type === 'table' ? block.headerRows : 1;
  let headerCols = block?.headerCols || 0;
  const point = e => {
    const r = stage.getBoundingClientRect();
    return [Math.max(0, Math.min(stage.width, (e.clientX - r.left) * stage.width / r.width)),
      Math.max(0, Math.min(stage.height, (e.clientY - r.top) * stage.height / r.height))];
  };
  function paint(rect) {
    const ctx = stage.getContext('2d');
    stage.width = source.width; stage.height = source.height;
    ctx.drawImage(source, 0, 0);
    if (rect) { ctx.strokeStyle = '#d8572a'; ctx.lineWidth = 3; ctx.strokeRect(rect[0], rect[1], rect[2] - rect[0], rect[3] - rect[1]); }
  }
  async function loadPage() {
    const own = ++token;
    box = null; apply.disabled = true; controls.hidden = true; again.hidden = true; preview.textContent = ''; choices.textContent = '';
    page = S.ex.pages[+pageSelect.value];
    const pdfPage = await S.pdf.getPage(page.n + 1);
    const natural = pdfPage.getViewport({ scale: 1 });
    vp = pdfPage.getViewport({ scale: Math.min(700 / natural.width, 650 / natural.height) });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    await pdfPage.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    if (own !== token || !dialog.isConnected) return;
    source = c;
    paint();
    instruction.textContent = 'Drag around the whole table. On a phone, use your finger. Or tick its text pieces below and choose “Use selected pieces”.';
    const selections = new Set();
    const list = h('details', {}, h('summary', {}, 'Select pieces instead of drawing'));
    const pick = h('button', { type: 'button', class: 'ghost', disabled: true, onclick: () => {
      const boxes = [...selections].map(b => b.bbox);
      choose([Math.min(...boxes.map(b => b[0])) - 2, Math.min(...boxes.map(b => b[1])) - 2,
        Math.max(...boxes.map(b => b[2])) + 2, Math.max(...boxes.map(b => b[3])) + 2]);
    } }, 'Use selected pieces');
    for (const b of S.blocks.filter(b => b.page === page.n && b.items.length)) {
      const cb = h('input', { type: 'checkbox' });
      cb.addEventListener('change', () => { cb.checked ? selections.add(b) : selections.delete(b); pick.disabled = !selections.size; });
      list.append(h('label', { class: 'check' }, cb, b.text.slice(0, 100)));
    }
    list.append(pick); choices.append(list);
    if ((block?.type === 'table' || block?.reviewRegion) && block.page === page.n) {
      choose(block.reviewRegion || block.tableGrid?.box || block.bbox, block.tableGrid);
      block = null;
    }
  }
  function choose(b, grid) {
    box = b;
    ({ cutsX, cutsY } = grid ? { cutsX: grid.cutsX.slice(), cutsY: grid.cutsY.slice() } : suggestGrid(regionItems(page, box), box));
    choices.textContent = ''; again.hidden = false; controls.hidden = false;
    instruction.textContent = 'Check the cells below. Change the row or column count, then move a divider if text belongs in the next cell. Text on the original page stays unchanged.';
    renderControls(); update();
  }
  function renderControls() {
    controls.textContent = '';
    for (const [label, axis, max] of [['Rows', 'y', 40], ['Columns', 'x', 12]]) {
      const cuts = axis === 'x' ? cutsX : cutsY;
      const count = h('input', { type: 'number', min: 2, max, value: cuts.length + 1, 'aria-label': label });
      count.addEventListener('change', () => {
        const n = Math.max(2, Math.min(max, Math.round(+count.value || 2)));
        const vals = Array.from({ length: n - 1 }, (_, i) => axis === 'x'
          ? box[0] + (box[2] - box[0]) * (i + 1) / n : box[3] - (box[3] - box[1]) * (i + 1) / n);
        if (axis === 'x') cutsX = vals; else cutsY = vals;
        renderControls(); update();
      });
      controls.append(h('label', { class: 'table-count' }, label, count));
      const dividers = h('details', {}, h('summary', {}, `Adjust ${axis === 'x' ? 'column' : 'row'} dividers`));
      cuts.forEach((cut, i) => {
        const lo = axis === 'x' ? box[0] : box[1], hi = axis === 'x' ? box[2] : box[3];
        const pct = axis === 'x' ? (cut - lo) / (hi - lo) * 100 : (hi - cut) / (hi - lo) * 100;
        const range = h('input', { type: 'range', min: 1, max: 99, step: .1, value: pct, 'aria-label': `${label} divider ${i + 1}` });
        range.addEventListener('input', () => {
          const v = +range.value / 100;
          cuts[i] = axis === 'x' ? lo + v * (hi - lo) : hi - v * (hi - lo);
          // Dividers cannot cross; that would make the controls change identity.
          const valid = axis === 'x' ? cuts.every((x, k) => !k || x > cuts[k - 1]) : cuts.every((y, k) => !k || y < cuts[k - 1]);
          if (!valid) { cuts[i] = cut; range.value = pct; }
          update();
        });
        dividers.append(h('label', { class: 'divider-control' }, `Divider ${i + 1}`, range));
      });
      controls.append(dividers);
    }
    for (const [label, key] of [['First row holds column headers', 'row'], ['First column holds row headers', 'col']]) {
      const cb = h('input', { type: 'checkbox' }); cb.checked = key === 'row' ? !!headerRows : !!headerCols;
      cb.addEventListener('change', () => { if (key === 'row') headerRows = +cb.checked; else headerCols = +cb.checked; update(); });
      controls.append(h('label', { class: 'check' }, cb, label));
    }
  }
  function update() {
    draft = regionTable(page, box, cutsX, cutsY, { headerRows, headerCols });
    const toView = (x, y) => vp.convertToViewportPoint(x + page.ox, y + page.oy);
    const a = toView(box[0], box[1]), b = toView(box[2], box[3]);
    const x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]), w = Math.abs(a[0] - b[0]), ht = Math.abs(a[1] - b[1]);
    const zoom = Math.min(2, 700 / Math.max(1, w));
    stage.width = Math.max(1, Math.round(w * zoom)); stage.height = Math.max(1, Math.round(ht * zoom));
    const ctx = stage.getContext('2d'); ctx.drawImage(source, x, y, w, ht, 0, 0, stage.width, stage.height);
    ctx.strokeStyle = '#d8572a'; ctx.lineWidth = 2;
    for (const v of cutsX) { const p = toView(v, box[1]), q = toView(v, box[3]); ctx.beginPath(); ctx.moveTo((p[0] - x) * zoom, (p[1] - y) * zoom); ctx.lineTo((q[0] - x) * zoom, (q[1] - y) * zoom); ctx.stroke(); }
    for (const v of cutsY) { const p = toView(box[0], v), q = toView(box[2], v); ctx.beginPath(); ctx.moveTo((p[0] - x) * zoom, (p[1] - y) * zoom); ctx.lineTo((q[0] - x) * zoom, (q[1] - y) * zoom); ctx.stroke(); }
    preview.textContent = '';
    const grid = h('table', { class: 'mini' });
    draft.rows.forEach((r, ri) => grid.append(h('tr', {}, r.map((c, ci) => h(ri < headerRows || ci < headerCols ? 'th' : 'td', {}, c.text || '(empty)')))));
    preview.append(h('h3', {}, 'How the table will read'), h('div', { class: 'table-scroll' }, grid), h('p', { class: 'hint' }, spoken(draft)));
    if (draft.rows.some(r => r.some(c => !c.items.length))) preview.append(h('p', { class: 'hint' }, 'There are empty cells. Check the dividers: genuine blank cells are fine.'));
    apply.disabled = !draft.items.length || draft.rows.length < 2 || draft.rows[0].length < 2;
  }
  stage.addEventListener('pointerdown', e => { if (box || !source) return; e.preventDefault(); drawing = point(e); stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', e => { if (!drawing) return; const p = point(e); paint([Math.min(drawing[0], p[0]), Math.min(drawing[1], p[1]), Math.max(drawing[0], p[0]), Math.max(drawing[1], p[1])]); });
  stage.addEventListener('pointerup', e => {
    if (!drawing) return;
    const p = point(e), start = drawing; drawing = null;
    if (Math.abs(p[0] - start[0]) < 5 || Math.abs(p[1] - start[1]) < 5) { paint(); return; }
    const a = vp.convertToPdfPoint(...start), b = vp.convertToPdfPoint(...p);
    choose([Math.min(a[0], b[0]) - page.ox, Math.min(a[1], b[1]) - page.oy, Math.max(a[0], b[0]) - page.ox, Math.max(a[1], b[1]) - page.oy]);
  });
  stage.addEventListener('pointercancel', () => { drawing = null; if (!box && source) paint(); });
  pageSelect.addEventListener('change', () => { block = null; loadPage().catch(onError); });
  again.addEventListener('click', () => { block = null; loadPage().catch(onError); });
  apply.addEventListener('click', () => { try { onApply(draft); dialog.close(); } catch (e) { status.textContent = e.message; status.hidden = false; } });
  try { await loadPage(); } catch (e) { dialog.close(); onError(e); }
}
