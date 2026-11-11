import {inspectPursuitInputs,pursuitInputs,newPursuit,startPursuit,deployPursuit,advancePursuit,pursuitSegment} from './pursuit.js';

export const pursuitPracticeStarter='1.log()';
export const pursuitPracticeSource='if obstacle < 4 then {\n  3.log()\n} else {\n  if energy > 35 then {\n    2.log()\n  } else {\n    1.log()\n  }\n}';
const stamp=(world,source)=>JSON.stringify([world.id,world.role,world.status,world.activeMs,world.draft,world.strategy,pursuitInputs(world),source]);
export function currentPursuitPractice(world,source,report){return !!report&&report.stamp===stamp(world,source);}
export function checkPursuitPractice(world,source){
 const current=pursuitInputs(world),expectedCurrent=current.obstacle<4?'3':current.energy>35?'2':'1';
 // This is the exercise's stated target, not a substitute for running the
 // candidate. The observed actions below always come from the interpreter.
 const samples=[['current',current,expectedCurrent],['near',{...current,energy:60,obstacle:3},'3'],['clear',{...current,energy:60,obstacle:12},'2'],['tired',{...current,energy:20,obstacle:12},'1'],
 ['atBoundary',{...current,energy:35,obstacle:4},'1'],['aboveEnergy',{...current,energy:36,obstacle:4},'2'],['closer',{...current,energy:60,obstacle:1},'3'],['priority',{...current,energy:36,obstacle:3},'3'],['tiredNear',{...current,energy:20,obstacle:3},'3']];
 const cases=samples.map(([id,inputs,expected])=>{const report=inspectPursuitInputs(inputs,source);return {id,inputs,expected,report,matches:report.ok&&report.logs.length===1&&report.logs[0]===expected};});
 return {stamp:stamp(world,source),source,cases,ready:cases.every(item=>item.matches)};
}
// Re-enact one observed action with the game's real movement/collision rules.
// This is a separate short street, not a continuation or a grade of the run.
export function replayPursuitPractice(world,item){
 if(!item?.report.ok||item.report.logs.length!==1)return null;
 const state=newPursuit(world.seed,world.role,world.difficulty),action=Number(item.report.logs[0]);
 startPursuit(state);
 const actor=state.actors[state.role],route=pursuitSegment(state,state.role),distance=item.inputs.obstacle;
 actor.energy=item.inputs.energy;
 const index=route.obstacles.findIndex(point=>point>=distance);
 if(distance===999||index<0){actor.obstacle=route.obstacles.length;actor.distance=route.obstacles.at(-1)+1;}
 else {actor.obstacle=index;actor.distance=route.obstacles[index]-distance;}
 deployPursuit(state,`${action}.log()`);
 const frames=[structuredClone(state)];
 advancePursuit(state,10);state.nextDecisionMs=2000;
 for(let elapsed=10;elapsed<1200;){const dt=Math.min(200-elapsed%200,1200-elapsed);advancePursuit(state,dt);elapsed+=dt;frames.push(structuredClone(state));if(state.actors[state.role].collisions||state.actors[state.role].clears)break;}
 return {frames,action};
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
