import {run} from './runner.js';
import {pursuitRules,pursuitRoute,pursuitStateKeys,normalizePursuit,pursuitJumpHeight,pursuitContact,pursuitJunctionDistance} from '../server/pursuit-format.mjs';
export {pursuitRules,pursuitRoute,pursuitJumpHeight,pursuitContact};

// Original game rules, separate from Tolang syntax and the short chase labs.
// Two twenty-section roads meet at one junction. The police can then physically
// backtrack along the escape road. Even contact near the junction takes >600 s.
const roles=['police','thief'],difficulties=['calm','standard','expert'];
const other=role=>role==='police'?'thief':'police';
const fail=code=>Object.assign(Error(code),{code});
const actor=role=>({road:role,section:0,distance:0,path:0,direction:1,energy:100,delayMs:0,jumpMs:0,cooldownMs:0,recoverJump:false,pendingJump:false,obstacle:0,collected:[],travelled:0,collisions:0,clears:0});
export function newPursuit(seed,role='police',difficulty='standard',id=String(seed>>>0)){
 if(!roles.includes(role)||!difficulties.includes(difficulty))throw fail('settings');
 return {version:1,seed:seed>>>0,id,role,difficulty,status:'ready',activeMs:0,remainderMs:0,nextRoute:0,
  actors:{police:actor('police'),thief:actor('thief')},strategy:'1.log()',draft:'1.log()',queue:[],mode:1,nextDecisionMs:0,
  events:[],eventSerial:0,outcome:null,lastReport:null};
}
export function savePursuit(state,history=[]){return normalizePursuit({version:1,current:Object.fromEntries(pursuitStateKeys.map(key=>[key,state[key]])),history});}
export function restorePursuit(value){const saved=normalizePursuit(value);if(saved.current.status==='running')saved.current.status='paused';saved.current.lastReport=null;return saved;}
function event(state,kind,role){
 state.events.push({id:++state.eventSerial,at:state.activeMs,kind,role,section:state.actors[role].section});
 if(state.events.length>32)state.events.shift();
}
export function pursuitSegment(state,role){const a=state.actors[role];return a.road==='exit'?{section:20,path:0,terrain:0,length:200,obstacles:[40,90,140],pickups:[110]}:pursuitRoute(state.seed,a.section,a.path);}
function enterRoute(state,role,road,section,direction,peer){
 const a=state.actors[role];a.road=road;a.section=section;a.direction=direction;
 if(road==='exit'){a.path=0;a.distance=0;a.obstacle=0;return;}
 let requested=role===state.role?state.nextRoute:a.energy>65&&section%3!==0?1:0;
 if(role!==state.role&&role==='police'&&road==='thief'&&state.difficulty!=='calm'&&peer.road==='thief'&&peer.section===section)requested=peer.path;
 a.path=requested&&a.energy>=14?1:0;if(a.path)a.energy-=14;
 if(requested&&!a.path)event(state,'route-tired',role);
 const route=pursuitSegment(state,role);a.distance=direction===1?0:route.length;a.obstacle=direction===1?0:route.obstacles.length-1;
}
export function setPursuitRoute(state,path){
 if(![0,1].includes(path))throw fail('route');state.nextRoute=path;
}
export function startPursuit(state){
 if(state.status==='finished')return false;
 if(state.status==='ready'){for(const role of roles)enterRoute(state,role,role,0,1,state.actors[other(role)]);}
 state.status='running';return true;
}
export function pausePursuit(state){if(state.status==='running'){state.status='paused';state.remainderMs=0;}}
// Route-relative progress is for observation; parallel roads are not a contact.
const progress=(state,a)=>a.road==='exit'?pursuitJunctionDistance+a.distance:(a.section+a.distance/pursuitRoute(state.seed,a.section,a.path).length)*pursuitRules.minSection;
export function pursuitPosition(state,role){return progress(state,state.actors[role]);}
export function pursuitObstacle(state,role){const a=state.actors[role],n=pursuitSegment(state,role).obstacles[a.obstacle];return n===undefined?999:Math.max(0,(n-a.distance)*a.direction);}
export function pursuitInputs(state){
 const a=state.actors[state.role],rival=state.actors[other(state.role)];
 return {energy:Math.floor(a.energy),obstacle:Math.floor(pursuitObstacle(state,state.role)),
  gap:Math.round(pursuitPosition(state,other(state.role))-pursuitPosition(state,state.role)),round:Math.min(21,a.section+1),
  rivalEnergy:Math.floor(rival.energy)};
}
export function inspectPursuit(state,source){
 return inspectPursuitInputs(pursuitInputs(state),source);
}
// Both live play and the optional scratch exercise execute the same input
// protocol. Practice inputs are labelled samples, never changes to the world.
export function inspectPursuitInputs(values,source){
 if(typeof source!=='string'||source.length>pursuitRules.sourceLimit)return {ok:false,code:'limit',logs:[],outputs:[]};
 const names=['energy','obstacle','gap','round','rivalEnergy'];
 if(!values||!names.every(name=>Number.isSafeInteger(values[name])))return {ok:false,code:'inputs',logs:[],outputs:[]};
 const inputs=Object.fromEntries(names.map(name=>[name,values[name]])),prefix=Object.entries(inputs).map(([name,value])=>`let ${name} = ${value};`).join('\n')+'\n';
 try{
  const result=run(prefix+source),logs=result.logs;
  if(result.waiting)return {ok:false,code:'waiting',inputs,logs,outputs:[]};
  if(!logs.length||logs.length>8||logs.some(value=>!(/^[1-3]$/).test(value)))return {ok:false,code:'signals',logs,outputs:[]};
  return {ok:true,code:null,inputs,logs,outputs:result.outputs.map(output=>({...output,start:Math.max(0,output.start-prefix.length),end:Math.max(0,output.end-prefix.length)}))};
 }catch(error){return {ok:false,code:error.code||'syntax',position:Math.max(0,(error.position??0)-prefix.length),inputs,logs:[],outputs:[]};}
}
export function deployPursuit(state,source){
 const report=inspectPursuit(state,source);state.lastReport=report;
 if(!report.ok){pausePursuit(state);return report;}
 state.strategy=source;state.draft=source;state.queue=report.logs.map(Number);state.nextDecisionMs=state.activeMs;return report;
}
function updateActor(state,role,mode,peer){
 const a=state.actors[role],dt=.01;
 a.cooldownMs=Math.max(0,a.cooldownMs-10);a.jumpMs=Math.max(0,a.jumpMs-10);
 if(a.delayMs>0){a.delayMs=Math.max(0,a.delayMs-10);if(a.delayMs===0&&a.recoverJump){a.recoverJump=false;a.jumpMs=900;}return;}
 if(a.pendingJump){a.pendingJump=false;if(!a.jumpMs&&!a.cooldownMs&&a.energy>=8){a.jumpMs=900;a.cooldownMs=1250;a.energy-=8;}}
 let speed;
 if(mode===2){speed=a.energy>=1?pursuitRules.maxSpeed:3.2;a.energy=Math.max(0,a.energy-9*dt);}
 else {speed=5.4;a.energy=Math.min(100,a.energy+3.5*dt);}
 if(role!==state.role){const factor={calm:.88,standard:.98,expert:1.04}[state.difficulty];speed=Math.min(pursuitRules.maxSpeed,speed*factor);}
 const route=pursuitSegment(state,role);
 speed*=route.terrain===1?.88:route.terrain===2?.94:1;
 let budget=speed*dt;
 while(budget>1e-9){
  const edge=pursuitSegment(state,role),from=a.distance,end=a.direction===1?edge.length:0;
  const movement=Math.min(budget,Math.abs(end-from)),next=from+a.direction*movement,barrier=edge.obstacles[a.obstacle];
  if(barrier!==undefined&&(next-barrier)*a.direction>=0){
   a.obstacle+=a.direction;
   if(pursuitJumpHeight(a)<.55){
    a.travelled+=Math.abs(barrier-from);a.distance=barrier;a.energy=Math.max(0,a.energy-12);a.delayMs=edge.terrain===1?1500:1100;a.recoverJump=true;a.collisions++;event(state,'blocked',role);return;
   }
   a.clears++;event(state,'jumped',role);
  }
  for(const [index,point]of edge.pickups.entries()){
   const id=`${a.road}:${a.section}:${a.path}:${index}`;
   if(point>=Math.min(from,next)&&point<=Math.max(from,next)&&!a.collected.includes(id)){a.collected.push(id);a.energy=Math.min(100,a.energy+16);event(state,'recovered',role);}
  }
  a.distance=next;a.travelled+=movement;budget-=movement;
  if(Math.abs(next-end)>1e-8)break;
  if(a.road==='exit')break;
  const node=a.direction===1?a.section+1:a.section;
  if(a.road==='police'&&node<20)enterRoute(state,role,'police',node,1,peer);
  else if(a.road==='thief'&&role==='thief'&&node<20)enterRoute(state,role,'thief',node,1,peer);
  else if(node===20){
   if(role==='thief'||peer.road==='exit')enterRoute(state,role,'exit',20,1,peer);
   else enterRoute(state,role,'thief',19,-1,peer);
   event(state,role==='police'&&a.road==='thief'?'intercept':'joined',role);
  }else{
   const direction=node===0||peer.road==='exit'||progress(state,peer)>=node*pursuitRules.minSection?1:-1;
   enterRoute(state,role,'thief',direction===1?node:node-1,direction,peer);
  }
  event(state,'section',role);
 }
}
function rivalDecision(state){
 const role=other(state.role),a=state.actors[role];
 if(pursuitObstacle(state,role)<3.8&&!a.jumpMs&&!a.cooldownMs&&a.energy>=8)a.pendingJump=true;
 else if(role==='police'&&a.road==='exit'&&state.actors.thief.road==='exit'&&state.actors.thief.jumpMs>400&&Math.abs(a.distance-state.actors.thief.distance)<6&&!a.jumpMs&&!a.cooldownMs)a.pendingJump=true;
 return a.energy>45&&(a.section%3!==0||a.section>=20)?2:1;
}
function step(state,control){
 if(state.activeMs>=state.nextDecisionMs){
  if(!state.queue.length){
   const report=inspectPursuit(state,state.strategy);state.lastReport=report;
   if(!report.ok){pausePursuit(state);return;}
   state.queue=report.logs.map(Number);
  }
  state.mode=state.queue.shift();state.nextDecisionMs=state.activeMs+250;
  if(state.mode===3)state.actors[state.role].pendingJump=true;
 }
 state.activeMs+=10;
 const aiMode=rivalDecision(state);
 // Both decisions observe the same world step, regardless of the player's role.
 const peers=Object.fromEntries(roles.map(role=>[role,{...state.actors[role]}]));
 updateActor(state,state.role,control.sprint?2:state.mode,peers[other(state.role)]);
 updateActor(state,other(state.role),aiMode,peers[state.role]);
 const p=state.actors.police,t=state.actors.thief;
 if(state.activeMs<600000)return;
 if(pursuitContact(state))state.outcome='caught';
 else if(t.road==='exit'&&t.distance>=200)state.outcome='escaped';
 if(state.outcome){state.status='finished';event(state,state.outcome,state.role);state.remainderMs=0;}
}
export function advancePursuit(state,elapsedMs,control={}){
 if(!Number.isFinite(elapsedMs)||elapsedMs<0||elapsedMs>250)throw fail('elapsed');
 if(state.status!=='running')return state;
 if(control.jump)state.actors[state.role].pendingJump=true;
 state.remainderMs+=elapsedMs;
 while(state.remainderMs+1e-7>=10&&state.status==='running'){
  state.remainderMs=Math.max(0,state.remainderMs-10);step(state,{sprint:!!control.sprint});
 }
 if(state.remainderMs<1e-7)state.remainderMs=0;
 return state;
}
