import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse, print, shiftFormula, r1c1Key, tokenize } from "../../../site/builder/untangle/formula.js";
import { evaluate } from "../../../site/builder/untangle/evaluate.js";
import { readWorkbook } from "../../../site/builder/untangle/xlsx.js";
import { buildModel } from "../../../site/builder/untangle/model.js";
import { makeXlsx } from "./xlsx-fixture.js";
import { previewRepair } from "../../../site/builder/untangle/preview.js";

const SAMPLE = new URL("../../../site/builder/untangle/samples/northwind-plan.xlsx", import.meta.url);

test("table references calculate and trace rows, columns, sections and escaped headers", async () => {
  const m = buildModel(await readWorkbook(makeXlsx([
    { name: 'Sales', rows: {
      A1: 'Units', B1: 'Price', C1: 'Revenue', D1: '#Rate', E1: 'Odd]name',
      A2: 2, B2: 5, C2: ['=[@Units]*[@Price]', 10], D2: 1, E2: 9,
      A3: 3, B3: 7, C3: ['=SalesTable[[#This Row],[Units]]*[@[Price]]', 21], D3: 2, E3: 8,
      C4: ['=SUM(SalesTable[Revenue])', 31],
    } },
    { name: 'Summary', rows: {
      A1: ['=SUM(SalesTable[Revenue])', 31], A2: ['=SUM(SalesTable[[#Totals],[Revenue]])', 31],
      A3: ['=SUM(SalesTable[[Units]:[Price]])', 17], A4: ['=COUNTA(SalesTable[#Headers])', 5],
      A5: ['=SUM(SalesTable[[#Headers],[#Data],[Revenue]])', 31],
      A6: ["=SUM(SalesTable['#Rate])", 3], A7: ["=SUM(SalesTable[Odd']name])", 17],
      A8: ['=SUM(SalesTable)', 68], A9: ['=SUM(SalesTable[[#All],[Revenue]])', 62],
    } },
  ], { tables: [{ name: 'SalesTable', sheet: 'Sales', ref: 'A1:E4', totalsRows: 1, columns: ['Units','Price','Revenue','#Rate','Odd]name'] }] })));
  for (const fc of m.formulas) assert.ok(m.recompute(fc).ok, `${m.where(fc.sheet,fc.c,fc.r)}: ${m.recompute(fc).reason}`);
  assert.equal(m.verification.unsupported, 0);
  assert.equal(m.verification.mismatched, 0);
  assert.equal(m.cell(0,3,2).fc.refs[0].range.r1, 2);
  assert.equal(m.cell(0,3,3).fc.refs[0].range.r1, 3);
  assert.ok([...m.downstream(0,1,3)].some((fc) => fc.sheet === 1));
  assert.deepEqual(m.upstream(m.cell(1,1,1).fc).inputs.map((p) => [p.c,p.r]).sort(), [[1,2],[1,3],[2,2],[2,3]].sort());
});

test("unknown table columns and noncontiguous selectors do not silently read the whole table", async () => {
  const m = buildModel(await readWorkbook(makeXlsx([{ name:'Sales', rows: {
    A1:'Units', B1:'Price', C1:'Other', A2:2, B2:5, C2:7,
    D2:['=SUM(T[Missing])',14], D3:['=SUM(T[[Units],[Other]])',9], D4:['=SUM(T[[#Headers],[#Totals],[Units]])',2],
  }}], { tables: [{ name:'T',sheet:'Sales',ref:'A1:C2',columns:['Units','Price','Other'] }] })));
  assert.equal(m.dependentsOf(0,1,2).size,0);
  assert.equal(m.issues.filter((i)=>i.type==='table-reference').length,3);
  assert.ok(m.dependencyGaps.includes('unresolved references'));
  for (const fc of m.formulas) assert.equal(m.recompute(fc).ok,false);
  const single = buildModel(await readWorkbook(makeXlsx([{name:'Sales',rows:{A1:'Text',A2:'123',B1:['=SUM(T[Text])',0]}}],{tables:[{name:'T',sheet:'Sales',ref:'A1:A2',columns:['Text']}]})));
  assert.equal(single.recompute(single.formulas[0]).ok,true,'a one-cell table column remains a range; numeric text is ignored by SUM');
});

test("repair previews propagate both sample repairs without modifying saved workbook values", async () => {
  const m = buildModel(await readWorkbook(readFileSync(SAMPLE)));
  const before = m.sheets.map((s) => [...s.cells.values()].map((c) => [c.f,c.value]));
  const repair = previewRepair(m,m.issues.find((i)=>i.type==='override'));
  assert.equal(repair.ok,true); assert.equal(repair.complete,true);
  assert.equal(repair.changed[0].after,2736000);
  const dashboard = repair.changed.find((c)=>m.where(c.sheet,c.c,c.r)==='Dashboard!B4');
  assert.ok(Math.abs(dashboard.after - (-1713542.484384001))<1e-6);
  assert.equal(repair.skipped.length,0, 'the text status is supported even when it keeps the same value');
  const total = previewRepair(m,m.issues.find((i)=>i.type==='short-range'));
  assert.equal(total.formula,'SUM(C8:G8)'); assert.equal(total.complete,true);
  assert.ok(Math.abs(total.changed[0].after - (-1189320.86343255))<1e-6);
  assert.deepEqual(m.sheets.map((s)=>[...s.cells.values()].map((c)=>[c.f,c.value])),before);
});

test("repair previews disclose stale, unsupported, circular and bounded downstream paths", async () => {
  const m = buildModel(await readWorkbook(makeXlsx([{name:'S',rows:{
    A1:1, A2:2, B1:['=A1*2',2], B2:['=A2*2',99], C1:['=B1+B2',101],
    D1:['=INDIRECT("B1")',2], E1:['=B1+E1',10], F1:['=B1+1',3],
  }}])));
  const issue={sheet:0,c:2,r:1,expected:'A1*3'};
  const result=previewRepair(m,issue);
  assert.equal(result.ok,true); assert.equal(result.complete,false);
  assert.equal(result.skipped.length,2,'stale upstream and circular paths are withheld; dynamic paths are absent and covered by the global gap warning');
  assert.ok(result.gaps.includes('INDIRECT/OFFSET'));
  assert.ok(!result.changed.some((r)=>r.c===3 || r.c===5));
  assert.equal(result.changed.find((r)=>r.c===6).after,4);
  assert.equal(previewRepair(m,issue,{limit:1}).ok,false);
  assert.equal(previewRepair(m,{...issue,expected:'INDIRECT("A1")'}).ok,false);
});

test("parses the formula shapes real workbooks use", () => {
  const cases = {
    "=SUM(B2:B9)*0.22": "SUM(B2:B9) * 0.22",
    "='My Sheet'!A1+Sheet2!$B$3": "'My Sheet'!A1 + Sheet2!$B$3",
    '=IF(A1>0,VLOOKUP(A1,Rates!A:B,2,FALSE),"none")': 'IF(A1 > 0, VLOOKUP(A1, Rates!A:B, 2, FALSE), "none")',
    "=_xlfn.XLOOKUP(A1,B:B,C:C)": "XLOOKUP(A1, B:B, C:C)",
    "=Table1[[#This Row],[Price]]*[@Qty]": "Table1[[#This Row],[Price]] * [@Qty]",
    "=[1]Rates!C3*2": "[1]Rates!C3 * 2",
    "={1,2;3,4}": "{1, 2; 3, 4}",
    "=LOG10(A1)": "LOG10(A1)",
  };
  for (const [f, want] of Object.entries(cases)) assert.equal(print(parse(f)), want, f);
  assert.equal(tokenize('"A1"&B2').filter((t) => t.type === "ref").length, 1, "text that looks like a ref is not a ref");
});

test("shared formulas shift relative parts only", () => {
  assert.equal(shiftFormula('SUM(B2:B9)*$C$1+"A1"&D$4', 2, 3), 'SUM(D5:D12)*$C$1+"A1"&F$4');
  assert.equal(r1c1Key("=B5-C5", 4, 5), r1c1Key("=B6-C6", 4, 6));
  assert.notEqual(r1c1Key("=B5-C5", 4, 5), r1c1Key("=B5-C6", 4, 6));
});

test("evaluator handles common functions and precedence", () => {
  const ctx = { ref: () => [[1], [2], [3]], name: () => 0 };
  const ev = (f) => evaluate(parse(f), ctx).value;
  assert.equal(ev("=-2^2"), 4); // Excel: unary minus binds tighter
  assert.equal(ev("=SUM(A1:A3)*2"), 12);
  assert.equal(ev('=IF(1>2,"a","b")'), "b");
  assert.equal(ev("=ROUND(2.345,2)"), 2.35);
  assert.equal(ev('=IFERROR(1/0,"x")'), "x");
  assert.equal(ev("=INDEX({10,20,30},2)"), 20);
  assert.equal(ev("=LET(x,3,x*x)"), 9);
});

test("sample: finds every planted mistake and nothing silly", async () => {
  const m = buildModel(await readWorkbook(readFileSync(SAMPLE)));
  const types = m.issues.map((i) => `${i.type}@${m.sheets[i.sheet].name}`);
  for (const want of ["override@Costs", "short-range@P&L", "ref-error@Scratch", "unused-input@Assumptions", "hardcoded@Costs", "hidden@Scratch"]) {
    assert.ok(types.includes(want), `missing ${want}; got ${types.join(", ")}`);
  }
  assert.ok(!types.some((t) => t.startsWith("inconsistent")), "row-oriented model must not produce column pattern noise");
  const ov = m.issues.find((i) => i.type === "override");
  assert.equal(Math.round(ov.expectedValue), 2736000);
  assert.equal(m.stats.formulas, 107);
  // Shared formula expansion: Revenue!D6 must reference D4.
  assert.match(m.cell(1, 4, 6).f, /^D4\*/);
  // Every formula in the sample recomputes to Excel's saved value.
  for (const fc of m.formulas) {
    if (/#REF!/.test(fc.f)) continue;
    assert.ok(m.recompute(fc).ok, `recompute ${m.where(fc.sheet, fc.c, fc.r)} ${fc.f}`);
  }
  // Labels read like a person would name the cell.
  assert.equal(m.labelText(2, 6, 6), "Staff · 2030");
  assert.equal(m.inputs.find((i) => i.sheet === 0 && i.r === 4).label, "Price per cup (2027)");
});

test("dependency tracing: upstream inputs and downstream impact", async () => {
  const m = buildModel(await readWorkbook(readFileSync(SAMPLE)));
  const h8 = m.cell(3, 8, 8).fc; // P&L!H8
  const up = m.upstream(h8);
  assert.ok(up.inputs.some((p) => p.sheet === 0 && p.c === 2 && p.r === 14), "tax rate via the TaxRate name");
  const down = m.downstream(0, 2, 4); // price per cup
  assert.ok([...down].some((f) => f.sheet === 4), "price reaches the dashboard");
});

test("detects circular references, inconsistent formulas, empty refs and errors", async () => {
  const buf = makeXlsx([{
    name: "S", rows: {
      A1: "Item", B1: "Amount", A2: "a", B2: 10, A3: "b", B3: 20, A4: "c", B4: 30,
      C2: "=B2*2", C3: "=B3*2", C4: "=B4*3", C5: "=B5*2", C6: "=B6*2",
      D1: "=D2+1", D2: "=D1+1",
      E1: "=Z99+1",
      F1: ["=INDIRECT(\"A1\")", 0],
    },
  }]);
  const m = buildModel(await readWorkbook(buf));
  const t = new Set(m.issues.map((i) => i.type));
  for (const want of ["circular", "inconsistent", "empty-ref", "untraceable"]) assert.ok(t.has(want), `missing ${want}: ${[...t]}`);
});

test("rejects .xls and garbage with a helpful message", async () => {
  const ole = new Uint8Array(600); ole.set([0xd0, 0xcf, 0x11, 0xe0]);
  await assert.rejects(readWorkbook(ole), /old-style \.xls/);
  await assert.rejects(readWorkbook(new Uint8Array(100)), /isn't a zip/);
});

test("large workbook: 60,000 formulas map in reasonable time", async () => {
  const rows = { A1: "Date", B1: "Units", C1: "Price", D1: "Revenue", E1: "Running total" };
  for (let r = 2; r <= 15001; r++) {
    rows["A" + r] = r; rows["B" + r] = r % 17; rows["C" + r] = 3.5;
    rows["D" + r] = `=B${r}*C${r}`; rows["E" + r] = r === 2 ? "=D2" : `=E${r - 1}+D${r}`;
    rows["F" + r] = `=D${r}*1.2`; rows["G" + r] = `=SUM($D$2:D${r})`;
  }
  rows.F9000 = 42; // a typed override in the middle
  const buf = makeXlsx([{ name: "Data", rows }, { name: "Summary", rows: { A1: "Total", B1: "=SUM(Data!D2:D15001)" } }]);
  const t0 = performance.now();
  const m = buildModel(await readWorkbook(buf));
  const ms = performance.now() - t0;
  console.log(`  ${m.stats.formulas} formulas in ${m.stats.blocks} blocks, ${Math.round(ms)} ms`);
  assert.ok(m.stats.formulas >= 59999);
  assert.ok(m.stats.blocks < 20, `blocks ${m.stats.blocks}`);
  assert.ok(m.issues.some((i) => i.type === "override" && i.r === 9000));
  assert.ok(ms < 30000, `took ${ms} ms`);
});

test("verification checks the upstream chain and flags saved-value discrepancies", async () => {
  const m = buildModel(await readWorkbook(makeXlsx([{ name: 'Stale', rows: {
    A2: 10, B2: ['=A2*2', 99], C2: ['=B2+1', 100],
    D2: ['=A2*3', 30], E2: ['=D2+1', 31], F2: ['=1/0', 0],
    G2: ['=IFERROR(F2,0)', 0], H2: ['=INDIRECT("A2")', 10], I2: ['=H2+1', 11],
  }}])));
  const c = m.recompute(m.cell(0, 3, 2).fc);
  assert.equal(c.ok, false);
  assert.match(c.reason, /Upstream Stale!B2.*doesn't match/);
  assert.deepEqual(c.problem, { sheet: 0, c: 2, r: 2 });
  assert.ok(m.issues.some((i) => i.type === 'saved-mismatch' && i.c === 2));
  assert.equal(m.verification.mismatched, 2, "both the stale B2 and calculated error at F2 differ from their saved results");
  assert.equal(m.recompute(m.cell(0, 5, 2).fc).checked, 2);
  assert.equal(m.recompute(m.cell(0, 6, 2).fc).ok, false, 'an error is not verified');
  assert.equal(m.recompute(m.cell(0, 7, 2).fc).ok, false, 'IFERROR does not bless a broken upstream chain');
  assert.equal(m.recompute(m.cell(0, 9, 2).fc).ok, false, 'unsupported upstream formulas are not blessed');
});

test("external references keep file identity instead of inventing missing sheets", async () => {
  for (const [f, ext, sheet] of [
    ["='[missing.xlsx]Sheet1'!A1", 'missing.xlsx', 'Sheet1'],
    ["='C:\\Models\\[budget.xlsx]My Sheet'!$A$1", 'C:\\Models\\budget.xlsx', 'My Sheet'],
    ['=[1]Rates!B2', 1, 'Rates'],
    ["='[2]My Sheet'!A1", 2, 'My Sheet'],
  ]) {
    const ast = parse(f);
    assert.equal(ast.ext, ext); assert.equal(ast.sheet, sheet);
    const m = buildModel(await readWorkbook(makeXlsx([{ name: 'Results', rows: { A1: [f, 42] } }])));
    assert.ok(m.issues.some((i) => i.type === 'external'), f);
    assert.ok(!m.issues.some((i) => /doesn't exist/.test(i.title)), f);
    assert.equal(m.recompute(m.formulas[0]).ok, false);
    assert.match(m.recompute(m.formulas[0]).reason, /external file/);
  }
  const internal = buildModel(await readWorkbook(makeXlsx([{ name: 'Results', rows: { A1: ['=Missing!A1', 42] } }])));
  assert.ok(internal.issues.some((i) => i.type === 'ref-error'), 'missing internal sheets remain errors');
});

test("block map compresses 10,000 inputs and formulas while retaining cross-sheet flow", async () => {
  const { sheetFlow, flowLayers } = await import('../../../site/builder/untangle/blocks.js');
  const rows = { A1: 'Units', B1: 'Double' };
  for (let r = 2; r <= 10001; r++) { rows['A'+r] = r; rows['B'+r] = ['=A'+r+'*2', r*2]; }
  const m = buildModel(await readWorkbook(makeXlsx([
    { name: 'Data', rows }, { name: 'Summary', rows: { A1: ['=SUM(Data!B2:B10001)', 100030000] } }
  ])));
  const flow = sheetFlow(m, 0);
  assert.equal(flow.nodes.length, 3, 'one input run, one formula block, one destination sheet');
  assert.equal(flow.edges.length, 2);
  const input = flow.nodes.find((n) => n.kind === 'input');
  const calc = flow.nodes.find((n) => n.kind === 'formula');
  const dest = flow.nodes.find((n) => n.kind === 'sheet');
  assert.equal(input.n, 10000); assert.equal(input.rangeText, 'A2:A10001');
  assert.equal(calc.n, 10000); assert.equal(calc.rangeText, 'B2:B10001');
  const layers = flowLayers(flow);
  assert.ok(layers.get(input.id) < layers.get(calc.id));
  assert.ok(layers.get(calc.id) < layers.get(dest.id));
  const summary = sheetFlow(m, 1);
  assert.equal(summary.nodes.filter((n) => n.kind === 'formula').length, 2);
  assert.equal(summary.edges.length, 1);
});
