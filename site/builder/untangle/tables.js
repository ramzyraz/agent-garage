// Resolve the same structured reference for both the graph and calculation.
// Unknown selectors must fail visibly, never fall back to the whole table.
export function resolveTable(node, fc, wb) {
  const table = node.table
    ? wb.tables.find((t) => t.name.toLowerCase() === node.table.toLowerCase())
    : wb.tables.find((t) => fc && t.sheet === wb.sheets[fc.sheet].name && fc.c >= t.c1 && fc.c <= t.c2 && fc.r >= t.r1 && fc.r <= t.r2);
  const fail = (reason) => ({ reason: `table reference ${node.table || ''}${node.spec}: ${reason}` });
  if (!table || table.c1 == null) return fail('table not found');
  const sheet = wb.sheets.find((s) => s.name.toLowerCase() === table.sheet.toLowerCase());
  if (!sheet) return fail('sheet not found');
  let spec = node.spec.slice(1, -1).trim();
  let thisRow = spec.startsWith('@');
  if (thisRow) spec = spec.slice(1).trim();
  const items = [], separators = [];
  if (spec.startsWith('[')) {
    let i = 0;
    while (i < spec.length) {
      if (spec[i] !== '[') return fail('unsupported selector');
      let text = '';
      for (i++; i < spec.length && spec[i] !== ']'; i++) {
        if (spec[i] === "'" && i + 1 < spec.length) { text += spec[i] + spec[++i]; }
        else text += spec[i];
      }
      if (spec[i++] !== ']') return fail('unclosed column');
      items.push(text);
      while (spec[i] === ' ') i++;
      if (i === spec.length) break;
      if (spec[i] !== ',' && spec[i] !== ':') return fail('unsupported selector');
      separators.push(spec[i++]);
      while (spec[i] === ' ') i++;
      if (i === spec.length) return fail('missing column');
    }
  } else if (spec) items.push(spec);
  else return fail('empty selector');

  const parts = [], columns = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i].trim();
    if (/^#This Row$/i.test(item)) { thisRow = true; parts.push('row'); }
    else if (/^#(All|Data|Headers|Totals)$/i.test(item)) parts.push(item.slice(1).toLowerCase());
    else if (item.startsWith('#')) return fail('unknown row selector');
    else {
      const name = item.replace(/'([\[\]#'@])/g, '$1').toLowerCase();
      const col = table.columns.findIndex((c) => c.toLowerCase() === name);
      if (col < 0) return fail(`column “${name}” not found`);
      columns.push({ c: table.c1 + col, i });
    }
  }
  // Only a contiguous column range has a rectangular meaning here.
  if (columns.length > 2 || columns.length === 2 && (columns[1].i !== columns[0].i + 1 || separators[columns[0].i] !== ':'))
    return fail('noncontiguous column selectors are not supported');
  if (separators.some((s, i) => s === ':' && (!columns.some((c) => c.i === i) || !columns.some((c) => c.i === i + 1))))
    return fail('unsupported column range');
  const dataStart = table.r1 + table.headerRows, dataEnd = table.r2 - table.totalsRows;
  let r1 = dataStart, r2 = dataEnd;
  if (thisRow) {
    if (parts.some((p) => p !== 'row') || !fc || fc.r < dataStart || fc.r > dataEnd) return fail('current row is outside the table data');
    r1 = r2 = fc.r;
  } else if (parts.length) {
    const rows = [];
    for (const p of parts) {
      if (p === 'all') rows.push([table.r1, table.r2]);
      if (p === 'data') rows.push([dataStart, dataEnd]);
      if (p === 'headers') { if (!table.headerRows) return fail('no header row'); rows.push([table.r1, dataStart - 1]); }
      if (p === 'totals') { if (!table.totalsRows) return fail('no totals row'); rows.push([dataEnd + 1, table.r2]); }
    }
    rows.sort((a, b) => a[0] - b[0]);
    r1 = rows[0][0]; r2 = rows[0][1];
    for (const row of rows.slice(1)) {
      if (row[0] > r2 + 1) return fail('noncontiguous row selectors are not supported');
      r2 = Math.max(r2, row[1]);
    }
  }
  const cs = columns.map((c) => c.c);
  const c1 = cs.length ? Math.min(...cs) : table.c1, c2 = cs.length ? Math.max(...cs) : table.c2;
  return { sheet: sheet.index, range: { c1, c2, r1, r2 }, table: table.name, thisRow };
}
