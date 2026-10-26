import { run, LessonError } from './runner.js';

export const chaseRoles = ['police', 'thief'];
const layouts = [[], [3, 7, 11], [2, 6, 10, 14]];
export function chasePuzzle(stage) {
  if (!Number.isInteger(stage) || stage < 0 || stage > 2) throw Error('Unknown chase stage');
  return { finish:18, gap:4 + (stage === 2 ? 1 : 0), blocks:[...layouts[stage]], maxSignals:8,
    starter:stage === 0 ? '1.log();\n1.log()' : stage === 1 ? 'let step = 1;\n(step + 1).log();\n(step + 1).log()' : '' };
}

// Each integer is a game movement command. The runner still only prints values.
// A whole plan is validated before either actor moves; no partial execution on errors.
export function inspectChase(role, stage, source) {
  if (!chaseRoles.includes(role)) throw Error('Unknown chase role');
  const p = chasePuzzle(stage);
  let result;
  try { result = run(source); }
  catch (error) {
    if (!(error instanceof LessonError)) throw error;
    return { ok:false, code:error.code, logs:[], frames:[] };
  }
  const logs = result.logs;
  if (!logs.length || logs.length > p.maxSignals || logs.some(n => !/^[1-3]$/.test(n))) {
    return { ok:false, code:'signals', logs, frames:[] };
  }
  let police = 0, thief = p.gap, outcome = 'unfinished';
  const frames = [];
  for (const signal of logs) {
    const current = role === 'police' ? police : thief;
    const target = Math.min(p.finish, current + Number(signal));
    const blocked = p.blocks.includes(target);
    // Capture ends the movement at the interception point, rather than leaving
    // the officer beyond the person they have already caught.
    if (!blocked) { if (role === 'police') police = Math.min(target,thief); else thief = target; }
    // The controlled actor moves first. The rival then advances one space,
    // except when capture or escape has already ended this turn.
    if (police >= thief) outcome = 'caught';
    else if (thief >= p.finish) outcome = 'escaped';
    else {
      if (role === 'police') thief++; else police++;
      if (police >= thief) outcome = 'caught';
      else if (thief >= p.finish) outcome = 'escaped';
    }
    frames.push({ police, thief, signal:Number(signal), blocked, outcome });
    if (outcome !== 'unfinished') break;
  }
  return { ok:outcome === (role === 'police' ? 'caught' : 'escaped'), code:null, logs, frames, outcome };
}

export function newChase() {
  return { version:1, role:'police', work:Object.fromEntries(chaseRoles.map(role => [role,
    { stage:0, drafts:layouts.map((_, i) => chasePuzzle(i).starter), submitted:null, cleared:[] }])) };
}
export function restoreChase(value) {
  const state = newChase();
  if (!value || value.version !== 1) return state;
  if (chaseRoles.includes(value.role)) state.role = value.role;
  for (const role of chaseRoles) {
    const v = value.work?.[role];
    if (!v || typeof v !== 'object') continue;
    const w = state.work[role];
    w.cleared = [...new Set((Array.isArray(v.cleared) ? v.cleared : []).filter(n => Number.isInteger(n) && n >= 0 && n < 3))];
    let frontier = 0; while (frontier < 2 && w.cleared.includes(frontier)) frontier++;
    w.stage = Number.isInteger(v.stage) ? Math.max(0, Math.min(frontier, v.stage)) : 0;
    w.drafts = w.drafts.map((defaultSource, i) => typeof v.drafts?.[i] === 'string' ? v.drafts[i].slice(0,4096) : defaultSource);
    if (typeof v.submitted === 'string' && v.submitted === w.drafts[w.stage]) w.submitted = v.submitted;
  }
  return state;
}
export function submitChase(state, source) {
  const w = state.work[state.role];
  const report = inspectChase(state.role, w.stage, source);
  w.drafts[w.stage] = source; w.submitted = source;
  if (report.ok && !w.cleared.includes(w.stage)) w.cleared.push(w.stage);
  return report;
}
export function advanceChase(state) {
  const w = state.work[state.role];
  if (w.stage >= 2 || w.submitted !== w.drafts[w.stage] || !inspectChase(state.role,w.stage,w.submitted).ok) return false;
  w.stage++; w.submitted = null; return true;
}
