// A small Excel evaluator. Untangle never trusts it over Excel: it recomputes a
// formula from the workbook's saved values, and only shows the in-between values
// when its answer matches the value Excel saved.

import { walk } from "./formula.js";

export class Unsupported extends Error {}
export class XlError {
  constructor(code) { this.error = code; }
}
const E = (c) => new XlError(c);
const isErr = (v) => v instanceof XlError || (v && typeof v === "object" && "error" in v && !Array.isArray(v));

// A range value: 2D array of cell values.
function isArr(v) { return Array.isArray(v); }

function flat(args) {
  const out = [];
  for (const a of args) {
    if (isArr(a)) for (const row of a) for (const v of row) out.push({ v, fromRange: true });
    else out.push({ v: a, fromRange: false });
  }
  return out;
}

function num(v) {
  if (isErr(v)) throw v;
  if (v == null || v === "") return 0;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number") return v;
  if (isArr(v)) return num(v[0]?.[0]);
  const n = Number(String(v).trim().replace(/%$/, ""));
  if (String(v).trim() === "" || Number.isNaN(n)) throw E("#VALUE!");
  return String(v).trim().endsWith("%") ? n / 100 : n;
}
function str(v) {
  if (isErr(v)) throw v;
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (isArr(v)) return str(v[0]?.[0]);
  if (typeof v === "number") return String(+v.toPrecision(15));
  return String(v);
}
function bool(v) {
  if (isErr(v)) throw v;
  if (isArr(v)) return bool(v[0]?.[0]);
  if (typeof v === "string") {
    if (/^true$/i.test(v)) return true;
    if (/^false$/i.test(v)) return false;
    throw E("#VALUE!");
  }
  return !!num(v);
}
function scalar(v) { return isArr(v) ? v[0]?.[0] ?? null : v; }

function numbers(args) {
  const out = [];
  for (const { v, fromRange } of flat(args)) {
    if (isErr(v)) throw v;
    if (fromRange) { if (typeof v === "number") out.push(v); }
    else if (v != null) out.push(num(v));
  }
  return out;
}

function cmp(a, b) {
  // Excel ordering: numbers < text < booleans; text compare is case-insensitive.
  const rank = (x) => (typeof x === "number" ? 0 : typeof x === "string" ? 1 : typeof x === "boolean" ? 2 : 0);
  if (a == null) a = typeof b === "string" ? "" : typeof b === "boolean" ? false : 0;
  if (b == null) b = typeof a === "string" ? "" : typeof a === "boolean" ? false : 0;
  const ra = rank(a), rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (ra === 1) { const x = a.toLowerCase(), y = b.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; }
  return a < b ? -1 : a > b ? 1 : 0;
}

function criteria(c) {
  if (typeof c === "number" || typeof c === "boolean") return (v) => cmp(v, c) === 0 && typeof v === typeof c;
  const s = str(c);
  const m = /^(<=|>=|<>|<|>|=)?(.*)$/.exec(s);
  const op = m[1] || "=", rhs = m[2];
  const n = rhs.trim() !== "" && !Number.isNaN(Number(rhs)) ? Number(rhs) : null;
  const wild = n == null && /[*?]/.test(rhs) ? new RegExp("^" + rhs.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/~\*/g, "\u0001").replace(/\*/g, ".*").replace(/\?/g, ".").replace(/\u0001/g, "\\*") + "$", "i") : null;
  return (v) => {
    if (n != null && typeof v === "number") {
      return { "=": v === n, "<>": v !== n, "<": v < n, ">": v > n, "<=": v <= n, ">=": v >= n }[op];
    }
    if (n != null && op !== "=" && op !== "<>") return false;
    const vs = v == null ? "" : str(v);
    let eq;
    if (wild) eq = wild.test(vs);
    else eq = vs.toLowerCase() === rhs.toLowerCase() && (rhs !== "" || v == null || v === "");
    if (op === "=") return eq;
    if (op === "<>") return !eq;
    if (n != null) return false;
    const c2 = cmp(vs, rhs);
    return { "<": c2 < 0, ">": c2 > 0, "<=": c2 <= 0, ">=": c2 >= 0 }[op];
  };
}

function cells(range) { return isArr(range) ? range.flat() : [range]; }

function lookupMatch(list, key, exact) {
  if (exact) {
    const f = criteria(key);
    return list.findIndex((v) => (typeof key === "string" ? f(v) : cmp(v, key) === 0 && v != null));
  }
  // Approximate match: largest value <= key (assumes sorted, like Excel).
  let best = -1;
  for (let i = 0; i < list.length; i++) {
    if (list[i] == null) continue;
    if (cmp(list[i], key) <= 0 && typeof list[i] === typeof key) best = i;
    else if (typeof list[i] === typeof key) break;
  }
  return best;
}

const DAY0 = Date.UTC(1899, 11, 30);
function serialToDate(n) { return new Date(DAY0 + Math.floor(n) * 86400000); }
function dateToSerial(y, m, d) { return Math.round((Date.UTC(y, m - 1, d) - DAY0) / 86400000); }

const FN = {
  SUM: (a) => numbers(a).reduce((x, y) => x + y, 0),
  AVERAGE: (a) => { const n = numbers(a); if (!n.length) throw E("#DIV/0!"); return n.reduce((x, y) => x + y, 0) / n.length; },
  MIN: (a) => { const n = numbers(a); return n.length ? Math.min(...n) : 0; },
  MAX: (a) => { const n = numbers(a); return n.length ? Math.max(...n) : 0; },
  COUNT: (a) => flat(a).filter(({ v }) => typeof v === "number").length,
  COUNTA: (a) => flat(a).filter(({ v }) => v != null && v !== "").length,
  COUNTBLANK: (a) => flat(a).filter(({ v }) => v == null || v === "").length,
  PRODUCT: (a) => numbers(a).reduce((x, y) => x * y, 1),
  ABS: ([x]) => Math.abs(num(x)),
  SQRT: ([x]) => { const n = num(x); if (n < 0) throw E("#NUM!"); return Math.sqrt(n); },
  POWER: ([x, y]) => Math.pow(num(x), num(y)),
  EXP: ([x]) => Math.exp(num(x)),
  LN: ([x]) => Math.log(num(x)),
  LOG10: ([x]) => Math.log10(num(x)),
  LOG: ([x, b]) => Math.log(num(x)) / Math.log(b === undefined ? 10 : num(b)),
  PI: () => Math.PI,
  INT: ([x]) => Math.floor(num(x)),
  MOD: ([a, b]) => { const d = num(b); if (d === 0) throw E("#DIV/0!"); const n = num(a); return n - d * Math.floor(n / d); },
  SIGN: ([x]) => Math.sign(num(x)),
  ROUND: ([x, d]) => round(num(x), d === undefined ? 0 : num(d), "round"),
  ROUNDUP: ([x, d]) => round(num(x), num(d ?? 0), "up"),
  ROUNDDOWN: ([x, d]) => round(num(x), num(d ?? 0), "down"),
  TRUNC: ([x, d]) => round(num(x), num(d ?? 0), "down"),
  CEILING: ([x, s]) => { const st = s === undefined ? 1 : num(s); return st === 0 ? 0 : Math.ceil(num(x) / st) * st; },
  FLOOR: ([x, s]) => { const st = s === undefined ? 1 : num(s); return st === 0 ? 0 : Math.floor(num(x) / st) * st; },
  "CEILING.MATH": ([x, s]) => FN.CEILING([x, s]),
  "FLOOR.MATH": ([x, s]) => FN.FLOOR([x, s]),
  AND: (a) => flat(a).filter(({ v }) => v != null).every(({ v }) => bool(v)),
  OR: (a) => flat(a).filter(({ v }) => v != null).some(({ v }) => bool(v)),
  XOR: (a) => flat(a).filter(({ v }) => v != null && bool(v)).length % 2 === 1,
  NOT: ([x]) => !bool(x),
  TRUE: () => true,
  FALSE: () => false,
  NA: () => { throw E("#N/A"); },
  ISBLANK: ([x]) => scalar(x) == null,
  ISNUMBER: ([x]) => typeof scalar(x) === "number",
  ISTEXT: ([x]) => typeof scalar(x) === "string",
  ISERROR: ([x]) => isErr(scalar(x)),
  ISNA: ([x]) => isErr(scalar(x)) && scalar(x).error === "#N/A",
  N: ([x]) => (typeof scalar(x) === "number" ? scalar(x) : typeof scalar(x) === "boolean" ? +scalar(x) : 0),
  LEN: ([x]) => str(x).length,
  LEFT: ([x, n]) => str(x).slice(0, n === undefined ? 1 : num(n)),
  RIGHT: ([x, n]) => { const s = str(x), k = n === undefined ? 1 : num(n); return k ? s.slice(-k) : ""; },
  MID: ([x, s, n]) => str(x).substr(num(s) - 1, num(n)),
  UPPER: ([x]) => str(x).toUpperCase(),
  LOWER: ([x]) => str(x).toLowerCase(),
  TRIM: ([x]) => str(x).trim().replace(/ +/g, " "),
  CONCATENATE: (a) => a.map(str).join(""),
  CONCAT: (a) => flat(a).map(({ v }) => str(v)).join(""),
  TEXTJOIN: ([d, skip, ...rest]) => flat(rest).map(({ v }) => v).filter((v) => !(bool(skip) && (v == null || v === ""))).map(str).join(str(d)),
  VALUE: ([x]) => num(x),
  EXACT: ([a, b]) => str(a) === str(b),
  REPT: ([x, n]) => str(x).repeat(num(n)),
  SUBSTITUTE: ([t, o, n]) => str(t).split(str(o)).join(str(n)),
  FIND: ([f, t, s]) => { const i = str(t).indexOf(str(f), s === undefined ? 0 : num(s) - 1); if (i < 0) throw E("#VALUE!"); return i + 1; },
  SEARCH: ([f, t, s]) => { const i = str(t).toLowerCase().indexOf(str(f).toLowerCase(), s === undefined ? 0 : num(s) - 1); if (i < 0) throw E("#VALUE!"); return i + 1; },
  DATE: ([y, m, d]) => dateToSerial(num(y), num(m), num(d)),
  YEAR: ([x]) => serialToDate(num(x)).getUTCFullYear(),
  MONTH: ([x]) => serialToDate(num(x)).getUTCMonth() + 1,
  DAY: ([x]) => serialToDate(num(x)).getUTCDate(),
  EOMONTH: ([s, m]) => { const d = serialToDate(num(s)); return dateToSerial(d.getUTCFullYear(), d.getUTCMonth() + 1 + num(m) + 1, 0); },
  EDATE: ([s, m]) => { const d = serialToDate(num(s)); return dateToSerial(d.getUTCFullYear(), d.getUTCMonth() + 1 + num(m), d.getUTCDate()); },
  SUMPRODUCT: (a) => {
    const arrs = a.map((x) => cells(x));
    const n = arrs[0].length;
    if (arrs.some((x) => x.length !== n)) throw E("#VALUE!");
    let s = 0;
    for (let i = 0; i < n; i++) s += arrs.reduce((p, x) => p * (typeof x[i] === "number" ? x[i] : 0), 1);
    return s;
  },
  SUMIF: ([range, crit, sumRange]) => {
    const r = cells(range), s = sumRange === undefined ? r : cells(sumRange), f = criteria(scalar(crit));
    let t = 0;
    r.forEach((v, i) => { if (f(v) && typeof s[i] === "number") t += s[i]; });
    return t;
  },
  COUNTIF: ([range, crit]) => { const f = criteria(scalar(crit)); return cells(range).filter((v) => f(v)).length; },
  AVERAGEIF: ([range, crit, avgRange]) => {
    const r = cells(range), s = avgRange === undefined ? r : cells(avgRange), f = criteria(scalar(crit));
    const vals = []; r.forEach((v, i) => { if (f(v) && typeof s[i] === "number") vals.push(s[i]); });
    if (!vals.length) throw E("#DIV/0!");
    return vals.reduce((x, y) => x + y, 0) / vals.length;
  },
  SUMIFS: ([sumRange, ...pairs]) => {
    const s = cells(sumRange); let t = 0;
    const tests = [];
    for (let i = 0; i < pairs.length; i += 2) tests.push([cells(pairs[i]), criteria(scalar(pairs[i + 1]))]);
    s.forEach((v, i) => { if (typeof v === "number" && tests.every(([r, f]) => f(r[i]))) t += v; });
    return t;
  },
  COUNTIFS: (pairs) => {
    const tests = [];
    for (let i = 0; i < pairs.length; i += 2) tests.push([cells(pairs[i]), criteria(scalar(pairs[i + 1]))]);
    return tests[0][0].filter((_, i) => tests.every(([r, f]) => f(r[i]))).length;
  },
  IFERROR: null, IF: null, IFS: null, IFNA: null, CHOOSE: null, LET: null, SWITCH: null, // lazy, handled in evalNode
  VLOOKUP: ([key, table, col, approx]) => {
    const t = isArr(table) ? table : [[table]];
    const k = scalar(key), ci = num(col);
    if (ci < 1 || ci > (t[0] || []).length) throw E("#REF!");
    const exact = approx !== undefined && !bool(approx);
    const i = lookupMatch(t.map((r) => r[0]), k, exact);
    if (i < 0) throw E("#N/A");
    return t[i][ci - 1];
  },
  HLOOKUP: ([key, table, row, approx]) => {
    const t = isArr(table) ? table : [[table]];
    const ri = num(row);
    if (ri < 1 || ri > t.length) throw E("#REF!");
    const exact = approx !== undefined && !bool(approx);
    const i = lookupMatch(t[0], scalar(key), exact);
    if (i < 0) throw E("#N/A");
    return t[ri - 1][i];
  },
  MATCH: ([key, range, type]) => {
    const list = cells(range), t = type === undefined ? 1 : num(type);
    let i;
    if (t === 0) i = lookupMatch(list, scalar(key), true);
    else if (t === 1) i = lookupMatch(list, scalar(key), false);
    else { i = -1; for (let j = 0; j < list.length; j++) if (cmp(list[j], scalar(key)) >= 0) i = j; }
    if (i < 0) throw E("#N/A");
    return i + 1;
  },
  INDEX: ([range, r, c]) => {
    const t = isArr(range) ? range : [[range]];
    let ri = r === undefined ? 1 : num(r), ci = c === undefined ? 1 : num(c);
    if (t.length === 1 && c === undefined) { ci = ri; ri = 1; }
    if (ri === 0 || ci === 0) throw new Unsupported("INDEX row/column 0");
    const row = t[ri - 1];
    if (!row || ci > row.length) throw E("#REF!");
    return row[ci - 1];
  },
  XLOOKUP: ([key, look, ret, notFound, mode]) => {
    if (mode !== undefined && num(mode) !== 0) throw new Unsupported("XLOOKUP match mode");
    const l = cells(look), r = isArr(ret) ? ret : [[ret]];
    const i = lookupMatch(l, scalar(key), true);
    if (i < 0) { if (notFound !== undefined) return notFound; throw E("#N/A"); }
    if (r.length === l.length) return r[i].length === 1 ? r[i][0] : [r[i]];
    if (r[0].length === l.length) return r.length === 1 ? r[0][i] : r.map((row) => [row[i]]);
    throw E("#VALUE!");
  },
  PMT: ([rate, n, pv, fv, type]) => {
    const r = num(rate), np = num(n), p = num(pv), f = fv === undefined ? 0 : num(fv), t = type === undefined ? 0 : num(type);
    if (r === 0) return -(p + f) / np;
    const x = Math.pow(1 + r, np);
    return -(r * (p * x + f)) / ((1 + r * t) * (x - 1));
  },
  NPV: ([rate, ...vals]) => { const r = num(rate); return numbers(vals).reduce((s, v, i) => s + v / Math.pow(1 + r, i + 1), 0); },
  ROWS: ([r]) => (isArr(r) ? r.length : 1),
  COLUMNS: ([r]) => (isArr(r) ? r[0].length : 1),
};

function round(x, d, mode) {
  const f = Math.pow(10, d);
  const v = x * f;
  const sign = v < 0 ? -1 : 1, a = Math.abs(v);
  let r;
  const eps = 1e-9 * Math.max(1, a);
  if (mode === "round") r = Math.floor(a + 0.5 + eps);
  else if (mode === "up") r = Math.ceil(a - eps);
  else r = Math.floor(a + eps);
  return (sign * r) / f;
}

function binop(op, a, b) {
  if (isArr(a) || isArr(b)) {
    // Element-wise for array maths, e.g. SUMPRODUCT((A1:A5>0)*B1:B5)
    const A = isArr(a) ? a : null, B = isArr(b) ? b : null;
    const rows = Math.max(A ? A.length : 1, B ? B.length : 1);
    const cols = Math.max(A ? A[0].length : 1, B ? B[0].length : 1);
    const out = [];
    for (let i = 0; i < rows; i++) {
      const row = [];
      for (let j = 0; j < cols; j++) {
        const x = A ? (A[i] ?? A[0])[j] ?? (A[i] ?? A[0])[0] : a;
        const y = B ? (B[i] ?? B[0])[j] ?? (B[i] ?? B[0])[0] : b;
        try { row.push(binop(op, x, y)); } catch (e) { if (isErr(e)) row.push(e); else throw e; }
      }
      out.push(row);
    }
    return out;
  }
  switch (op) {
    case "+": return num(a) + num(b);
    case "-": return num(a) - num(b);
    case "*": return num(a) * num(b);
    case "/": { const d = num(b); if (d === 0) throw E("#DIV/0!"); return num(a) / d; }
    case "^": return Math.pow(num(a), num(b));
    case "&": return str(a) + str(b);
    case "=": return cmp(a, b) === 0;
    case "<>": return cmp(a, b) !== 0;
    case "<": return cmp(a, b) < 0;
    case ">": return cmp(a, b) > 0;
    case "<=": return cmp(a, b) <= 0;
    case ">=": return cmp(a, b) >= 0;
  }
  throw new Unsupported(`operator ${op}`);
}

// ctx.ref(node) -> value or 2D array; ctx.name(name) -> value
// Returns the value; records every node's value into `trace` (Map node -> value).
export function evaluate(ast, ctx, trace = new Map()) {
  const scopes = [];

  function ev(node) {
    let v;
    try { v = evalNode(node); } catch (e) { if (isErr(e)) v = e; else throw e; }
    trace.set(node, v);
    return v;
  }
  function evAll(nodes) { return nodes.map((n) => (n.type === "missing" ? undefined : ev(n))); }
  function strict(v) { if (isErr(v)) throw v; return v; }

  function evalNode(n) {
    switch (n.type) {
      case "num": case "str": case "bool": return n.value;
      case "err": return E(n.value);
      case "missing": return null;
      case "paren": return ev(n.expr);
      case "percent": return num(strict(ev(n.expr))) / 100;
      case "unary": {
        const v = strict(ev(n.expr));
        if (n.op === "@") return scalar(v);
        if (isArr(v)) return v.map((r) => r.map((x) => (n.op === "-" ? -num(x) : num(x))));
        return n.op === "-" ? -num(v) : num(v);
      }
      case "bin": {
        if (n.op === ":" || n.op === " ") throw new Unsupported("range operator");
        return binop(n.op, strict(ev(n.left)), strict(ev(n.right)));
      }
      case "ref": return ctx.ref(n);
      case "table": { if (!ctx.table) throw new Unsupported("table reference"); return ctx.table(n); }
      case "name": {
        for (let i = scopes.length - 1; i >= 0; i--) if (scopes[i].has(n.name.toUpperCase())) return scopes[i].get(n.name.toUpperCase());
        return ctx.name(n);
      }
      case "array": return n.rows.map((r) => r.map((x) => strict(ev(x))));
      case "func": return callFn(n);
    }
    throw new Unsupported(n.type);
  }

  function callFn(n) {
    const a = n.args;
    switch (n.name) {
      case "IF": {
        const c = strict(ev(a[0]));
        if (isArr(c)) throw new Unsupported("array IF");
        if (bool(c)) return a[1] && a[1].type !== "missing" ? strict(ev(a[1])) : a[1] ? 0 : true;
        return a[2] && a[2].type !== "missing" ? strict(ev(a[2])) : a[2] ? 0 : false;
      }
      case "IFERROR": { const v = ev(a[0]); return isErr(v) ? strict(ev(a[1])) : v; }
      case "IFNA": { const v = ev(a[0]); return isErr(v) && v.error === "#N/A" ? strict(ev(a[1])) : v; }
      case "IFS": {
        for (let i = 0; i < a.length; i += 2) if (bool(strict(ev(a[i])))) return strict(ev(a[i + 1]));
        throw E("#N/A");
      }
      case "SWITCH": {
        const v = strict(ev(a[0]));
        let i = 1;
        for (; i + 1 < a.length; i += 2) if (cmp(scalar(v), scalar(strict(ev(a[i])))) === 0) return strict(ev(a[i + 1]));
        if (i < a.length) return strict(ev(a[i]));
        throw E("#N/A");
      }
      case "CHOOSE": {
        const k = Math.floor(num(strict(ev(a[0]))));
        if (k < 1 || k >= a.length) throw E("#VALUE!");
        return strict(ev(a[k]));
      }
      case "LET": {
        const scope = new Map();
        scopes.push(scope);
        try {
          for (let i = 0; i + 1 < a.length; i += 2) {
            const nm = a[i].type === "name" ? a[i].name.replace(/^_xlpm\./i, "").toUpperCase() : null;
            if (!nm) throw new Unsupported("LET name");
            scope.set(nm, strict(ev(a[i + 1])));
          }
          return strict(ev(a[a.length - 1]));
        } finally { scopes.pop(); }
      }
    }
    const f = FN[n.name];
    if (!f) throw new Unsupported(n.name);
    const args = evAll(a);
    const tolerant = new Set(["ISERROR", "ISNA", "ISBLANK", "ISNUMBER", "ISTEXT", "COUNT", "COUNTA", "COUNTBLANK", "N"]);
    if (!tolerant.has(n.name)) for (const v of args) if (isErr(v)) throw v;
    return f(args);
  }

  const result = ev(ast);
  return { value: result, trace };
}

// True when our recomputed value is "the same" as what Excel saved.
export function sameValue(mine, excel) {
  if (isArr(mine)) mine = mine[0]?.[0];
  if (isErr(mine) || isErr(excel)) return isErr(mine) && isErr(excel) && mine.error === excel.error;
  if (mine == null) mine = 0;
  if (typeof excel === "number") {
    if (typeof mine === "boolean") mine = +mine;
    if (typeof mine !== "number") return false;
    return Math.abs(mine - excel) <= 1e-9 * Math.max(1, Math.abs(excel));
  }
  if (excel == null) return mine === "" || mine === 0;
  if (typeof excel === "boolean") return mine === excel;
  return String(mine) === String(excel);
}

export { isErr, walk };
