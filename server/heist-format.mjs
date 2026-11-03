export const heistRules=Object.freeze({stepMs:20,decisionMs:800,sourceLimit:3000,body:1400,useRange:4000,exitRange:3000,viewRange:28000,historyLimit:32,operationMs:Object.freeze([400,1600,3000])});
export function heistWorld(seed){
 let n=seed>>>0;const roll=()=>n=(Math.imul(n,1664525)+1013904223)>>>0;
 const key=40000+roll()%5*1000,door=68000+roll()%5*1000,safe=132000+roll()%8*1000,exit=232000+roll()%10*1000,min=92000+roll()%9*1000,max=176000+roll()%9*1000;
 return {key,door,safe,exit,patrolMin:min,patrolMax:max,guardStart:min+roll()%(max-min),guardFacing:roll()%2?1:-1,guardSpeed:2400+roll()%5*100,timeLimitMs:180000+roll()%121*1000,covers:[[key-6000,key+6000],[door+27000,door+41000],[safe-6000,safe+7000],[190000,203000]]};
}
export const heistPhase=s=>!s.key?0:!s.door?1:!s.bag?2:3;
export const heistTarget=s=>{const w=heistWorld(s.seed);return [w.key,w.door,w.safe,w.exit][heistPhase(s)];};
export const heistInCover=s=>heistWorld(s.seed).covers.some(([left,right])=>s.x>=left&&s.x<=right);
export function heistVisible(s){
 if(s.hidden)return false;const w=heistWorld(s.seed),distance=s.x-s.guardX;
 if(!s.door&&(s.x<w.door)!==(s.guardX<w.door))return false;
 return Math.abs(distance)<=heistRules.viewRange&&(distance===0||Math.sign(distance)===s.facing);
}
export const heistStateKeys=Object.freeze(['version','seed','id','mode','status','activeMs','remainderMs','x','guardX','facing','energy','alarm','peakAlarm','key','door','bag','useMs','command','nextDecisionMs','decisions','hidden','visible','blocked','strategy','draft','outcome','eventSerial','events']);
const outcomes=['escaped','caught','lockdown','timeout'],kinds=['key','door','bag','hidden','visible','blocked','caught','escaped','lockdown','timeout','policy-error'];
export function normalizeHeist(value){
 const fail=()=>{throw Error('HEIST_INVALID');},own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
 const record=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!own(v,k)))fail();};
 const integer=(v,min,max)=>{if(!Number.isSafeInteger(v)||v<min||v>max)fail();return v;};
 const text=(v,max)=>{if(typeof v!=='string'||v.length>max)fail();return v;};
 const one=(v,list)=>{if(!list.includes(v))fail();return v;};
 record(value,['version','current','history']);if(value.version!==1)fail();record(value.current,heistStateKeys);const s=value.current;
 if(s.version!==1)fail();integer(s.seed,0,0xffffffff);if(!text(s.id,64))fail();one(s.mode,['practice','timed']);one(s.status,['ready','running','paused','finished']);
 for(const key of ['activeMs','nextDecisionMs','decisions','eventSerial'])integer(s[key],0,Number.MAX_SAFE_INTEGER);
 if(s.activeMs%heistRules.stepMs||s.nextDecisionMs%heistRules.stepMs||s.nextDecisionMs>s.activeMs+heistRules.decisionMs||s.decisions>0&&s.nextDecisionMs<s.activeMs)fail();
 if(!Number.isFinite(s.remainderMs)||s.remainderMs<0||s.remainderMs>=20)fail();
 const w=heistWorld(s.seed);integer(s.x,0,w.exit);integer(s.guardX,0,w.exit);one(s.facing,[-1,1]);one(s.command,[1,2,3,4,5,6]);
 for(const key of ['energy','alarm','peakAlarm'])integer(s[key],0,100000);if(s.peakAlarm<s.alarm)fail();
 for(const key of ['key','door','bag','hidden','visible','blocked'])if(typeof s[key]!=='boolean')fail();
 if(s.door&&!s.key||s.bag&&!s.door||!s.door&&(s.x>w.door-1200||s.guardX<w.door+1200)||s.hidden!==(s.command===3&&heistInCover(s))||s.visible!==heistVisible(s))fail();
 // Reject impossible travel or completed operations, without treating a local
 // snapshot as proof of a fair result or of language proficiency.
 if(Math.abs(s.x-6000)>s.activeMs*6.5||Math.abs(s.guardX-w.guardStart)>s.activeMs*3.4)fail();
 let use=0;for(const [i,done]of [s.key,s.door,s.bag].entries()){use+=heistRules.operationMs[i];if(done&&s.activeMs<use+Math.max(0,[w.key,w.door,w.safe][i]-6000-heistRules.useRange)/6.5)fail();}
 integer(s.useMs,0,(heistRules.operationMs[heistPhase(s)]??1)-1);if(s.useMs%20)fail();text(s.strategy,heistRules.sourceLimit);text(s.draft,heistRules.sourceLimit);
 if(s.status==='ready'&&(s.activeMs!==0||s.x!==6000||s.key||s.door||s.bag))fail();
 if(s.status==='finished'){
  one(s.outcome,outcomes);
  if(s.outcome==='escaped'&&(!s.bag||s.x<w.exit-heistRules.exitRange)||s.outcome==='caught'&&(s.hidden||Math.abs(s.x-s.guardX)>heistRules.body)||s.outcome==='lockdown'&&s.alarm!==100000||s.outcome==='timeout'&&(s.mode!=='timed'||s.activeMs<w.timeLimitMs))fail();
 }else if(s.outcome!==null)fail();
 if(!Array.isArray(s.events)||s.events.length>64)fail();let last=0,lastTime=0;
 const events=s.events.map(event=>{record(event,['id','at','kind','x','guardX']);integer(event.id,1,s.eventSerial);if(event.id<=last)fail();last=event.id;integer(event.at,lastTime,s.activeMs);if(event.at%20)fail();lastTime=event.at;one(event.kind,kinds);integer(event.x,0,w.exit);integer(event.guardX,0,w.exit);return {...event};});
 if(!Array.isArray(value.history)||value.history.length>heistRules.historyLimit)fail();const seen=new Set();
 const history=value.history.map(item=>{record(item,['id','seed','mode','outcome','activeMs','peakAlarm','decisions']);if(!text(item.id,64)||seen.has(item.id))fail();seen.add(item.id);integer(item.seed,0,0xffffffff);one(item.mode,['practice','timed']);one(item.outcome,outcomes);integer(item.activeMs,0,Number.MAX_SAFE_INTEGER);integer(item.peakAlarm,0,100000);integer(item.decisions,0,Number.MAX_SAFE_INTEGER);if(item.activeMs%20||item.outcome==='timeout'&&(item.mode!=='timed'||item.activeMs<heistWorld(item.seed).timeLimitMs)||item.outcome==='lockdown'&&item.peakAlarm!==100000||item.outcome==='escaped'&&item.activeMs<5000+(heistWorld(item.seed).exit-6000-heistRules.exitRange)/6.5)fail();if(item.id===s.id&&(s.status!=='finished'||['seed','mode','outcome','activeMs','peakAlarm','decisions'].some(k=>item[k]!==s[k])))fail();return {...item};});
 return {version:1,current:{...s,events},history};
}
