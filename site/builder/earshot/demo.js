// Landing demo: the real pipeline run on the sample's first page, played as
// a loop. First the order an untagged file gives a screen reader (file
// order, furniture read aloud), then Earshot's fixed order. A line traces
// the reading path, so the scramble is visible even with the sound off.
import { extractDocument } from './extract.js';
import { analyze, fileOrder, spoken } from './analyze.js';

const STEP_MS = 760;

export function initDemo({ pdfjs, opts, onOpen }) {
  const root = document.querySelector('#demo');
  if (!root) return;
  const els = {
    stage: root.querySelector('.demo-page'), canvas: root.querySelector('canvas'), boxes: root.querySelector('.demo-boxes'),
    path: root.querySelector('.demo-path polyline'), svg: root.querySelector('.demo-path'),
    phase: root.querySelector('.demo-phase'), sub: root.querySelector('.demo-sub'), said: root.querySelector('.demo-said'),
    count: root.querySelector('.demo-count'), verdict: root.querySelector('.demo-verdict'),
    play: root.querySelector('.demo-play'), sound: root.querySelector('.demo-sound'), open: root.querySelector('.demo-open'),
  };
  const D = { tok: 0, phases: null, phase: 0, step: -1, timer: null, playing: false, sound: false, visible: false, ready: false, viewport: null };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  async function load() {
    const res = await fetch('sample.pdf');
    const pdf = await pdfjs.getDocument({ ...opts, data: new Uint8Array(await res.arrayBuffer()) }).promise;
    const ex = await extractDocument(pdfjs, pdf);
    const { blocks } = analyze(ex.pages);
    const p = ex.pages[0];
    const page = await pdf.getPage(1);
    const width = els.stage.clientWidth || 320;
    const vp = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
    D.viewport = vp;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rvp = page.getViewport({ scale: vp.scale * dpr });
    els.canvas.width = Math.round(rvp.width); els.canvas.height = Math.round(rvp.height);
    els.stage.style.height = `${Math.round(vp.height)}px`;
    els.svg.setAttribute('viewBox', `0 0 ${vp.width} ${vp.height}`);
    await page.render({ canvasContext: els.canvas.getContext('2d'), viewport: rvp }).promise;
    const box = b => {
      const v = vp.convertToViewportRectangle([b[0] + p.ox, b[1] + p.oy, b[2] + p.ox, b[3] + p.oy]);
      return [Math.min(v[0], v[2]), Math.min(v[1], v[3]), Math.max(v[0], v[2]), Math.max(v[1], v[3])];
    };
    const first = blocks.filter(b => b.page === 0);
    // Untagged: everything is read in file order, furniture included; pictures are skipped.
    const before = fileOrder(first).filter(b => b.type !== 'figure').map(b => ({ box: box(b.bbox), text: b.text, kind: 'plain' }));
    const fixed = first.filter(b => b.type !== 'artifact' && b.type !== 'figure').map(b => ({ box: box(b.bbox), text: spoken(b), kind: b.type }));
    const titleAt = fileOrder(first).filter(b => b.type !== 'figure').findIndex(b => b.type === 'h' && b.level === 1) + 1;
    const furniture = first.filter(b => b.type === 'artifact').length;
    const heads = fixed.filter(u => u.kind === 'h').length;
    D.phases = [
      { name: 'As it is now', sub: 'No tags, so a screen reader reads the text in the order the file stores it.', units: before,
        verdict: `The title is read ${ordinal(titleAt)}. The footer and page number come first, and the columns are mixed up.` },
      { name: 'With Earshot’s fixes', sub: 'Proposed by Earshot from the layout, checked by a person, written into the PDF as tags.', units: fixed,
        verdict: `Top to bottom, column by column. ${heads} headings to jump between, the list announced as a list, ${furniture} pieces of page furniture hidden.` },
    ];
    D.ready = true;
    root.classList.add('ready');
    reset(0);
    if (!reduce) setPlaying(true);
  }

  function reset(phase) {
    D.phase = phase; D.step = -1;
    els.boxes.textContent = '';
    els.path.setAttribute('points', '');
    const ph = D.phases[phase];
    root.dataset.phase = phase ? 'after' : 'before';
    els.phase.textContent = ph.name;
    els.sub.textContent = ph.sub;
    els.said.textContent = '';
    els.verdict.hidden = true;
    els.count.textContent = '';
  }
  function show(k) {
    const ph = D.phases[D.phase];
    const u = ph.units[k];
    els.boxes.querySelectorAll('.cur').forEach(e => e.classList.remove('cur'));
    const [x0, y0, x1, y1] = u.box;
    const el = document.createElement('div');
    el.className = `demo-box cur k-${u.kind}`;
    el.style.cssText = `left:${x0 - 2}px;top:${y0 - 2}px;width:${x1 - x0 + 4}px;height:${y1 - y0 + 4}px`;
    const badge = document.createElement('span');
    badge.textContent = String(k + 1);
    el.append(badge);
    els.boxes.append(el);
    const pts = ph.units.slice(0, k + 1).map(v => `${Math.round(v.box[0] - 2)},${Math.round(v.box[1] + 4)}`).join(' ');
    els.path.setAttribute('points', pts);
    els.said.textContent = `“${clip(u.text, 120)}”`;
    els.count.textContent = `Read ${k + 1} of ${ph.units.length}`;
  }
  function tick() {
    clearTimeout(D.timer);
    D.tok++;
    if (!D.playing || !D.visible) return;
    const ph = D.phases[D.phase];
    if (D.step < ph.units.length - 1) {
      D.step++;
      show(D.step);
      if (D.sound) say(ph.units[D.step].text, tick);
      else D.timer = setTimeout(tick, STEP_MS);
      return;
    }
    // End of a phase: hold on the verdict, then switch.
    els.verdict.textContent = ph.verdict;
    els.verdict.hidden = false;
    els.boxes.querySelectorAll('.cur').forEach(e => e.classList.remove('cur'));
    const after = () => { reset(D.phase ? 0 : 1); D.timer = setTimeout(tick, 500); };
    if (D.sound) say(ph.verdict, () => { D.timer = setTimeout(after, 600); });
    else D.timer = setTimeout(after, 3600);
  }
  function say(text, done) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US'; u.rate = 1.1;
      const tok = ++D.tok;
      const once = () => { if (tok === D.tok) { D.tok++; done(); } };
      u.onend = once; u.onerror = once;
      // Some voices never fire onend; don't let the demo stall.
      D.timer = setTimeout(once, 2500 + text.length * 90);
      speechSynthesis.speak(u);
    } catch { D.timer = setTimeout(done, STEP_MS); }
  }
  function setPlaying(on) {
    D.playing = on;
    els.play.setAttribute('aria-pressed', String(!on));
    els.play.innerHTML = on ? '<span aria-hidden="true">❚❚</span> Pause' : '<span aria-hidden="true">▶</span> Play';
    if (!on) { clearTimeout(D.timer); D.tok++; try { speechSynthesis.cancel(); } catch { /* none */ } } else tick();
  }

  els.play.addEventListener('click', () => { if (D.ready) setPlaying(!D.playing); });
  els.sound.addEventListener('click', () => {
    if (!('speechSynthesis' in window)) { els.sound.textContent = 'No speech in this browser'; els.sound.disabled = true; return; }
    D.sound = !D.sound;
    els.sound.setAttribute('aria-pressed', String(D.sound));
    els.sound.innerHTML = D.sound ? '<span aria-hidden="true">🔊</span> Sound on' : '<span aria-hidden="true">🔈</span> Hear it';
    if (D.sound && D.ready) { reset(D.phase); setPlaying(true); } else if (!D.sound) { try { speechSynthesis.cancel(); } catch { /* none */ } if (D.playing) tick(); }
  });
  els.open.addEventListener('click', () => { setPlaying(false); onOpen(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && D.playing) setPlaying(false); });
  new IntersectionObserver(es => {
    const vis = es.some(e => e.isIntersecting);
    if (vis === D.visible) return;
    D.visible = vis;
    if (vis && !D.phases) load().catch(e => { console.error(e); root.hidden = true; });
    else if (vis && D.playing) tick();
    else if (!vis) { clearTimeout(D.timer); try { if (D.sound) speechSynthesis.cancel(); } catch { /* none */ } }
  }, { threshold: 0.15 }).observe(root);
  D.stop = () => setPlaying(false);
  return D;
}

const clip = (t, n) => t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
