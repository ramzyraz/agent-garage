// Optional network check against independent, pinned Apache POI fixtures.
// Usage: node projects/builder/tools/check-public-workbooks.mjs [download-directory]
// Workbooks stay outside the repository. Report includes producer metadata and provenance.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { readWorkbook, scanXml } from '../../../site/builder/untangle/xlsx.js';
import { readZip } from '../../../site/builder/untangle/zip.js';
import { buildModel } from '../../../site/builder/untangle/model.js';
import { sheetFlow } from '../../../site/builder/untangle/blocks.js';

const revision = 'ae62bb5116b9aee19ebd5834e3a82066132c9f7f';
const files = ['shared_formulas.xlsx', 'FormulaSheetRange.xlsx', 'evaluate_formula_with_structured_table_references.xlsx',
  'WithChartSheet.xlsx', 'link-external-workbook-b.xlsx', 'FormulaEvalTestData_Copy.xlsx', 'simple-table-named-range.xlsx'];
const expectedHashes = {
  "shared_formulas.xlsx": "31612d513b5ea5aaa69764779f87ac52588687770f3ccbf4b420ec21bc70561f",
  "FormulaSheetRange.xlsx": "1943a81a9d439e3bb843b66fd2f9bcdcf37e31232c850ea31d47681b5d5efa12",
  "evaluate_formula_with_structured_table_references.xlsx": "f460fced2f6bac1f5b4b7d400fd7f2e3ff379af478c01d26388744cefd37a93a",
  "WithChartSheet.xlsx": "792b9f21afdb6b8b1f82345864ee15d55c17a1b54d71c250e82c87304385d362",
  "link-external-workbook-b.xlsx": "6e0e5c2aa3bf870cfeba03cb2350c312c639f2875b6501029d0bc134916b2361",
  "FormulaEvalTestData_Copy.xlsx": "01b21647d53501e8ec10f4eb522945d41ea3c8d1fdd57f8b0142ec34884c33eb",
  "simple-table-named-range.xlsx": "e0ee2fee568358edffac97ad935966b09664625283af2797e4fc4657479f0645"
};
const dir = resolve(process.argv[2] || '/tmp/untangle-public');
await mkdir(dir, { recursive: true });
const reports = [];
for (const file of files) {
  const url = `https://raw.githubusercontent.com/apache/poi/${revision}/test-data/spreadsheet/${file}`;
  const path = join(dir, file);
  let bytes;
  try { bytes = await readFile(path); }
  catch { const response = await fetch(url); if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`); bytes = Buffer.from(await response.arrayBuffer()); await writeFile(path, bytes); }
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedHashes[file], `${file}: fixture content differs from the pinned version`);
  const appXml = await readZip(bytes).text('docProps/app.xml');
  let producer = '', capture = false;
  if (appXml) scanXml(appXml, { onOpen(n) { if (n === 'Application') capture = true; }, onText(t) { if (capture) producer += t; }, onClose(n) { if (n === 'Application') capture = false; } });
  const start = performance.now();
  const m = buildModel(await readWorkbook(bytes));
  const flows = m.sheets.filter((s) => s.kind === 'sheet').map((s) => ({ sheet: s.name, groups: sheetFlow(m, s.index).nodes.length }));
  if (file === 'shared_formulas.xlsx') {
    assert.equal(m.stats.formulas, 40); assert.equal(m.stats.blocks, 1);
    assert.equal(m.verification.matched, 40); assert.equal(m.verification.mismatched, 0);
    assert.equal(m.stats.issues, 0);
  }
  if (file === 'WithChartSheet.xlsx') assert.ok(m.sheets.some((s) => s.kind === 'chart'));
  if (file === 'FormulaSheetRange.xlsx') assert.ok(m.notes.some((n) => n.includes('3D sheet ranges')));
  if (file.includes('structured') || file === 'simple-table-named-range.xlsx') { assert.equal(m.stats.tables, 1); assert.ok(m.stats.inputs >= 2); }
  if (file === 'link-external-workbook-b.xlsx') { assert.equal(m.issues.filter((i) => i.type === 'external').length, 1); assert.equal(m.stats.high, 0); }
  const report = { file, url, sha256: createHash('sha256').update(bytes).digest('hex'), producer,
    ms: Math.round(performance.now()-start), stats: m.stats, verification: m.verification, flows,
    issueTypes: Object.fromEntries([...new Set(m.issues.map((i) => i.type))].map((type) => [type, m.issues.filter((i) => i.type === type).length])) };
  reports.push(report);
  console.log(`${file}: ${producer || 'unknown producer'}; ${m.stats.sheets} sheets, ${m.stats.formulas} formulas, ${m.verification.matched} saved matches, ${m.verification.mismatched} differences`);
}
const result = { source: 'Apache POI test-data/spreadsheet', revision, note: 'Independent parser and navigation checks, not evidence of a production finance model or a full calculation audit.', reports };
await writeFile(join(dir, 'report.json'), JSON.stringify(result, null, 2)+'\n');
console.log(`Public workbook checks passed. Report: ${join(dir,'report.json')}`);
