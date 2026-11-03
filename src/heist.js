import {run} from './runner.js';
import {heistRules,heistWorld,heistPhase,heistTarget,heistInCover,heistVisible,heistStateKeys,normalizeHeist} from '../server/heist-format.mjs';
export {heistRules,heistWorld,heistPhase,heistTarget,heistInCover,heistVisible};
const fail=code=>Object.assign(Error(code),{code});
const durations=heistRules.operationMs;
export function newHeist(seed,mode='practice',id=crypto.randomUUID()){
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||!['practice','timed'].includes(mode)||typeof id!=='string'||!id||id.length>64)throw fail('settings');
 const w=heistWorld(seed);
 return {version:1,seed,id,mode,status:'ready',activeMs:0,remainderMs:0,x:6000,guardX:w.guardStart,facing:w.guardFacing,energy:100000,alarm:0,peakAlarm:0,key:false,door:false,bag:false,useMs:0,command:3,nextDecisionMs:0,decisions:0,hidden:false,visible:false,blocked:false,strategy:'',draft:'',outcome:null,eventSerial:0,events:[],lastReport:null};
}
const event=(s,kind)=>{s.events.push({id:++s.eventSerial,at:s.activeMs,kind,x:s.x,guardX:s.guardX});if(s.events.length>64)s.events.shift();};
export function heistInputs(s){return {distance:Math.floor((heistTarget(s)-s.x)/1000),guard:Math.floor((s.guardX-s.x)/1000),facing:s.facing,cover:heistInCover(s),alarm:Math.floor(s.alarm/1000),energy:Math.floor(s.energy/1000),phase:heistPhase(s)};}
export function inspectHeist(s,source){
 const inputs=heistInputs(s),suffix=`\ndecide(${Object.values(inputs).join(', ')}).log()`;
 if(typeof source!=='string'||source.length>heistRules.sourceLimit)return {ok:false,code:'limit',inputs,logs:[]};
 try{
  const result=run(source+suffix);if(result.waiting)return {ok:false,code:'waiting',inputs,logs:result.logs};
  if(result.logs.length!==1||!/[1-6]/.test(result.logs[0])||result.logs[0].length!==1)return {ok:false,code:'signals',inputs,logs:result.logs};
  return {ok:true,code:null,inputs,command:Number(result.logs[0]),logs:result.logs,call:suffix.trim(),calls:result.calls};
 }catch(error){return {ok:false,code:error.code||'syntax',position:Math.min(source.length,error.position??0),host:(error.position??0)>source.length,inputs,logs:[]};}
}
export function pauseHeist(s){if(s.status==='running')s.status='paused';}
function posture(s){
 const hidden=s.command===3&&heistInCover(s);if(hidden&&!s.hidden)event(s,'hidden');s.hidden=hidden;
 const visible=heistVisible(s);if(visible&&!s.visible)event(s,'visible');s.visible=visible;
}
export function deployHeist(s,source){
 if(s.status==='finished')return {ok:false,code:'finished'};
 const report=inspectHeist(s,source);s.lastReport=report;
 if(!report.ok){pauseHeist(s);s.remainderMs=0;event(s,'policy-error');return report;}
 s.strategy=source;s.draft=source;s.command=report.command;s.nextDecisionMs=s.activeMs+heistRules.decisionMs;s.decisions++;posture(s);return report;
}
export function startHeist(s,source=s.draft){
 if(s.status==='finished')return {ok:false,code:'finished'};
 if(s.decisions>0&&source===s.strategy){s.status='running';return {ok:true,command:s.command,resumed:true};}
 const report=deployHeist(s,source);if(report.ok)s.status='running';return report;
}
export function editHeist(s,source){if(typeof source!=='string'||source.length>heistRules.sourceLimit)throw fail('limit');pauseHeist(s);s.draft=source;s.lastReport=null;}
function finish(s,outcome){if(s.status==='finished')return;s.outcome=outcome;s.status='finished';s.remainderMs=0;event(s,outcome);}
function step(s){
 const w=heistWorld(s.seed),dt=heistRules.stepMs;
 if(s.activeMs>=s.nextDecisionMs&&!deployHeist(s,s.strategy).ok)return;
 s.activeMs+=dt;const oldBlocked=s.blocked;s.blocked=false;
 const speed=s.command===1||s.command===5?4000:s.command===2?1800:s.command===6?s.energy>=160?6500:4000:0;
 let x=Math.max(0,Math.min(w.exit,s.x+speed*(s.command===5?-1:1)*dt/1000));
 if(!s.door&&s.x<w.door&&x>w.door-1200){x=w.door-1200;s.blocked=true;if(!oldBlocked)event(s,'blocked');}
 s.x=x;
 const drain=s.command===6?160:s.command===1||s.command===5?30:s.command===2?10:-120;s.energy=Math.max(0,Math.min(100000,s.energy-drain));
 const phase=heistPhase(s);
 if(s.command===4&&phase<3&&Math.abs(heistTarget(s)-s.x)<=heistRules.useRange){
  s.useMs+=dt;if(s.useMs>=durations[phase]){s[['key','door','bag'][phase]]=true;s.useMs=0;event(s,['key','door','bag'][phase]);}
 }else s.useMs=0;
 const chase=s.alarm>=60000&&s.visible;
 let direction=chase?(Math.sign(s.x-s.guardX)||s.facing):s.guardX<=w.patrolMin?1:s.guardX>=w.patrolMax?-1:s.facing;
 let guard=s.guardX+direction*(chase?3400:w.guardSpeed)*dt/1000;
 if(!chase&&s.guardX>=w.patrolMin&&s.guardX<=w.patrolMax){if(guard>w.patrolMax){guard=w.patrolMax-(guard-w.patrolMax);direction=-1;}if(guard<w.patrolMin){guard=w.patrolMin+(w.patrolMin-guard);direction=1;}}
 if(!s.door&&guard<w.door+1200)guard=w.door+1200;
 s.guardX=Math.max(0,Math.min(w.exit,guard));s.facing=direction;posture(s);
 const change=s.visible?(s.command===2?100:240):s.hidden?-120:-20;s.alarm=Math.max(0,Math.min(100000,s.alarm+change+(s.command===6?80:0)));s.peakAlarm=Math.max(s.peakAlarm,s.alarm);
 if(!s.hidden&&Math.abs(s.x-s.guardX)<=heistRules.body){finish(s,'caught');return;}
 if(s.alarm>=100000){finish(s,'lockdown');return;}
 if(s.bag&&s.x>=w.exit-heistRules.exitRange){finish(s,'escaped');return;}
 if(s.mode==='timed'&&s.activeMs>=w.timeLimitMs)finish(s,'timeout');
}
export function advanceHeist(s,elapsedMs){
 if(s.status!=='running')return 0;
 if(!Number.isFinite(elapsedMs)||elapsedMs<0)throw fail('time');
 if(elapsedMs>250){pauseHeist(s);return 0;}
 s.remainderMs+=elapsedMs;let advanced=0;
 while(s.status==='running'&&s.remainderMs+1e-7>=heistRules.stepMs){s.remainderMs=Math.max(0,s.remainderMs-heistRules.stepMs);const before=s.activeMs;step(s);advanced+=s.activeMs-before;}
 if(s.remainderMs<1e-7)s.remainderMs=0;
 return advanced;
}
export function saveHeist(s,history=[]){
 const rows=history.map(row=>({...row}));if(s.status==='finished'&&!rows.some(row=>row.id===s.id))rows.push(Object.fromEntries(['id','seed','mode','outcome','activeMs','peakAlarm','decisions'].map(key=>[key,s[key]])));
 return normalizeHeist({version:1,current:Object.fromEntries(heistStateKeys.map(key=>[key,s[key]])),history:rows.slice(-heistRules.historyLimit)});
}
export function restoreHeist(value){const saved=normalizeHeist(value);if(saved.current.status==='running')saved.current.status='paused';saved.current.lastReport=null;return saved;}
