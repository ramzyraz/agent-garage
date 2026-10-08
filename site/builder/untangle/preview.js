import { parse } from './formula.js';
import { sameValue, Unsupported } from './evaluate.js';

// A temporary scenario: recursively recalculate the supported affected paths,
// preserving the workbook, saved caches, and original dependency graph.
export function previewRepair(model, issue, { limit = 2000, budgetMs = 750 } = {}) {
  const target = model.cell(issue.sheet, issue.c, issue.r);
  if (!target || !issue.expected) return { ok: false, reason: 'No proposed formula is available for this finding.' };
  let ast;
  try { ast = parse(issue.expected); } catch { return { ok: false, reason: 'The proposed formula could not be read.' }; }
  const targetKey = model.where(issue.sheet, issue.c, issue.r);
  const deadline = performance.now() + budgetMs;
  const cache = new Map(), visiting = new Set();
  let checked = 0;
  const checkTime = () => {
    if (performance.now() > deadline || checked >= limit) throw new Unsupported('preview limit reached');
  };
  const numeric = (v) => typeof v === 'number' && Number.isFinite(v);
  const read = (s, c, r) => {
    const key = model.where(s, c, r);
    if (cache.has(key)) return cache.get(key);
    checkTime();
    if (visiting.has(key)) throw new Unsupported(`circular reference at ${key}`);
    const cell = model.cell(s, c, r);
    if (!cell) return null;
    if (key !== targetKey && !cell.fc) return cell.value;
    const fc = key === targetKey ? { sheet: s, c, r } : cell.fc;
    const formula = key === targetKey ? ast : fc.ast;
    if (!formula || cell.array || cell.dataTable) throw new Unsupported(`unsupported formula at ${key}`);
    if (key !== targetKey) {
      // Qualify the baseline before presenting a predicted change.
      const baseline = model.localCheck(fc);
      if (!baseline.ok) throw new Unsupported(`saved result cannot be verified at ${key}`);
      if ([...fc.funcs].some((n) => n === "INDIRECT" || n === "OFFSET")) throw new Unsupported(`dynamic reference at ${key}`);
      if (fc.refs.some((ref) => ref.ext != null || ref.threeD || ref.missingSheet || ref.unknownName || ref.unresolvedTable))
        throw new Unsupported(`unavailable reference at ${key}`);
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
    proposed = read(issue.sheet, issue.c, issue.r);
    if (!numeric(proposed) || !numeric(target.value)) throw new Unsupported('a numeric result is required');
  } catch (e) {
    return { ok: false, reason: `Preview unavailable: ${e.message}. Recalculate in Excel to check this repair.` };
  }
  const down = model.downstream(issue.sheet, issue.c, issue.r, limit);
  const changed = [{ sheet: issue.sheet, c: issue.c, r: issue.r, before: target.value, after: proposed, target: true }];
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
  return { ok: true, formula: issue.expected, changed, skipped, unchecked, unchanged, checked,
    truncated: Boolean(down.truncated), gaps: model.dependencyGaps,
    complete: !skipped.length && !unchecked && !down.truncated && !model.dependencyGaps.length };
}
