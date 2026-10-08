// Excel formula tokenizer + parser. Produces a small AST that the rest of
// Untangle uses to find references, group copied formulas and draw formula trees.

export function colToNum(s) {
  let n = 0;
  for (const ch of s.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

export function numToCol(n) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export const MAX_ROW = 1048576;
export const MAX_COL = 16384;

export function addr(c, r) {
  return numToCol(c) + r;
}

export function parseA1(s) {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(s);
  if (!m) return null;
  return { c: colToNum(m[1]), r: +m[2] };
}

export function rangeText(rg) {
  if (rg.wholeCol) return `${numToCol(rg.c1)}:${numToCol(rg.c2)}`;
  if (rg.wholeRow) return `${rg.r1}:${rg.r2}`;
  const a = addr(rg.c1, rg.r1);
  return rg.c1 === rg.c2 && rg.r1 === rg.r2 ? a : `${a}:${addr(rg.c2, rg.r2)}`;
}

// ---------- tokenizer ----------

const ERRORS = ["#NULL!", "#DIV/0!", "#VALUE!", "#REF!", "#NAME?", "#NUM!", "#N/A", "#GETTING_DATA", "#SPILL!", "#CALC!", "#FIELD!", "#BLOCKED!", "#CONNECT!", "#BUSY!", "#UNKNOWN!", "#PYTHON!"];

// A cell/range/column/row reference, optionally with sheet prefix, e.g.
// Sheet1!$A$1:B2, 'My sheet'!A:A, [1]Rates!C3, Sheet1:Sheet3!A1, 3:5
const SHEET = String.raw`(?:'(?:[^']|'')+'|\[\d+\][A-Za-z0-9_.À-￿]+|[A-Za-z_À-￿][A-Za-z0-9_.À-￿]*(?::[A-Za-z_À-￿][A-Za-z0-9_.À-￿]*)?|\[\d+\])!`;
const CELL = String.raw`\$?[A-Za-z]{1,3}\$?\d+`;
const REF_RE = new RegExp(String.raw`^(${SHEET})?(${CELL}(?::${CELL})?|\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}|\$?\d+:\$?\d+)(?![A-Za-z0-9_(.\[])`);
const SHEET_ONLY_RE = new RegExp(String.raw`^(${SHEET})`);

export function tokenize(src) {
  const toks = [];
  let i = 0;
  const s = src;
  const push = (type, value, extra) => toks.push({ type, value, pos: i, ...extra });
  while (i < s.length) {
    const ch = s[i];
    if (ch === " " || ch === "\n" || ch === "\r" || ch === "\t") {
      let j = i;
      while (j < s.length && /\s/.test(s[j])) j++;
      // Whitespace between two operands is Excel's intersection operator.
      const prev = toks[toks.length - 1];
      const next = s[j];
      if (prev && (prev.type === "ref" || prev.type === "close" || prev.type === "name") && next && /[A-Za-z$'(]/.test(next)) {
        // Only when the next thing looks like a reference.
        const rest = s.slice(j);
        if (REF_RE.test(rest) || /^\(/.test(rest)) { i = j; push("op", " "); continue; }
      }
      i = j;
      continue;
    }
    if (ch === '"') {
      let j = i + 1, out = "";
      while (j < s.length) {
        if (s[j] === '"') {
          if (s[j + 1] === '"') { out += '"'; j += 2; continue; }
          break;
        }
        out += s[j++];
      }
      push("str", out);
      i = j + 1;
      continue;
    }
    if (ch === "#") {
      const e = ERRORS.find((x) => s.substr(i, x.length).toUpperCase() === x);
      if (e) { push("err", e); i += e.length; continue; }
    }
    if (ch === "{") { push("lbrace", ch); i++; continue; }
    if (ch === "}") { push("rbrace", ch); i++; continue; }
    if (ch === "(") { push("open", ch); i++; continue; }
    if (ch === ")") { push("close", ch); i++; continue; }
    if (ch === "," || ch === ";") {
      push("sep", ch); i++; continue;
    }
    const two = s.substr(i, 2);
    if (two === "<=" || two === ">=" || two === "<>") { push("op", two); i += 2; continue; }
    if ("+-*/^&=<>%".includes(ch)) { push("op", ch); i++; continue; }
    if (ch === "@") { push("op", "@"); i++; continue; }
    if (/[0-9.]/.test(ch)) {
      const m = /^(\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(s.slice(i));
      if (m) {
        // A row range like 3:5 is a reference, not a number.
        const rm = REF_RE.exec(s.slice(i));
        if (rm && rm[0].length > m[0].length) { pushRef(rm); continue; }
        push("num", parseFloat(m[0]));
        i += m[0].length;
        continue;
      }
    }
    const rest = s.slice(i);
    const rm = REF_RE.exec(rest);
    if (rm) { pushRef(rm); continue; }
    // Name / function / structured reference / sheet-qualified name
    let sheetPrefix = null;
    const sm = SHEET_ONLY_RE.exec(rest);
    if (sm) { sheetPrefix = sm[1]; i += sm[1].length; }
    const nm = /^[A-Za-z_\\À-￿][A-Za-z0-9_.\\?À-￿]*/.exec(s.slice(i));
    if (nm) {
      let name = nm[0];
      i += name.length;
      if (s[i] === "[") {
        // Structured table reference: Table1[Col], Table1[[#This Row],[Col]]
        let depth = 0, j = i;
        for (; j < s.length; j++) {
          if (s[j] === "'" ) { j++; continue; }
          if (s[j] === "[") depth++;
          else if (s[j] === "]") { depth--; if (depth === 0) break; }
        }
        const spec = s.slice(i, j + 1);
        i = j + 1;
        toks.push({ type: "table", value: name, spec, pos: i });
        continue;
      }
      if (s[i] === "(" && !sheetPrefix) { toks.push({ type: "func", value: name, pos: i }); continue; }
      if (/^(TRUE|FALSE)$/i.test(name) && !sheetPrefix) { toks.push({ type: "bool", value: name.toUpperCase() === "TRUE", pos: i }); continue; }
      toks.push({ type: "name", value: name, sheet: sheetPrefix ? cleanSheet(sheetPrefix) : null, pos: i });
      continue;
    }
    if (ch === "[") {
      // Structured reference without a table name (inside a table): [@Col]
      let depth = 0, j = i;
      for (; j < s.length; j++) {
        if (s[j] === "'") { j++; continue; }
        if (s[j] === "[") depth++;
        else if (s[j] === "]") { depth--; if (depth === 0) break; }
      }
      toks.push({ type: "table", value: "", spec: s.slice(i, j + 1), pos: i });
      i = j + 1;
      continue;
    }
    if (ch === "!" || ch === ":") { push("op", ch); i++; continue; }
    // Unknown character: keep going rather than failing the whole workbook.
    push("unknown", ch);
    i++;
  }
  return toks;

  function pushRef(rm) {
    const sheet = rm[1] ? cleanSheet(rm[1]) : null;
    toks.push({ type: "ref", value: rm[0], sheet, body: rm[2], pos: i });
    i += rm[0].length;
  }
}

function cleanSheet(prefix) {
  let p = prefix.slice(0, -1);
  let ext = null;
  if (p.startsWith("'")) p = p.slice(1, -1).replace(/''/g, "'");
  const em = /^(.*?)\[([^\]]+)\](.*)$/.exec(p);
  if (em) { ext = /^\d+$/.test(em[2]) ? +em[2] : em[1] + em[2]; p = em[3]; }
  return { name: p, ext };
}

// Parse the body of a reference (no sheet) into a range with absolute flags.
export function parseRefBody(body) {
  const parts = body.split(":");
  const one = (t) => {
    const m = /^(\$?)([A-Za-z]{1,3})?(\$?)(\d+)?$/.exec(t);
    if (!m) return null;
    return {
      c: m[2] ? colToNum(m[2]) : null, r: m[4] ? +m[4] : null,
      ac: !!m[1] && !!m[2], ar: m[2] ? !!m[3] : !!m[1],
    };
  };
  const a = one(parts[0]);
  const b = parts[1] ? one(parts[1]) : a;
  if (!a || !b) return null;
  if (a.c == null && b.c == null) {
    return { c1: 1, c2: MAX_COL, r1: Math.min(a.r, b.r), r2: Math.max(a.r, b.r), wholeRow: true, abs: [false, a.ar, false, b.ar] };
  }
  if (a.r == null && b.r == null) {
    return { c1: Math.min(a.c, b.c), c2: Math.max(a.c, b.c), r1: 1, r2: MAX_ROW, wholeCol: true, abs: [a.ac, false, b.ac, false] };
  }
  return {
    c1: Math.min(a.c, b.c), c2: Math.max(a.c, b.c), r1: Math.min(a.r, b.r), r2: Math.max(a.r, b.r),
    abs: [a.ac, a.ar, b.ac, b.ar],
  };
}

// ---------- parser ----------

const BIN = {
  ":": [90, "L"], " ": [85, "L"],
  "^": [60, "L"], "*": [50, "L"], "/": [50, "L"], "+": [40, "L"], "-": [40, "L"],
  "&": [30, "L"], "=": [20, "L"], "<>": [20, "L"], "<": [20, "L"], ">": [20, "L"], "<=": [20, "L"], ">=": [20, "L"],
};

export function parse(src) {
  const text = src.startsWith("=") ? src.slice(1) : src;
  const toks = tokenize(text);
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];

  function primary() {
    const t = next();
    if (!t) throw new Error("Formula ended unexpectedly");
    switch (t.type) {
      case "num": return { type: "num", value: t.value };
      case "str": return { type: "str", value: t.value };
      case "bool": return { type: "bool", value: t.value };
      case "err": return { type: "err", value: t.value };
      case "ref": {
        const rg = parseRefBody(t.body);
        return { type: "ref", text: t.value, sheet: t.sheet ? t.sheet.name : null, ext: t.sheet ? t.sheet.ext : null, range: rg };
      }
      case "name": return { type: "name", name: t.value, sheet: t.sheet ? t.sheet.name : null, ext: t.sheet ? t.sheet.ext : null };
      case "table": return { type: "table", table: t.value, spec: t.spec };
      case "func": {
        next(); // (
        const args = [];
        if (peek() && peek().type === "close") { next(); }
        else {
          for (;;) {
            if (peek() && (peek().type === "sep" || peek().type === "close")) args.push({ type: "missing" });
            else args.push(expr(0));
            const s = next();
            if (!s) throw new Error("Missing )");
            if (s.type === "close") break;
            if (s.type !== "sep") throw new Error("Expected , or )");
          }
        }
        return { type: "func", name: t.value.replace(/^_xlfn\.(_xlws\.)?|^_xlws\./i, "").replace(/^_xlpm\./i, "").toUpperCase(), args };
      }
      case "open": {
        const e = expr(0);
        const items = [e];
        while (peek() && peek().type === "sep") { next(); items.push(expr(0)); }
        const c = next();
        if (!c || c.type !== "close") throw new Error("Missing )");
        return items.length > 1 ? { type: "union", items } : { type: "paren", expr: e };
      }
      case "lbrace": {
        const rows = [[]];
        for (;;) {
          const v = expr(0);
          rows[rows.length - 1].push(v);
          const s = next();
          if (!s) throw new Error("Missing }");
          if (s.type === "rbrace") break;
          if (s.type === "sep" && s.value === ";") rows.push([]);
        }
        return { type: "array", rows };
      }
      case "op":
        if (t.value === "-" || t.value === "+") return { type: "unary", op: t.value, expr: expr(70) };
        if (t.value === "@") return { type: "unary", op: "@", expr: expr(95) };
        if (t.value === "=") return primary();
        break;
    }
    throw new Error(`Unexpected "${t.value}"`);
  }

  function expr(minPrec) {
    let left = primary();
    for (;;) {
      const t = peek();
      if (!t) break;
      if (t.type === "op" && t.value === "%") { next(); left = { type: "percent", expr: left }; continue; }
      if (t.type === "op" && t.value === "#") { next(); left = { type: "spill", expr: left }; continue; }
      if (t.type !== "op" || !BIN[t.value]) break;
      const [prec] = BIN[t.value];
      if (prec < minPrec) break;
      next();
      const right = expr(prec + 1);
      left = { type: "bin", op: t.value, left, right };
    }
    return left;
  }

  const ast = expr(0);
  if (p < toks.length) throw new Error(`Unexpected "${toks[p].value}"`);
  return ast;
}

// Walk every node, depth first.
export function walk(node, fn, parent = null) {
  if (!node) return;
  fn(node, parent);
  switch (node.type) {
    case "func": node.args.forEach((a) => walk(a, fn, node)); break;
    case "bin": walk(node.left, fn, node); walk(node.right, fn, node); break;
    case "unary": case "percent": case "paren": case "spill": walk(node.expr, fn, node); break;
    case "union": node.items.forEach((a) => walk(a, fn, node)); break;
    case "array": node.rows.flat().forEach((a) => walk(a, fn, node)); break;
  }
}

// Turn an AST back into text. Used for displaying sub-expressions.
export function print(node) {
  switch (node.type) {
    case "num": return String(node.value);
    case "str": return `"${node.value.replace(/"/g, '""')}"`;
    case "bool": return node.value ? "TRUE" : "FALSE";
    case "err": return node.value;
    case "missing": return "";
    case "ref": return node.text;
    case "name": return node.name;
    case "table": return node.table + node.spec;
    case "func": return `${node.name}(${node.args.map(print).join(", ")})`;
    case "bin": return node.op === ":" ? `${print(node.left)}:${print(node.right)}` : `${print(node.left)} ${node.op === " " ? "" : node.op + " "}${print(node.right)}`.replace("  ", " ");
    case "unary": return node.op + print(node.expr);
    case "percent": return print(node.expr) + "%";
    case "spill": return print(node.expr) + "#";
    case "paren": return `(${print(node.expr)})`;
    case "union": return `(${node.items.map(print).join(", ")})`;
    case "array": return `{${node.rows.map((r) => r.map(print).join(", ")).join("; ")}}`;
  }
  return "?";
}

// R1C1-style key: two cells with the same key were filled/copied from each other.
// Works on tokens so it never fails, even on formulas the parser can't handle.
export function r1c1Key(formula, c, r) {
  const toks = tokenize(formula.startsWith("=") ? formula.slice(1) : formula);
  let out = "";
  for (const t of toks) {
    if (t.type === "ref") {
      const rg = parseRefBody(t.body);
      const sh = t.sheet ? `${t.sheet.ext != null ? `[${t.sheet.ext}]` : ""}${t.sheet.name}!` : "";
      if (!rg) { out += t.value; continue; }
      const part = (cc, rr, ac, ar) => `${rg.wholeCol ? "" : ar ? `R${rr}` : `R[${rr - r}]`}${rg.wholeRow ? "" : ac ? `C${cc}` : `C[${cc - c}]`}`;
      out += sh + part(rg.c1, rg.r1, rg.abs[0], rg.abs[1]) + ":" + part(rg.c2, rg.r2, rg.abs[2], rg.abs[3]);
    } else if (t.type === "str") out += JSON.stringify(t.value);
    else if (t.type === "table") out += t.value + t.spec;
    else if (t.type === "name" && t.sheet) out += `${t.sheet.name}!${t.value}`;
    else out += String(t.value);
    out += "\u0001";
  }
  return out;
}

// Shift the relative parts of every reference by (dc, dr). Used to expand
// Excel's "shared formulas", where only the first cell stores the text.
export function shiftFormula(formula, dc, dr) {
  const toks = tokenize(formula);
  let out = "", last = 0;
  for (const t of toks) {
    if (t.type !== "ref") continue;
    const at = t.pos;
    out += formula.slice(last, at);
    const sheetPart = t.value.slice(0, t.value.length - t.body.length);
    out += sheetPart + t.body.split(":").map((part) => shiftPart(part, dc, dr)).join(":");
    last = at + t.value.length;
  }
  return out + formula.slice(last);
}

function shiftPart(part, dc, dr) {
  const m = /^(\$?)([A-Za-z]{1,3})?(\$?)(\d+)?$/.exec(part);
  if (!m) return part;
  let s = "";
  if (m[2]) s += m[1] + (m[1] ? m[2].toUpperCase() : numToCol(Math.max(1, colToNum(m[2]) + dc)));
  else if (m[1] && !m[2]) s += "";
  if (m[4]) {
    const absRow = m[2] ? m[3] : m[1];
    s += absRow + (absRow ? m[4] : String(Math.max(1, +m[4] + dr)));
  }
  return s;
}
