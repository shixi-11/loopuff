import test from 'node:test';
import assert from 'node:assert/strict';
import {newPursuit,startPursuit,pausePursuit,advancePursuit,deployPursuit,savePursuit,restorePursuit} from '../src/pursuit.js';
import {createPursuitClock} from '../src/pursuit-clock.js';
import {createPursuitSession,pursuitKey} from '../src/pursuit-session.js';
import {emptySave,parseSave,normalizeSave,saveKeys} from '../server/save-format.mjs';
import {createMergePlan,resolveMerge} from '../src/save-merge.js';
import {createSaveAccess,readBaseline,journalKey,ownerKey,baselineMatches} from '../src/save-data.js';
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};};
const locks=()=>{let tail=Promise.resolve();return {request(_name,_opts,operation){const result=tail.then(operation);tail=result.catch(()=>{});return result;}};};
const simulate=(s,ms,frame=100)=>{for(let n=0;n<ms&&s.status==='running';n+=frame)advancePursuit(s,Math.min(frame,ms-n));};
const policy='if obstacle < 4 then { 3.log() } else { if energy > 35 then { 2.log() } else { 1.log() } }';
test('fixed legacy v1 files migrate to five-domain v2 without changing four old domains',()=>{
 const raw='{"format":"loopuff-save","version":1,"data":{"course":{"lang":"zh","state":{"lesson":0,"phase":"independent","draft":"","assessedSource":null,"completed":["signal"]}},"vault":null,"chase":null,"dispatch":null}}';
 const legacy=JSON.parse(raw),parsed=parseSave(raw);assert.equal(parsed.version,2);assert.equal(parsed.data.pursuit,null);
 for(const key of Object.keys(legacy.data))assert.deepEqual(parsed.data[key],legacy.data[key]);
 assert.throws(()=>normalizeSave({...legacy,data:{...legacy.data,pursuit:null}}));
 const missing=emptySave();delete missing.data.pursuit;assert.throws(()=>normalizeSave(missing));assert.throws(()=>normalizeSave({...emptySave(),version:3}));
});
test('a running pursuit restores paused, retains its fractional time and queue, and resumes identically',()=>{
 const s=newPursuit(8);deployPursuit(s,policy);startPursuit(s);simulate(s,60123,1000/60);
 const saved=savePursuit(s),restored=restorePursuit(JSON.parse(JSON.stringify(saved)));
 assert.equal(restored.current.status,'paused');assert.equal(restored.current.activeMs,s.activeMs);assert.equal(restored.current.remainderMs,s.remainderMs);assert.deepEqual(restored.current.queue,s.queue);
 advancePursuit(restored.current,250);assert.equal(restored.current.activeMs,s.activeMs);startPursuit(restored.current);simulate(s,60000);simulate(restored.current,60000);
 assert.deepEqual(savePursuit(restored.current),savePursuit(s));
 const envelope=emptySave();envelope.data.pursuit=savePursuit(s);assert.deepEqual(parseSave(JSON.stringify(envelope)),envelope);
 const corrupt=savePursuit(newPursuit(7));corrupt.current.status='paused';corrupt.current.actors.thief.section=19;assert.throws(()=>restorePursuit(corrupt));
});
test('pursuit merge chooses a whole world, never splicing clocks, roads or queues',()=>{
 const a=emptySave(),b=emptySave();a.data.pursuit=savePursuit(newPursuit(7));b.data.pursuit=savePursuit(newPursuit(8,'thief'));
 const plan=createMergePlan(a,b);assert.equal(plan.conflicts.length,1);assert.equal(plan.conflicts[0].domain,'pursuit');
 for(const side of ['local','incoming'])assert.deepEqual(resolveMerge(plan,{[plan.conflicts[0].id]:side}).data.pursuit,side==='local'?a.data.pursuit:b.data.pursuit);
 const old={format:'loopuff-save',version:1,data:{course:null,vault:null,chase:null,dispatch:null}};assert.deepEqual(resolveMerge(createMergePlan(a,old)).data.pursuit,a.data.pursuit);
});
test('old journals leave pursuit alone while six-entry recovery rolls back pursuit and ownership',async()=>{
 const store=memory(),original=JSON.stringify(savePursuit(newPursuit(7)));store.setItem(saveKeys.pursuit,original);store.setItem(saveKeys.course,'after');
 store.setItem(journalKey,JSON.stringify({version:1,attempted:1,entries:[{key:saveKeys.course,before:null,after:'after'}]}));
 assert.equal((await createSaveAccess(store,{locks:locks()}).recover()).status,'recovered');assert.equal(store.getItem(saveKeys.pursuit),original);
 const entries=[...Object.values(saveKeys),ownerKey].map((key,i)=>({key,before:i===4?original:null,after:`new-${i}`}));for(const e of entries)store.setItem(e.key,e.after);
 store.setItem(journalKey,JSON.stringify({version:1,attempted:6,entries}));assert.equal((await createSaveAccess(store,{locks:locks()}).recover()).status,'recovered');
 assert.equal(store.getItem(saveKeys.pursuit),original);assert.equal(store.getItem(ownerKey),null);
 const baseline=readBaseline(store);store.setItem(saveKeys.pursuit,JSON.stringify(savePursuit(newPursuit(9))));assert.equal(baselineMatches(store,baseline),false);
});
test('foreground frame clock excludes pause, background, lost focus and long-frame gaps',()=>{
 const s=newPursuit(1);startPursuit(s);const reasons=[];
 const clock=createPursuitClock({state:s,advance:ms=>advancePursuit(s,ms),pause:reason=>{reasons.push(reason);pausePursuit(s);}});
 clock.frame(1000);clock.frame(1016);assert.equal(s.activeMs,10);
 clock.frame(60000,{visible:false});assert.equal(s.activeMs,10);assert.equal(s.status,'paused');assert.deepEqual(reasons,['background']);
 startPursuit(s);clock.frame(90000);clock.frame(90020);assert.equal(s.activeMs,30);clock.frame(91000);assert.equal(s.activeMs,30);assert.equal(s.status,'paused');assert.equal(reasons.at(-1),'slow');
 startPursuit(s);clock.frame(100000,{focused:false});assert.equal(s.activeMs,30);assert.equal(s.status,'paused');
});
test('one session flushes the latest shared world across view remounts and cannot revive an old draft',async()=>{
 const storage=memory(),jobs=[],access={write(operation){return new Promise((resolve,reject)=>jobs.push(()=>{try{operation();resolve();}catch(e){reject(e);}}));}};
 const session=createPursuitSession({storage,access,createWorld:()=>newPursuit(9)});startPursuit(session.world);simulate(session.world,1000);const first=session.persist();
 simulate(session.world,4000);pausePursuit(session.world);session.persist();
 // A remounted view receives this same session, not the old storage snapshot.
 const remounted=session;assert.equal(remounted.world.activeMs,5000);remounted.world.draft='2.log()';remounted.persist();
 assert.equal(jobs.length,1);jobs.shift()();await new Promise(resolve=>setImmediate(resolve));assert.equal(jobs.length,1);jobs.shift()();await first;
 const restored=loadSaved(storage);assert.equal(restored.current.activeMs,5000);assert.equal(restored.current.draft,'2.log()');
 function loadSaved(store){return restorePursuit(JSON.parse(store.getItem(pursuitKey)));}
});
test('save failure pauses the current session and a terminal match is recorded only once',async()=>{
 const s=createPursuitSession({storage:memory(),access:{write:async()=>{throw Error('full');}},createWorld:()=>newPursuit(8)});startPursuit(s.world);simulate(s.world,100);await s.persist();assert.equal(s.world.status,'paused');assert.equal(s.saveFailed,true);
 const store=memory(),session=createPursuitSession({storage:store,access:{write:async op=>op()},createWorld:()=>newPursuit(8,'thief','calm')});deployPursuit(session.world,policy);startPursuit(session.world);simulate(session.world,1800000);
 assert.equal(session.world.status,'finished');assert.equal(session.finish(),true);assert.equal(session.finish(),false);await session.persist();assert.equal(restorePursuit(JSON.parse(store.getItem(pursuitKey))).history.length,1);
});
