import { grade } from './assessment.js';

// Original fictional puzzle rules. The device consumes the teaching runner's
// numeric output; these are game rules, not additional Tolang language features.
export function newVault(seed) {
  return { version:1, seed:seed >>> 0, stage:0, drafts:['','',''], edited:[], stamps:[], cleared:[], submitted:null };
}
export function restoreVault(value, seed) {
  if (!value || value.version !== 1 || !Number.isInteger(value.seed)) return newVault(seed);
  const state=newVault(value.seed);
  state.cleared=[...new Set((Array.isArray(value.cleared)?value.cleared:[]).filter(n=>Number.isInteger(n)&&n>=0&&n<3))];
  // A stage may only be reached through the preceding stages in this run.
  let frontier=0;while(frontier<2&&state.cleared.includes(frontier))frontier++;
  state.stage=Number.isInteger(value.stage)?Math.max(0,Math.min(frontier,value.stage)):0;
  state.stamps=[...new Set((Array.isArray(value.stamps)?value.stamps:[]).filter(n=>Number.isInteger(n)&&n>=0&&n<3))];
  state.drafts=state.drafts.map((_,i)=>typeof value.drafts?.[i]==='string'?value.drafts[i].slice(0,4096):'');
  state.edited=[...new Set((Array.isArray(value.edited)?value.edited:[]).filter(n=>Number.isInteger(n)&&n>=0&&n<3))];
  const source=state.drafts[state.stage];
  if(value.submitted===source&&source)state.submitted=source;
  return state;
}
export function vaultPuzzle(seed, stage) {
  if(!Number.isInteger(stage)||stage<0||stage>2)throw Error('Unknown vault stage');
  let n=(seed+Math.imul(stage+1,2654435761))>>>0;
  const roll=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n;};
  const a=3+roll()%7,b=2+roll()%6,c=2+roll()%5;
  return {
    a,b,c,stage,
    goal:{logs:(stage===2?[a,a+b,a+b+c]:[a+b]).map(String),require:[]},
    starter:stage===0?`(${a} + 0).log()`:stage===1?`let energy = ${a};\n(energy + 0).log()`:'',
    example:stage===0?`(${a} + ${b}).log()`:stage===1?`let energy = ${a};\n(energy + ${b}).log()`:`let signal = ${a};\nsignal.log();\n(signal + ${b}).log();\n(signal + ${b} + ${c}).log()`
  };
}
export function inspectVault(state, source) {
  const puzzle=vaultPuzzle(state.seed,state.stage),report=grade(source,puzzle.goal);
  const actual=report.result?.logs||[];
  let matched=0;while(matched<puzzle.goal.logs.length&&actual[matched]===puzzle.goal.logs[matched])matched++;
  return {...report, matched, expected:puzzle.goal.logs, actual};
}
export function submitVault(state,source) {
  state.drafts[state.stage]=source;state.submitted=source;
  if(!state.edited.includes(state.stage))state.edited.push(state.stage);
  const report=inspectVault(state,source);
  // Stamps describe three completed game mechanisms, never language mastery.
  // Replaying a stage or generating fresh clues cannot award the same stamp twice.
  if(report.ok){
    if(!state.cleared.includes(state.stage))state.cleared.push(state.stage);
    if(!state.stamps.includes(state.stage))state.stamps.push(state.stage);
  }
  return report;
}
export function advanceVault(state) {
  if(state.stage===2||!state.submitted||state.submitted!==state.drafts[state.stage]||!inspectVault(state,state.submitted).ok)return false;
  state.stage++;state.submitted=null;return true;
}
export function replayVault(state,seed) {
  const next=newVault(seed);next.stamps=[...state.stamps];return next;
}
