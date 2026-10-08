// Tiny .xlsx writer for tests: sheets = [{ name, state?, rows: { "A1": value | "=FORMULA" } }]
import { deflateRawSync, crc32 } from "node:zlib";
import { parseA1 } from "../../../site/builder/untangle/formula.js";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function makeXlsx(sheets, { names = [], tables = [] } = {}) {
  const files = {};
  files["[Content_Types].xml"] = `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>`;
  files["_rels/.rels"] = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  files["xl/workbook.xml"] = `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}"${s.state ? ` state="${s.state}"` : ""} r:id="rId${i + 1}"/>`).join("")}</sheets><definedNames>${names.map((n) => `<definedName name="${n.name}">${esc(n.ref)}</definedName>`).join("")}</definedNames></workbook>`;
  files["xl/_rels/workbook.xml.rels"] = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}</Relationships>`;
  sheets.forEach((s, i) => {
    const rows = new Map();
    for (const [a, v] of Object.entries(s.rows)) { const p = parseA1(a); if (!rows.has(p.r)) rows.set(p.r, []); rows.get(p.r).push([a, p.c, v]); }
    let x = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>`;
    for (const r of [...rows.keys()].sort((a, b) => a - b)) {
      x += `<row r="${r}">`;
      for (const [a, , v] of rows.get(r).sort((p, q) => p[1] - q[1])) {
        if (typeof v === "string" && v.startsWith("=")) x += `<c r="${a}"><f>${esc(v.slice(1))}</f><v>0</v></c>`;
        else if (Array.isArray(v)) x += `<c r="${a}"><f>${esc(v[0].slice(1))}</f><v>${v[1]}</v></c>`;
        else if (typeof v === "string") x += `<c r="${a}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
        else if (typeof v === 'boolean') x += `<c r="${a}" t="b"><v>${+v}</v></c>`;
        else x += `<c r="${a}"><v>${v}</v></c>`;
      }
      x += "</row>";
    }
    const sheetTables = tables.map((t, index) => ({ ...t, id: index + 1 })).filter((t) => t.sheet === s.name);
    const tableParts = sheetTables.map((t) => `<tablePart r:id="table${t.id}"/>`).join("");
    files[`xl/worksheets/sheet${i + 1}.xml`] = x + `</sheetData>${tableParts ? `<tableParts xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" count="${sheetTables.length}">${tableParts}</tableParts>` : ""}</worksheet>`;
    if (sheetTables.length) files[`xl/worksheets/_rels/sheet${i + 1}.xml.rels`] = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetTables.map((t) => `<Relationship Id="table${t.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table${t.id}.xml"/>`).join("")}</Relationships>`;
    for (const t of sheetTables) files[`xl/tables/table${t.id}.xml`] = `<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="${t.id}" name="${esc(t.name)}" displayName="${esc(t.name)}" ref="${t.ref}" headerRowCount="${t.headerRows ?? 1}" totalsRowCount="${t.totalsRows ?? 0}"><tableColumns count="${t.columns.length}">${t.columns.map((c, j) => `<tableColumn id="${j + 1}" name="${esc(c)}"/>`).join("")}</tableColumns></table>`;
  });
  return zip(files);
}

function zip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const data = Buffer.from(text, "utf8"), comp = deflateRawSync(data), nb = Buffer.from(name), crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nb.length, 26);
    locals.push(lh, nb, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nb);
    offset += 30 + nb.length + comp.length;
  }
  const cd = Buffer.concat(centrals), end = Buffer.alloc(22);
  const n = Object.keys(entries).length;
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(n, 8); end.writeUInt16LE(n, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}
