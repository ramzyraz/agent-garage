// Builds site/builder/untangle/samples/northwind-plan.xlsx: a small but realistic
// 5-year plan with a few classic, deliberately planted mistakes. Values are
// computed with Untangle's own evaluator so Excel's cached results are present.
// Usage: node projects/builder/tools/make-sample.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { deflateRawSync, crc32 } from "node:zlib";
import { parse, parseA1, addr } from "../../../site/builder/untangle/formula.js";
import { evaluate } from "../../../site/builder/untangle/evaluate.js";

const YEARS = ["C", "D", "E", "F", "G"];
const sheets = [];
function sheet(name, state = "visible") { const s = { name, state, cells: new Map(), widths: {} }; sheets.push(s); return s; }
function put(s, a, v, style = 0) {
  const cell = { a, style };
  if (typeof v === "string" && v.startsWith("=")) cell.f = v.slice(1);
  else cell.v = v;
  s.cells.set(a, cell);
}
const PCT = 1, MONEY = 2, BOLD = 3, NUM = 4;

// ---------- Assumptions ----------
const as = sheet("Assumptions");
as.widths = { A: 34, B: 14, C: 46 };
put(as, "A1", "Northwind Coffee: 5-year plan", BOLD);
put(as, "A3", "Assumption", BOLD); put(as, "B3", "Value", BOLD); put(as, "C3", "Notes", BOLD);
const A = [
  ["Price per cup (2027)", 4.6, MONEY, "Average ticket ÷ cups"],
  ["Cups per store per day", 310, NUM, "From the pilot store"],
  ["Days open per year", 360, NUM, ""],
  ["Price increase per year", 0.03, PCT, ""],
  ["Cost of goods (% of sales)", 0.31, PCT, "Beans, milk, cups"],
  ["Rent per store per year", 84000, MONEY, ""],
  ["Staff per store", 6, NUM, ""],
  ["Salary per staff member", 38000, MONEY, "Fully loaded"],
  ["Marketing (% of sales)", 0.05, PCT, "Agreed with the board in March"],
  ["Opening cost per new store", 250000, MONEY, "Fit-out and equipment"],
  ["Tax rate", 0.25, PCT, ""],
];
A.forEach(([label, v, st, note], i) => {
  put(as, `A${4 + i}`, label); put(as, `B${4 + i}`, v, st); if (note) put(as, `C${4 + i}`, note);
});
put(as, "A16", "Stores open (end of year)", BOLD);
YEARS.forEach((c, i) => { put(as, `${c}16`, 2027 + i, BOLD); put(as, `${c}17`, [4, 6, 9, 12, 15][i]); });
put(as, "A17", "Stores");

// ---------- Revenue ----------
const rv = sheet("Revenue");
rv.widths = { A: 26, C: 14, D: 14, E: 14, F: 14, G: 14 };
put(rv, "A1", "Revenue", BOLD);
YEARS.forEach((c, i) => {
  put(rv, `${c}3`, i === 0 ? 2027 : `=${YEARS[i - 1]}3+1`, BOLD);
  put(rv, `${c}4`, `=Assumptions!${c}17`);
  put(rv, `${c}5`, `=Assumptions!$B$4*(1+Assumptions!$B$7)^(${c}$3-$C$3)`, MONEY);
  put(rv, `${c}6`, `=${c}4*Assumptions!$B$5*Assumptions!$B$6`, NUM);
  put(rv, `${c}7`, `=${c}5*${c}6`, MONEY);
});
rv.shared = { 6: "C6:G6" }; // stored as an Excel "shared formula", like real files
put(rv, "A4", "Stores"); put(rv, "A5", "Price per cup"); put(rv, "A6", "Cups sold"); put(rv, "A7", "Revenue");

// ---------- Costs ----------
const co = sheet("Costs");
co.widths = { A: 26, C: 14, D: 14, E: 14, F: 14, G: 14 };
put(co, "A1", "Costs", BOLD);
YEARS.forEach((c, i) => {
  put(co, `${c}3`, `=Revenue!${c}3`, BOLD);
  put(co, `${c}4`, `=Revenue!${c}7*Assumptions!$B$8`, MONEY);
  put(co, `${c}5`, `=Revenue!${c}4*Assumptions!$B$9`, MONEY);
  put(co, `${c}6`, `=Revenue!${c}4*Assumptions!$B$10*Assumptions!$B$11`, MONEY);
  put(co, `${c}7`, `=Revenue!${c}7*0.04`, MONEY); // planted: ignores the 5% assumption
  put(co, `${c}8`, i === 0 ? `=Revenue!C4*Assumptions!$B$13` : `=(Revenue!${c}4-Revenue!${YEARS[i - 1]}4)*Assumptions!$B$13`, MONEY);
  put(co, `${c}9`, `=SUM(${c}4:${c}8)`, MONEY);
});
put(co, "F6", 2280000, MONEY); // planted: last year's number typed over the formula
put(co, "A4", "Cost of goods"); put(co, "A5", "Rent"); put(co, "A6", "Staff"); put(co, "A7", "Marketing");
put(co, "A8", "New store openings"); put(co, "A9", "Total costs");

// ---------- P&L ----------
const pl = sheet("P&L");
pl.widths = { A: 26, C: 14, D: 14, E: 14, F: 14, G: 14, H: 16 };
put(pl, "A1", "Profit and loss", BOLD);
put(pl, "H3", "5-year total", BOLD);
YEARS.forEach((c) => {
  put(pl, `${c}3`, `=Revenue!${c}3`, BOLD);
  put(pl, `${c}4`, `=Revenue!${c}7`, MONEY);
  put(pl, `${c}5`, `=Costs!${c}9`, MONEY);
  put(pl, `${c}6`, `=${c}4-${c}5`, MONEY);
  put(pl, `${c}7`, `=MAX(0,${c}6*TaxRate)`, MONEY);
  put(pl, `${c}8`, `=${c}6-${c}7`, MONEY);
  put(pl, `${c}10`, `=IFERROR(${c}8/${c}4,0)`, PCT);
});
for (const r of [4, 5, 6, 7]) put(pl, `H${r}`, `=SUM(C${r}:G${r})`, MONEY);
put(pl, "H8", "=SUM(C8:F8)", MONEY); // planted: misses 2031
put(pl, "A4", "Revenue"); put(pl, "A5", "Total costs"); put(pl, "A6", "Profit before tax"); put(pl, "A7", "Tax");
put(pl, "A8", "Net profit"); put(pl, "A10", "Net margin");

// ---------- Dashboard ----------
const db = sheet("Dashboard");
db.widths = { A: 30, B: 26 };
put(db, "A1", "Northwind Coffee: plan at a glance", BOLD);
put(db, "A3", "5-year revenue"); put(db, "B3", "='P&L'!H4", MONEY);
put(db, "A4", "5-year net profit"); put(db, "B4", "='P&L'!H8", MONEY);
put(db, "A5", "Stores by 2031"); put(db, "B5", "=Revenue!G4");
put(db, "A6", "Best year for profit"); put(db, "B6", "=INDEX('P&L'!C3:G3,MATCH(MAX('P&L'!C8:G8),'P&L'!C8:G8,0))");
put(db, "A7", "Average net margin"); put(db, "B7", "=AVERAGE('P&L'!C10:G10)", PCT);
put(db, "A8", "Verdict"); put(db, "B8", '=IF(B4>0,"Profitable over 5 years","Loses money")');
put(db, "A9", "Cash buffer needed"); put(db, "B9", "=Scratch!B4", MONEY);

// ---------- Scratch (hidden) ----------
const sc = sheet("Scratch", "hidden");
put(sc, "A1", "old workings, do not use");
put(sc, "A3", "Buffer months"); put(sc, "B3", 3);
put(sc, "A4", "Buffer"); put(sc, "B4", "=B3*Costs!C9/12", MONEY);
put(sc, "A6", "Old FX rate"); put(sc, "B6", "=#REF!*1.1");

const definedNames = [{ name: "TaxRate", ref: "Assumptions!$B$14" }];

// ---------- compute cached values ----------
const byName = new Map(sheets.map((s) => [s.name.toLowerCase(), s]));
function valueAt(s, a) { const c = s.cells.get(a); return c ? (c.f ? c.result : c.v) : null; }
for (let pass = 0; pass < 20; pass++) {
  for (const s of sheets) for (const cell of s.cells.values()) {
    if (!cell.f) continue;
    const ctx = {
      ref(n) {
        const sh = n.sheet ? byName.get(n.sheet.toLowerCase()) : s;
        const rg = n.range;
        if (rg.c1 === rg.c2 && rg.r1 === rg.r2) return valueAt(sh, addr(rg.c1, rg.r1));
        const out = [];
        for (let r = rg.r1; r <= rg.r2; r++) { const row = []; for (let c = rg.c1; c <= rg.c2; c++) row.push(valueAt(sh, addr(c, r))); out.push(row); }
        return out;
      },
      name(n) { const d = definedNames.find((x) => x.name.toLowerCase() === n.name.toLowerCase()); return ctx.ref(parse(d.ref)); },
    };
    const { value } = evaluate(parse(cell.f), ctx);
    cell.result = Array.isArray(value) ? value[0][0] : value;
  }
}

// ---------- write xlsx ----------
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function sheetXml(s) {
  const rows = new Map();
  for (const cell of s.cells.values()) {
    const p = parseA1(cell.a);
    if (!rows.has(p.r)) rows.set(p.r, []);
    rows.get(p.r).push({ ...cell, ...p });
  }
  const masters = {};
  let out = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`;
  const w = Object.entries(s.widths);
  if (w.length) out += `<cols>${w.map(([c, wd]) => { const n = parseA1(c + "1").c; return `<col min="${n}" max="${n}" width="${wd}" customWidth="1"/>`; }).join("")}</cols>`;
  out += "<sheetData>";
  for (const r of [...rows.keys()].sort((a, b) => a - b)) {
    out += `<row r="${r}">`;
    for (const cell of rows.get(r).sort((a, b) => a.c - b.c)) {
      const st = cell.style ? ` s="${cell.style}"` : "";
      if (cell.f) {
        const res = cell.result;
        const err = res && typeof res === "object" && "error" in res;
        const t = err ? ' t="e"' : typeof res === "string" ? ' t="str"' : typeof res === "boolean" ? ' t="b"' : "";
        const v = err ? res.error : typeof res === "boolean" ? +res : res;
        let f = `<f>${esc(cell.f)}</f>`;
        const sh = s.shared && s.shared[r];
        if (sh) {
          if (!masters[r]) { masters[r] = true; f = `<f t="shared" ref="${sh}" si="${r}">${esc(cell.f)}</f>`; }
          else f = `<f t="shared" si="${r}"/>`;
        }
        out += `<c r="${cell.a}"${st}${t}>${f}<v>${esc(v)}</v></c>`;
      } else if (typeof cell.v === "string") out += `<c r="${cell.a}"${st} t="inlineStr"><is><t>${esc(cell.v)}</t></is></c>`;
      else out += `<c r="${cell.a}"${st}><v>${cell.v}</v></c>`;
    }
    out += "</row>";
  }
  return out + "</sheetData></worksheet>";
}

const files = {
  "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
  "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}"${s.state !== "visible" ? ` state="${s.state}"` : ""} r:id="rId${i + 1}"/>`).join("")}</sheets><definedNames>${definedNames.map((d) => `<definedName name="${d.name}">${esc(d.ref)}</definedName>`).join("")}</definedNames><calcPr calcId="191029"/></workbook>`,
  "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`,
};
sheets.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(s); });

function zip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const data = Buffer.from(text, "utf8");
    const comp = deflateRawSync(data);
    const nameB = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nameB.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, nameB, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nameB.length, 28); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameB);
    offset += 30 + nameB.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(entries).length, 8); end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

const outDir = new URL("../../../site/builder/untangle/samples/", import.meta.url);
mkdirSync(outDir, { recursive: true });
const buf = zip(files);
writeFileSync(new URL("northwind-plan.xlsx", outDir), buf);
console.log(`wrote northwind-plan.xlsx (${buf.length} bytes)`);
const show = (s, a) => console.log(`${s}!${a} =`, valueAt(byName.get(s.toLowerCase()), a));
show("P&L", "H8"); show("P&L", "G8"); show("Dashboard", "B6"); show("Dashboard", "B9"); show("Scratch", "B6");
