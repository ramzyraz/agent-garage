import { parse } from './formula.js';
import { sameValue, Unsupported } from './evaluate.js';

// A temporary scenario: recursively recalculate the supported affected paths,
// preserving the workbook, saved caches, and original dependency graph.
export function previewRepair(model, issue, { limit = 2000, budgetMs = 750 } = {}) {
  const target = model.cell(issue.sheet, issue.c, issue.r);
  if (!target || !issue.expected) return { ok: false, reason: 'No proposed formula is available for this finding.' };
  let ast;
  try { ast = parse(issue.expected); } catch { return { ok: false, reason: 'The proposed formula could not be read.' }; }
  return previewScenario(model, issue, { ast, formula: issue.expected, kind: 'repair' }, { limit, budgetMs });
}

// One typed input per scenario. Both kinds share the same bounded calculation
// and baseline checks; scenarios never accumulate or rewrite cells.
export function previewInput(model, position, value, options = {}) {
  const target = model.cell(position.sheet, position.c, position.r);
  const scalar = (v) => ['number', 'string', 'boolean'].includes(typeof v) && (typeof v !== 'number' || Number.isFinite(v));
  if (!target || target.f || target.array || target.dataTable || !scalar(target.value))
    return { ok: false, reason: 'Choose a typed number, text or TRUE/FALSE cell, rather than a formula or error.' };
  if (!scalar(value)) return { ok: false, reason: 'Enter a finite number, text or TRUE/FALSE value.' };
  return previewScenario(model, position, { value, kind: 'input' }, options);
}

export function parseInputValue(text, type) {
  if (type === 'text') return text;
  if (type === 'boolean' && /^(true|false)$/i.test(text.trim())) return /^true$/i.test(text.trim());
  if (type === 'number' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?%?$/i.test(text.trim())) {
    const percent = text.trim().endsWith('%');
    const value = Number(percent ? text.trim().slice(0,-1) : text.trim()) / (percent ? 100 : 1);
    if (Number.isFinite(value)) return value;
  }
  throw new Error(type === 'boolean' ? 'Enter TRUE or FALSE.' : 'Enter a number without commas or a currency symbol (for example 42000 or 30%).');
}

function previewScenario(model, position, scenario, { limit = 2000, budgetMs = 750 } = {}) {
  const { sheet, c, r } = position;
  const target = model.cell(sheet, c, r);
  const targetKey = model.where(sheet, c, r);
  const deadline = performance.now() + budgetMs;
  const cache = new Map(), visiting = new Set();
  const baselineCache = new Set(), baselineVisiting = new Set();
  let checked = 0;
  const checkTime = () => {
    if (performance.now() > deadline || checked >= limit) throw new Unsupported('preview limit reached');
  };
  const numeric = (v) => typeof v === 'number' && Number.isFinite(v);
  // Verify the original chain too, including branches that the changed input
  // might stop using. Otherwise a new IF branch could conceal a stale baseline.
  const verifyBaseline = (fc) => {
    if (baselineCache.has(fc)) return;
    checkTime();
    if (baselineVisiting.has(fc)) throw new Unsupported(`circular reference at ${model.where(fc.sheet,fc.c,fc.r)}`);
    if (fc.refs.some((ref) => ref.ext != null || ref.threeD || ref.missingSheet || ref.unknownName || ref.unresolvedTable) ||
        [...fc.funcs].some((n) => n === 'INDIRECT' || n === 'OFFSET'))
      throw new Unsupported(`unavailable or dynamic reference at ${model.where(fc.sheet,fc.c,fc.r)}`);
    const baseline = model.localCheck(fc);
    if (!baseline.ok) throw new Unsupported(`saved result cannot be verified at ${model.where(fc.sheet,fc.c,fc.r)}`);
    checked++;
    baselineVisiting.add(fc);
    try {
      for (const p of model.precedentCells(fc)) if (p.cell?.fc) verifyBaseline(p.cell.fc);
      baselineCache.add(fc);
    } finally { baselineVisiting.delete(fc); }
  };
  const read = (s, c, r) => {
    const key = model.where(s, c, r);
    if (cache.has(key)) return cache.get(key);
    checkTime();
    if (visiting.has(key)) throw new Unsupported(`circular reference at ${key}`);
    const cell = model.cell(s, c, r);
    if (!cell) return null;
    if (key === targetKey && scenario.kind === 'input') return scenario.value;
    if (key !== targetKey && !cell.fc) return cell.value;
    const fc = key === targetKey ? { sheet: s, c, r } : cell.fc;
    const formula = key === targetKey ? scenario.ast : fc.ast;
    if (!formula || cell.array || cell.dataTable) throw new Unsupported(`unsupported formula at ${key}`);
    if (key !== targetKey) {
      verifyBaseline(fc);
    }
    checked++;
    visiting.add(key);
    try {
      const v = model.evaluateWith(formula, fc, read);
      if (v && typeof v === 'object') throw new Unsupported(`error or array result at ${key}`);
      if (typeof v === 'number' && !Number.isFinite(v)) throw new Unsupported(`non-finite result at ${key}`);
      checkTime();
      cache.set(key, v);
      return v;
    } finally { visiting.delete(key); }
  };
  let proposed;
  try {
    proposed = read(sheet, c, r);
    if (scenario.kind === 'repair' && (!numeric(proposed) || !numeric(target.value))) throw new Unsupported('a numeric result is required');
  } catch (e) {
    return { ok: false, reason: `Preview unavailable: ${e.message}. Recalculate in Excel to check this change.` };
  }
  const down = model.downstream(sheet, c, r, limit);
  const changed = [{ sheet, c, r, before: target.value, after: proposed, target: true }];
  const skipped = [];
  let unchanged = 0, attempted = 0;
  for (const fc of down) {
    if (attempted++ >= limit || performance.now() > deadline) break;
    if (model.where(fc.sheet, fc.c, fc.r) === targetKey) continue;
    try {
      const value = read(fc.sheet, fc.c, fc.r);
      if (sameValue(value, fc.cell.value)) unchanged++;
      else changed.push({ sheet: fc.sheet, c: fc.c, r: fc.r, before: fc.cell.value, after: value });
    } catch (e) {
      skipped.push({ sheet: fc.sheet, c: fc.c, r: fc.r, reason: e.message });
    }
  }
  const unchecked = Math.max(0, down.size - (changed.length - 1) - unchanged - skipped.length);
  return { ok: true, kind: scenario.kind, formula: scenario.formula, changed, skipped, unchecked, unchanged, checked,
    truncated: Boolean(down.truncated), gaps: model.dependencyGaps,
    complete: !skipped.length && !unchecked && !down.truncated && !model.dependencyGaps.length };
}
