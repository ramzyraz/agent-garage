// Read an .xlsx/.xlsm workbook into plain objects: sheets, cells (value + formula),
// defined names, tables and external links. Runs entirely in the page.

import { readZip } from "./zip.js";
import { parseA1, shiftFormula, colToNum } from "./formula.js";

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
export function unescapeXml(s) {
  if (s.indexOf("&") < 0) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (m, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : +e.slice(1));
    return ENT[e] ?? m;
  });
}

// Tiny streaming XML scanner. Calls onOpen(name, attrs, selfClosing), onText(text), onClose(name).
// Namespace prefixes are stripped (x:c -> c). Good enough for Office Open XML.
export function scanXml(xml, { onOpen, onText, onClose }) {
  let i = 0;
  const n = xml.length;
  while (i < n) {
    const lt = xml.indexOf("<", i);
    if (lt < 0) break;
    if (lt > i && onText) onText(xml.slice(i, lt));
    if (xml.startsWith("<!--", lt)) { i = xml.indexOf("-->", lt) + 3; continue; }
    if (xml.startsWith("<![CDATA[", lt)) {
      const end = xml.indexOf("]]>", lt);
      if (onText) onText(null, xml.slice(lt + 9, end));
      i = end + 3; continue;
    }
    if (xml[lt + 1] === "?" || xml[lt + 1] === "!") { i = xml.indexOf(">", lt) + 1; continue; }
    const gt = findTagEnd(xml, lt);
    if (xml[lt + 1] === "/") {
      if (onClose) onClose(local(xml.slice(lt + 2, gt).trim()));
      i = gt + 1; continue;
    }
    let body = xml.slice(lt + 1, gt);
    const self = body.endsWith("/");
    if (self) body = body.slice(0, -1);
    const sp = body.search(/\s/);
    const name = local(sp < 0 ? body : body.slice(0, sp));
    const attrs = {};
    if (sp >= 0) {
      const re = /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
      let m;
      const a = body.slice(sp);
      while ((m = re.exec(a))) attrs[local(m[1])] = unescapeXml(m[3] ?? m[4]);
    }
    if (onOpen) onOpen(name, attrs, self);
    if (self && onClose) onClose(name);
    i = gt + 1;
  }
}

function findTagEnd(xml, from) {
  let q = null;
  for (let j = from + 1; j < xml.length; j++) {
    const c = xml[j];
    if (q) { if (c === q) q = null; }
    else if (c === '"' || c === "'") q = c;
    else if (c === ">") return j;
  }
  return xml.length;
}

function local(name) {
  const k = name.indexOf(":");
  return k < 0 ? name : name.slice(k + 1);
}

function parseRels(xml) {
  const rels = {};
  if (!xml) return rels;
  scanXml(xml, {
    onOpen(name, a) {
      if (name === "Relationship") rels[a.Id] = { target: a.Target, type: (a.Type || "").split("/").pop(), external: a.TargetMode === "External" };
    },
  });
  return rels;
}

function resolvePath(base, target) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/");
  parts.pop();
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

function relsPath(part) {
  const k = part.lastIndexOf("/");
  return `${part.slice(0, k)}/_rels/${part.slice(k + 1)}.rels`;
}

function parseSharedStrings(xml) {
  const out = [];
  if (!xml) return out;
  let cur = null, inT = false, skip = 0;
  scanXml(xml, {
    onOpen(name, a, self) {
      if (name === "si") cur = "";
      else if (name === "rPh") { if (!self) skip++; }
      else if (name === "t" && !self) inT = true;
    },
    onText(t, cdata) { if (inT && !skip && cur != null) cur += cdata ?? unescapeXml(t); },
    onClose(name) {
      if (name === "t") inT = false;
      else if (name === "rPh") skip = Math.max(0, skip - 1);
      else if (name === "si") { out.push(cur); cur = null; }
    },
  });
  return out;
}

function decodeExcelEscapes(s) {
  return s.replace(/_x([0-9A-Fa-f]{4})_/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
}

// Parse one worksheet's XML into a Map "A1" -> cell.
function parseSheet(xml, strings) {
  const cells = new Map();
  const sharedMasters = new Map(); // si -> { text, c, r }
  const pendingShared = [];
  let cell = null, field = null, buf = "", fAttrs = null;
  let maxR = 0, maxC = 0;
  let dimension = null;
  const merges = [];
  let rowAuto = 0, colAuto = 0;
  const hiddenRows = new Set(), hiddenCols = [];

  scanXml(xml, {
    onOpen(name, a, self) {
      if (name === "row") {
        rowAuto = a.r ? +a.r : rowAuto + 1; colAuto = 0;
        if (a.hidden === "1" || a.hidden === "true") hiddenRows.add(rowAuto);
      } else if (name === "c") {
        let pos = a.r ? parseA1(a.r) : null;
        if (!pos) pos = { c: colAuto + 1, r: rowAuto };
        colAuto = pos.c;
        cell = { c: pos.c, r: pos.r, t: a.t || "n", s: a.s ? +a.s : 0, v: null, f: null };
        if (self) finishCell();
      } else if (cell && (name === "v" || name === "t" || name === "f")) {
        field = name; buf = "";
        if (name === "f") fAttrs = a;
        if (self) closeField(name);
      } else if (name === "dimension") dimension = a.ref;
      else if (name === "mergeCell" && a.ref) merges.push(a.ref);
      else if (name === "col" && (a.hidden === "1" || a.hidden === "true")) hiddenCols.push([+a.min, +a.max]);
    },
    onText(t, cdata) { if (field) buf += cdata ?? t; },
    onClose(name) {
      if (field && name === field) closeField(name);
      else if (name === "c" && cell) finishCell();
    },
  });

  function closeField(name) {
    const raw = unescapeXml(buf);
    if (name === "v") cell.v = raw;
    else if (name === "t") cell.v = (cell.v || "") + raw;
    else if (name === "f") {
      const a = fAttrs || {};
      if (a.t === "shared" && a.si != null) {
        if (raw) {
          sharedMasters.set(a.si, { text: raw, c: cell.c, r: cell.r });
          cell.f = raw;
        } else { pendingShared.push({ cell, si: a.si }); cell.pend = true; }
      } else if (raw) cell.f = raw;
      if (a.t === "array") { cell.array = a.ref || null; }
      if (a.t === "dataTable") cell.dataTable = true;
    }
    field = null; buf = "";
  }

  function finishCell() {
    const c = cell;
    cell = null;
    let value = null;
    switch (c.t) {
      case "s": value = c.v != null ? strings[+c.v] ?? "" : null; break;
      case "str": case "inlineStr": value = c.v != null ? decodeExcelEscapes(c.v) : null; break;
      case "b": value = c.v === "1"; break;
      case "e": value = { error: c.v }; break;
      case "d": value = c.v; break;
      default: value = c.v != null && c.v !== "" ? +c.v : null;
    }
    if (value === null && !c.f && !c.pend) return; // styling-only cell
    const out = { c: c.c, r: c.r, value, f: c.f, s: c.s };
    if (c.array) out.array = c.array;
    if (c.dataTable) out.dataTable = true;
    cells.set(c.c + "," + c.r, out);
    if (c.r > maxR) maxR = c.r;
    if (c.c > maxC) maxC = c.c;
    c.out = out;
  }

  for (const p of pendingShared) {
    const m = sharedMasters.get(p.si);
    const o = p.cell.out;
    if (m && o) o.f = shiftFormula(m.text, o.c - m.c, o.r - m.r);
  }
  return { cells, maxR, maxC, dimension, merges, hiddenRows, hiddenCols };
}

function parseTable(xml) {
  const t = { name: "", ref: "", columns: [], headerRows: 1, totalsRows: 0 };
  scanXml(xml, {
    onOpen(name, a) {
      if (name === "table") {
        t.name = a.displayName || a.name; t.ref = a.ref;
        t.headerRows = a.headerRowCount != null ? +a.headerRowCount : 1;
        t.totalsRows = a.totalsRowCount != null ? +a.totalsRowCount : 0;
      } else if (name === "tableColumn") t.columns.push(a.name);
    },
  });
  return t;
}

function parseExternalLink(xml) {
  const ext = { sheets: [], rid: null };
  scanXml(xml, {
    onOpen(name, a) {
      if (name === "externalBook") ext.rid = a.id;
      else if (name === "sheetName") ext.sheets.push(a.val);
    },
  });
  return ext;
}

export async function readWorkbook(buffer, onProgress = () => {}) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    throw new Error("This is an old-style .xls file or a password-protected workbook. Untangle reads .xlsx and .xlsm: in Excel, use File › Save As › Excel Workbook (.xlsx), and remove the password, then try again.");
  }
  const zip = readZip(bytes);
  const wbPath = "xl/workbook.xml";
  const wbXml = await zip.text(wbPath);
  if (!wbXml) throw new Error("No workbook found inside this file. Is it really an Excel .xlsx?");
  const wbRels = parseRels(await zip.text(relsPath(wbPath)));

  const sheetsMeta = [];
  const definedNames = [];
  let curName = null, nameBuf = "";
  const extRefs = [];
  scanXml(wbXml, {
    onOpen(name, a) {
      if (name === "sheet") sheetsMeta.push({ name: a.name, rid: a.id, state: a.state || "visible" });
      else if (name === "definedName") { curName = a; nameBuf = ""; }
      else if (name === "externalReference") extRefs.push(a.id);
    },
    onText(t) { if (curName) nameBuf += t; },
    onClose(name) {
      if (name === "definedName" && curName) {
        definedNames.push({
          name: curName.name, ref: unescapeXml(nameBuf),
          scope: curName.localSheetId != null ? +curName.localSheetId : null, hidden: curName.hidden === "1",
        });
        curName = null;
      }
    },
  });

  let strings = [];
  const ssRel = Object.values(wbRels).find((r) => r.type === "sharedStrings");
  const ssPath = ssRel ? resolvePath(wbPath, ssRel.target) : "xl/sharedStrings.xml";
  strings = parseSharedStrings(await zip.text(ssPath));

  // Number formats tell us which numbers are dates or percentages.
  const styles = await readStyles(zip, wbRels, wbPath);

  const externals = [];
  for (const rid of extRefs) {
    const rel = wbRels[rid];
    if (!rel) { externals.push(null); continue; }
    const p = resolvePath(wbPath, rel.target);
    const x = await zip.text(p);
    const info = x ? parseExternalLink(x) : { sheets: [] };
    const er = parseRels(await zip.text(relsPath(p)));
    const target = info.rid && er[info.rid] ? er[info.rid].target : "unknown file";
    externals.push({ file: decodeURIComponent(target.replace(/^file:\/+/, "")), sheets: info.sheets });
  }

  const sheets = [];
  const tables = [];
  for (let i = 0; i < sheetsMeta.length; i++) {
    const meta = sheetsMeta[i];
    const rel = wbRels[meta.rid];
    onProgress(`Reading sheet ${i + 1} of ${sheetsMeta.length}: ${meta.name}`);
    await new Promise((r) => setTimeout(r, 0));
    if (!rel) continue;
    const path = resolvePath(wbPath, rel.target);
    const kind = rel.type === "chartsheet" ? "chart" : rel.type === "worksheet" ? "sheet" : rel.type;
    if (kind !== "sheet") { sheets.push({ name: meta.name, state: meta.state, kind, cells: new Map(), maxR: 0, maxC: 0, index: sheets.length }); continue; }
    const xml = await zip.text(path);
    const parsed = xml ? parseSheet(xml, strings) : { cells: new Map(), maxR: 0, maxC: 0 };
    const sheet = { name: meta.name, state: meta.state, kind, index: sheets.length, ...parsed };
    sheets.push(sheet);
    const srels = parseRels(await zip.text(relsPath(path)));
    for (const r of Object.values(srels)) {
      if (r.type !== "table") continue;
      const tx = await zip.text(resolvePath(path, r.target));
      if (!tx) continue;
      const t = parseTable(tx);
      t.sheet = meta.name;
      const [a, b] = t.ref.split(":");
      const pa = parseA1(a), pb = parseA1(b || a);
      if (pa && pb) Object.assign(t, { c1: pa.c, r1: pa.r, c2: pb.c, r2: pb.r });
      tables.push(t);
    }
  }
  for (const s of sheets) {
    if (!s.cells) continue;
    for (const cell of s.cells.values()) {
      const fmt = styles[cell.s];
      if (fmt) cell.fmt = fmt;
    }
  }
  const hasMacros = zip.names().some((n) => /vbaProject\.bin$/i.test(n));
  return { sheets, definedNames, tables, externals, hasMacros };
}

const BUILTIN_DATE = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
async function readStyles(zip, wbRels, wbPath) {
  const rel = Object.values(wbRels).find((r) => r.type === "styles");
  const xml = await zip.text(rel ? resolvePath(wbPath, rel.target) : "xl/styles.xml");
  if (!xml) return [];
  const custom = {};
  const xfs = [];
  let inCellXfs = false;
  scanXml(xml, {
    onOpen(name, a) {
      if (name === "numFmt") custom[a.numFmtId] = a.formatCode;
      else if (name === "cellXfs") inCellXfs = true;
      else if (name === "xf" && inCellXfs) xfs.push(+a.numFmtId || 0);
    },
    onClose(name) { if (name === "cellXfs") inCellXfs = false; },
  });
  return xfs.map((id) => {
    if (id === 9 || id === 10) return "pct";
    if (BUILTIN_DATE.has(id)) return "date";
    const code = custom[id];
    if (!code) return id >= 5 && id <= 8 ? "money" : null;
    const clean = code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, "");
    if (/%/.test(clean)) return "pct";
    if (/[dmyhs]/i.test(clean) && !/0/.test(clean.replace(/[dmyhs]/gi, ""))) return "date";
    if (/[$€£¥]/.test(code)) return "money";
    return null;
  });
}

export { colToNum };
