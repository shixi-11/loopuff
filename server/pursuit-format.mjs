// Shared pure rules and save validation; no account, browser or Node dependency.
export const pursuitRules=Object.freeze({version:1,sections:20,minSection:226,maxSpeed:7.5,minActiveMs:600000,exit:200,stepMs:10,sourceLimit:3000});
export const pursuitJunctionDistance=pursuitRules.sections*pursuitRules.minSection;
export function pursuitRoute(seed,section,path=0){
 if(!Number.isInteger(section)||section<0||section>=20||![0,1].includes(path))throw Error('route');
 let value=(seed>>>0)^Math.imul(section+1,2654435761);const roll=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value;};
 const terrain=roll()%4,length=path?pursuitRules.minSection:255+roll()%21;
 const obstacles=(path?[28,62,96,133,169,205]:[38,86,134,182,226]).map(n=>n+roll()%11-5).filter(n=>n<length-8);
 return {section,path,terrain,length,obstacles,pickups:path?[112]:[110,210]};
}
const reject=()=>{throw Object.assign(Error('SAVE_INVALID'),{code:'SAVE_INVALID'});};
const record=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))reject();};
const number=(n,min,max,integer=false)=>{if(!Number.isFinite(n)||n<min||n>max||integer&&!Number.isSafeInteger(n))reject();};
const one=(v,choices)=>{if(!choices.includes(v))reject();};
const str=(v,max)=>{if(typeof v!=='string'||v.length>max)reject();};
const bool=v=>{if(typeof v!=='boolean')reject();};
const actorKeys=['road','section','distance','path','direction','energy','delayMs','jumpMs','cooldownMs','recoverJump','pendingJump','obstacle','collected','travelled','collisions','clears'];
export const pursuitStateKeys=['version','seed','id','role','difficulty','status','activeMs','remainderMs','nextRoute','actors','strategy','draft','queue','mode','nextDecisionMs','events','eventSerial','outcome'];
const eventKinds=['route-tired','blocked','jumped','recovered','section','intercept','joined','caught','escaped'];
export function pursuitJumpHeight(a){return a.jumpMs>0?Math.sin(Math.PI*(1-a.jumpMs/900))*2:0;}
const nodeId=(road,node)=>node===20?'join':`${road}:${node}`;
export function pursuitContact(state){
 const p=state.actors.police,t=state.actors.thief;
 if(Math.abs(pursuitJumpHeight(p)-pursuitJumpHeight(t))>=.8)return false;
 if(p.road===t.road&&p.section===t.section&&p.path===t.path&&Math.abs(p.distance-t.distance)<1.1)return true;
 const ends=a=>a.road==='exit'?[{node:'join',distance:a.distance},{node:'exit',distance:200-a.distance}]:[{node:nodeId(a.road,a.section),distance:a.distance},{node:nodeId(a.road,a.section+1),distance:pursuitRoute(state.seed,a.section,a.path).length-a.distance}];
 return ends(p).some(a=>ends(t).some(b=>a.node===b.node&&a.distance+b.distance<1.1));
}
function checkActor(a,role,s){
 record(a,actorKeys);one(a.road,role==='thief'?['thief','exit']:['police','thief','exit']);number(a.section,0,20,true);one(a.path,[0,1]);one(a.direction,[-1,1]);
 if(role==='thief'&&a.direction!==1||a.road==='police'&&a.direction!==1)reject();
 const route=a.road==='exit'?{length:200,obstacles:[40,90,140]}:pursuitRoute(s.seed,a.section,a.path);
 if(a.road==='exit'&&(a.section!==20||a.path!==0||a.direction!==1)||a.road!=='exit'&&a.section===20)reject();
 number(a.distance,0,route.length);number(a.energy,0,100);number(a.travelled,0,s.activeMs/1000*pursuitRules.maxSpeed+.001);
 const unit=pursuitRules.minSection,join=pursuitJunctionDistance;
 const minimum=a.road==='exit'?join+a.distance:role==='police'&&a.road==='thief'?join+Math.min((19-a.section)*unit+route.length-a.distance,(20-a.section)*unit+a.distance):a.section*unit+a.distance;
 if(a.travelled+.001<minimum)reject();
 if((a.road==='exit'||role==='police'&&a.road==='thief')&&(s.activeMs<pursuitRules.minActiveMs||a.travelled<pursuitJunctionDistance-.001))reject();
 for(const [key,max]of [['delayMs',1500],['jumpMs',900],['cooldownMs',1250]]){number(a[key],0,max,true);if(a[key]%10)reject();}
 bool(a.recoverJump);bool(a.pendingJump);if(a.recoverJump&&!a.delayMs)reject();number(a.obstacle,-1,route.obstacles.length,true);
 if(a.direction===1){if(a.obstacle<0||route.obstacles[a.obstacle]!==undefined&&route.obstacles[a.obstacle]<a.distance-.00001||a.obstacle>0&&route.obstacles[a.obstacle-1]>a.distance+.00001)reject();}
 else if(a.obstacle===route.obstacles.length||a.obstacle>=0&&route.obstacles[a.obstacle]>a.distance+.00001||route.obstacles[a.obstacle+1]!==undefined&&route.obstacles[a.obstacle+1]<a.distance-.00001)reject();
 for(const key of ['collisions','clears'])number(a[key],0,100000,true);
 if(!Array.isArray(a.collected)||a.collected.length>160||new Set(a.collected).size!==a.collected.length)reject();
 for(const id of a.collected){str(id,40);if(!/^(police|thief|exit):(\d|1\d|20):[01]:[01]$/.test(id))reject();const [road,section,path,index]=id.split(':');if(role==='thief'&&road==='police'||road==='exit'&&(section!=='20'||path!=='0'||index!=='0')||road!=='exit'&&(section==='20'||path==='1'&&index==='1'))reject();}
}
function checkState(s){
 record(s,pursuitStateKeys);one(s.version,[1]);number(s.seed,0,0xffffffff,true);str(s.id,64);if(!/^[a-z0-9-]{1,64}$/i.test(s.id))reject();one(s.role,['police','thief']);one(s.difficulty,['calm','standard','expert']);one(s.status,['ready','running','paused','finished']);
 number(s.activeMs,0,86400000,true);if(s.activeMs%10)reject();number(s.remainderMs,0,10);if(s.remainderMs===10)reject();one(s.nextRoute,[0,1]);
 record(s.actors,['police','thief']);for(const role of ['police','thief'])checkActor(s.actors[role],role,s);
 for(const key of ['strategy','draft'])str(s[key],3000);
 if(!Array.isArray(s.queue)||s.queue.length>8)reject();for(const action of s.queue)one(action,[1,2,3]);one(s.mode,[1,2,3]);number(s.nextDecisionMs,0,s.activeMs+250,true);if(s.nextDecisionMs%10)reject();
 one(s.outcome,[null,'caught','escaped']);if((s.status==='finished')!==(s.outcome!==null)||s.outcome&&s.activeMs<600000||s.status==='ready'&&s.activeMs!==0)reject();
 if(s.outcome==='escaped'&&(s.actors.thief.road!=='exit'||s.actors.thief.distance!==200))reject();
 if(s.outcome==='caught'&&!pursuitContact(s)||s.outcome==='escaped'&&pursuitContact(s))reject();
 number(s.eventSerial,0,1000000,true);if(!Array.isArray(s.events)||s.events.length>32)reject();
 let previous=0;for(const e of s.events){record(e,['id','at','kind','role','section']);number(e.id,previous+1,s.eventSerial,true);previous=e.id;number(e.at,0,s.activeMs,true);one(e.kind,eventKinds);one(e.role,['police','thief']);number(e.section,0,20,true);}
}
export function normalizePursuit(value){
 record(value,['version','current','history']);one(value.version,[1]);checkState(value.current);
 if(!Array.isArray(value.history)||value.history.length>20)reject();const seen=new Set();
 for(const h of value.history){record(h,['id','seed','role','difficulty','activeMs','outcome','collisions','clears']);str(h.id,64);if(!/^[a-z0-9-]{1,64}$/i.test(h.id)||seen.has(h.id))reject();seen.add(h.id);number(h.seed,0,0xffffffff,true);one(h.role,['police','thief']);one(h.difficulty,['calm','standard','expert']);number(h.activeMs,600000,86400000,true);one(h.outcome,['caught','escaped']);number(h.collisions,0,100000,true);number(h.clears,0,100000,true);}
 return structuredClone(value);
}
