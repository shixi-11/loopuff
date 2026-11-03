import {inspectPursuitInputs,pursuitInputs} from './pursuit.js';

export const pursuitPracticeSource='if obstacle < 4 then {\n  3.log()\n} else {\n  if energy > 35 then {\n    2.log()\n  } else {\n    1.log()\n  }\n}';
const stamp=(world,source)=>JSON.stringify([world.id,world.role,world.status,world.activeMs,world.draft,world.strategy,pursuitInputs(world),source]);
export function currentPursuitPractice(world,source,report){return !!report&&report.stamp===stamp(world,source);}
export function checkPursuitPractice(world,source){
 const current=pursuitInputs(world),expectedCurrent=current.obstacle<4?'3':current.energy>35?'2':'1';
 // This is the exercise's stated target, not a substitute for running the
 // candidate. The observed actions below always come from the interpreter.
 const samples=[['current',current,expectedCurrent],['near',{...current,energy:60,obstacle:3},'3'],['clear',{...current,energy:60,obstacle:12},'2'],['tired',{...current,energy:20,obstacle:12},'1']];
 const cases=samples.map(([id,inputs,expected])=>{const report=inspectPursuitInputs(inputs,source);return {id,inputs,expected,report,matches:report.ok&&report.logs.length===1&&report.logs[0]===expected};});
 return {stamp:stamp(world,source),source,cases,ready:cases.every(item=>item.matches)};
}
export function stagePursuitPractice(world,source,report,confirmed=false){
 if(!currentPursuitPractice(world,source,report))return 'stale';
 if(!report.ready)return 'mismatch';
 if(!['ready','paused'].includes(world.status))return 'unavailable';
 if(world.draft!==source&&world.draft!=='1.log()'&&!confirmed)return 'confirm';
 world.draft=source;
 return 'staged';
}
export async function persistPursuitPractice(session,world,source,previous){
 let saved=false;try{saved=await session.persist();}catch{}
 // A failed write must not erase the replaced draft. A later edit or a new
 // session owns its own source and must never be rolled back by this request.
 if(!saved&&session.world===world&&world.draft===source)world.draft=previous;
 return saved;
}
