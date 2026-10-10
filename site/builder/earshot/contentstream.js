// A small PDF content-stream lexer and interpreter. It splits a stream into
// operations (with their byte ranges, so the original bytes can be copied
// through untouched) and follows the graphics and text state far enough to
// know where on the page every text-showing operation lands.

const WS = new Set([0, 9, 10, 12, 13, 32]);
const DELIM = new Set([40, 41, 60, 62, 91, 93, 123, 125, 47, 37]);

export function lex(bytes) {
  const ops = [];
  let i = 0, args = [], argStart = -1;
  const n = bytes.length;
  const stack = []; // open arrays / dicts
  const push = v => {
    if (stack.length) stack.at(-1).items.push(v); else args.push(v);
  };
  const markStart = s => { if (argStart < 0 && !stack.length) argStart = s; };
  while (i < n) {
    const c = bytes[i];
    if (WS.has(c)) { i++; continue; }
    if (c === 37) { while (i < n && bytes[i] !== 10 && bytes[i] !== 13) i++; continue; }
    const start = i;
    if (c === 40) { // literal string
      markStart(start);
      const out = [];
      let depth = 1; i++;
      while (i < n && depth) {
        const b = bytes[i];
        if (b === 92) {
          const e = bytes[i + 1];
          const map = { 110: 10, 114: 13, 116: 9, 98: 8, 102: 12, 40: 40, 41: 41, 92: 92 };
          if (e in map) { out.push(map[e]); i += 2; } else if (e >= 48 && e <= 55) {
            let v = 0, k = 0;
            i++;
            while (k < 3 && bytes[i] >= 48 && bytes[i] <= 55) { v = v * 8 + bytes[i] - 48; i++; k++; }
            out.push(v & 255);
          } else if (e === 13 || e === 10) { i += 2; if (e === 13 && bytes[i] === 10) i++; } else { i++; }
          continue;
        }
        if (b === 40) depth++;
        if (b === 41) { depth--; if (!depth) { i++; break; } }
        out.push(b); i++;
      }
      push({ str: Uint8Array.from(out) });
      continue;
    }
    if (c === 60 && bytes[i + 1] === 60) { markStart(start); stack.push({ type: 'dict', items: [] }); i += 2; continue; }
    if (c === 62 && bytes[i + 1] === 62) {
      i += 2;
      const d = stack.pop();
      if (d) {
        const dict = {};
        for (let k = 0; k + 1 < d.items.length; k += 2) if (d.items[k] && d.items[k].name !== undefined) dict[d.items[k].name] = d.items[k + 1];
        push({ dict });
      }
      continue;
    }
    if (c === 60) { // hex string
      markStart(start);
      i++;
      let hex = '';
      while (i < n && bytes[i] !== 62) { const ch = String.fromCharCode(bytes[i]); if (/[0-9a-fA-F]/.test(ch)) hex += ch; i++; }
      i++;
      if (hex.length % 2) hex += '0';
      const out = new Uint8Array(hex.length / 2);
      for (let k = 0; k < out.length; k++) out[k] = parseInt(hex.substr(k * 2, 2), 16);
      push({ str: out, hex: true });
      continue;
    }
    if (c === 91) { markStart(start); stack.push({ type: 'array', items: [] }); i++; continue; }
    if (c === 93) { i++; const a = stack.pop(); if (a) push(a.items); continue; }
    if (c === 123 || c === 125 || c === 41 || c === 62) { i++; continue; }
    if (c === 47) { // name
      markStart(start);
      i++;
      let s = '';
      while (i < n && !WS.has(bytes[i]) && !DELIM.has(bytes[i])) {
        if (bytes[i] === 35 && i + 2 < n) { s += String.fromCharCode(parseInt(String.fromCharCode(bytes[i + 1], bytes[i + 2]), 16)); i += 3; } else { s += String.fromCharCode(bytes[i]); i++; }
      }
      push({ name: s });
      continue;
    }
    // number or keyword
    let s = '';
    while (i < n && !WS.has(bytes[i]) && !DELIM.has(bytes[i])) { s += String.fromCharCode(bytes[i]); i++; }
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) { markStart(start); push(parseFloat(s)); continue; }
    if (s === 'true' || s === 'false' || s === 'null') { markStart(start); push(s === 'true' ? true : s === 'false' ? false : null); continue; }
    if (stack.length) { push({ kw: s }); continue; }
    if (s === 'BI') {
      // Inline image: skip to "ID", one whitespace byte, then data up to a delimited "EI".
      let j = i;
      while (j < n - 1 && !(bytes[j] === 73 && bytes[j + 1] === 68 && WS.has(bytes[j - 1]) && (WS.has(bytes[j + 2]) || j + 2 >= n))) j++;
      j += 3;
      while (j < n - 1 && !(bytes[j] === 69 && bytes[j + 1] === 73 && WS.has(bytes[j - 1]) && (j + 2 >= n || WS.has(bytes[j + 2])))) j++;
      i = Math.min(n, j + 2);
      ops.push({ op: 'BI', args: [], start, end: i });
      args = []; argStart = -1;
      continue;
    }
    ops.push({ op: s, args, start: argStart >= 0 ? argStart : start, end: i });
    args = []; argStart = -1;
  }
  return ops;
}

function mul(m, n) {
  return [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3], m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]];
}
const boxOf = pts => {
  const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

export const PATH_START = new Set(['m', 're']);
export const PATH_PAINT = new Set(['S', 's', 'f', 'F', 'f*', 'B', 'B*', 'b', 'b*', 'n']);
export const SHOW = new Set(['Tj', 'TJ', "'", '"']);

// Walks operations, calling visit(op, info) for each. For text-showing ops
// info.box is [x0, y0, x1, y1] in user space; for Do and BI it is the unit
// square under the current matrix. fonts(name) → { widths(code) in 1/1000, twoByte }.
export function interpret(ops, fonts, visit) {
  let gs = { ctm: [1, 0, 0, 1, 0, 0], font: null, size: 0, Tc: 0, Tw: 0, Tz: 100, TL: 0, Ts: 0 };
  const stack = [];
  let Tm = [1, 0, 0, 1, 0, 0], Tlm = Tm, inText = false;
  const newline = (tx, ty) => { Tlm = mul([1, 0, 0, 1, tx, ty], Tlm); Tm = Tlm; };
  const show = parts => {
    const f = gs.font ? fonts(gs.font) : null;
    const pts = [];
    const textBox = () => {
      const trm = mul(mul([gs.size * gs.Tz / 100, 0, 0, gs.size, 0, gs.Ts], Tm), gs.ctm);
      pts.push(apply(trm, 0, -0.22), apply(trm, 0, 0.9));
    };
    textBox();
    let glyphs = 0;
    const segs = [];
    for (const p of parts) {
      if (typeof p === 'number') { Tm = mul([1, 0, 0, 1, -p / 1000 * gs.size * gs.Tz / 100, 0], Tm); segs.push(null); continue; }
      if (!p || !p.str) { segs.push(null); continue; }
      const s0 = pts.length;
      textBox();
      const b = p.str, two = f && f.twoByte;
      for (let k = 0; k < b.length; k += two ? 2 : 1) {
        const code = two ? (b[k] << 8) | (b[k + 1] || 0) : b[k];
        const w0 = f ? f.width(code) / 1000 : 0.5;
        const tx = (w0 * gs.size + gs.Tc + (!two && code === 32 ? gs.Tw : 0)) * gs.Tz / 100;
        Tm = mul([1, 0, 0, 1, tx, 0], Tm);
        glyphs++;
      }
      textBox();
      segs.push(boxOf(pts.slice(s0)));
    }
    textBox();
    return { box: boxOf(pts), glyphs, segs };
  };
  for (const o of ops) {
    const a = o.args;
    let info = null;
    switch (o.op) {
      case 'q': stack.push({ ...gs }); break;
      case 'Q': gs = stack.pop() || gs; break;
      case 'cm': if (a.length >= 6) gs.ctm = mul(a.slice(-6), gs.ctm); break;
      case 'BT': inText = true; Tm = Tlm = [1, 0, 0, 1, 0, 0]; break;
      case 'ET': inText = false; break;
      case 'Tf': gs.font = a[0] && a[0].name; gs.size = +a[1] || 0; break;
      case 'Tc': gs.Tc = +a[0] || 0; break;
      case 'Tw': gs.Tw = +a[0] || 0; break;
      case 'Tz': gs.Tz = +a[0] || 100; break;
      case 'TL': gs.TL = +a[0] || 0; break;
      case 'Ts': gs.Ts = +a[0] || 0; break;
      case 'Td': newline(+a[0] || 0, +a[1] || 0); break;
      case 'TD': gs.TL = -(+a[1] || 0); newline(+a[0] || 0, +a[1] || 0); break;
      case 'Tm': if (a.length >= 6) { Tlm = Tm = a.slice(-6); } break;
      case 'T*': newline(0, -gs.TL); break;
      case 'Tj': info = show([a[0]]); break;
      case 'TJ': info = show(Array.isArray(a[0]) ? a[0] : []); break;
      case "'": newline(0, -gs.TL); info = show([a[0]]); break;
      case '"': gs.Tw = +a[0] || 0; gs.Tc = +a[1] || 0; newline(0, -gs.TL); info = show([a[2]]); break;
      case 'Do': case 'BI': case 'sh': {
        const pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => apply(gs.ctm, x, y));
        const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
        info = { box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], ctm: gs.ctm };
        break;
      }
    }
    visit(o, info, inText);
  }
}
