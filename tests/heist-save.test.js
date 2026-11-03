import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {newHeist,startHeist,advanceHeist,saveHeist,restoreHeist,heistWorld} from '../src/heist.js';
import {heistExample} from '../src/heist-strategies.js';
import {createHeistSession,heistKey} from '../src/heist-session.js';
import {emptySave,normalizeSave,saveKeys} from '../server/save-format.mjs';
import {createMergePlan,resolveMerge} from '../src/save-merge.js';
import {createSaveAccess,readBaseline,journalKey,ownerKey,captureSave} from '../src/save-data.js';
import {createProgressStore} from '../server/progress-store.mjs';
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};};
const locks={request:async(_name,_mode,operation)=>operation()};
const legacy=version=>({format:'loopuff-save',version,data:{course:{lang:'zh',state:{completed:['signal'],draft:'',assessedSource:null}},vault:null,chase:null,dispatch:null,...version===2?{pursuit:null}:{}}});
test('v1 and v2 normalize to six domains, preserve originals and reject unknown fields',()=>{
 for(const version of [1,2]){const old=legacy(version),next=normalizeSave(old);assert.equal(next.version,3);assert.equal(next.data.heist,null);for(const k of Object.keys(old.data))assert.deepEqual(next.data[k],old.data[k]);assert.throws(()=>normalizeSave({...old,data:{...old.data,heist:null}}));}
 const missing=emptySave();delete missing.data.heist;assert.throws(()=>normalizeSave(missing));assert.throws(()=>normalizeSave({...emptySave(),version:4}));
});
test('merges preserve heist when importing old backups and choose complete conflicting runs',()=>{
 const a=emptySave(),b=emptySave();a.data.heist=saveHeist(newHeist(1));b.data.heist=saveHeist(newHeist(2));
 for(const version of [1,2])assert.deepEqual(resolveMerge(createMergePlan(a,legacy(version))).data.heist,a.data.heist);
 const plan=createMergePlan(a,b);assert.equal(plan.conflicts.length,1);assert.equal(plan.conflicts[0].domain,'heist');
 for(const side of ['local','incoming'])assert.deepEqual(resolveMerge(plan,{[plan.conflicts[0].id]:side}).data.heist,side==='local'?a.data.heist:b.data.heist);
});
test('seven-key restoration recovers heist and owner, while old journals leave heist untouched',async()=>{
 const store=memory(),original=JSON.stringify(saveHeist(newHeist(2)));store.setItem(heistKey,original);store.setItem(saveKeys.course,'after');
 store.setItem(journalKey,JSON.stringify({version:1,attempted:1,entries:[{key:saveKeys.course,before:null,after:'after'}]}));assert.equal((await createSaveAccess(store,{locks}).recover()).status,'recovered');assert.equal(store.getItem(heistKey),original);
 const entries=[...Object.values(saveKeys),ownerKey].map(key=>({key,before:key===heistKey?original:null,after:'after-'+key}));for(const entry of entries)store.setItem(entry.key,entry.after);
 store.setItem(journalKey,JSON.stringify({version:1,attempted:7,entries}));assert.equal((await createSaveAccess(store,{locks}).recover()).status,'recovered');assert.equal(store.getItem(heistKey),original);assert.equal(store.getItem(ownerKey),null);
 const access=createSaveAccess(store,{locks}),baseline=readBaseline(store),snapshot=emptySave();snapshot.data.heist=saveHeist(newHeist(3));store.setItem(heistKey,JSON.stringify(saveHeist(newHeist(4))));await assert.rejects(access.apply(snapshot,baseline),e=>e.code==='SAVE_LOCAL_CHANGED');
});
test('a session saves the latest shared run, holds failures and gives repeated seeds separate IDs',async()=>{
 const store=memory(),jobs=[],access={write:op=>new Promise(resolve=>jobs.push(()=>{op();resolve();}))},session=createHeistSession({storage:store,access,createWorld:(seed=1,mode='practice')=>newHeist(seed,mode)});
 startHeist(session.world,heistExample);advanceHeist(session.world,200);const pending=session.persist();session.world.draft='changed';session.persist();jobs.shift()();await new Promise(resolve=>setImmediate(resolve));jobs.shift()();await pending;
 assert.equal(restoreHeist(JSON.parse(store.getItem(heistKey))).current.draft,'changed');assert.equal(captureSave(store).snapshot.version,3);
 const id=session.world.id;session.replace(1,'practice','');assert.notEqual(session.world.id,id);
 const failed=createHeistSession({storage:memory(),access:{write:async()=>{throw Error('quota');}},createWorld:()=>newHeist(1)});startHeist(failed.world,heistExample);await failed.persist();assert.equal(failed.world.status,'paused');assert.equal(failed.saveFailed,true);
 const bad=memory();bad.setItem(heistKey,'{bad');const damaged=createHeistSession({storage:bad,access:{write:async op=>op()}});assert.equal(damaged.badSave,true);await damaged.persist();assert.equal(bad.getItem(heistKey),'{bad');
});
test('a closed-door snapshot cannot move the guard through that door on restoration',()=>{
 const s=newHeist(0);startHeist(s,'sync fn decide(a,b,c,d,e,f,g){return 3}');for(let i=0;i<400;i++)advanceHeist(s,100);
 const saved=saveHeist(s);saved.current.guardX=heistWorld(0).door-1000;assert.equal(saved.current.visible,false);assert.throws(()=>restoreHeist(saved));
});
test('the actual account store rejects matching-revision old writers after heist is stored',()=>{
 const db=new DatabaseSync(':memory:');try{db.exec('CREATE TABLE user(id TEXT PRIMARY KEY); INSERT INTO user VALUES (\'test\')');const store=createProgressStore(db,{now:()=>1000}),snapshot=emptySave();snapshot.data.heist=saveHeist(newHeist(8));assert.equal(store.put('test',0,snapshot).revision,1);
  for(const version of [1,2]){assert.throws(()=>store.put('test',1,legacy(version)),e=>e.code==='SAVE_VERSION');assert.throws(()=>store.put('test',0,legacy(version)),e=>e.code==='SAVE_CONFLICT');}
  assert.equal(store.get('test').revision,1);assert.deepEqual(store.get('test').snapshot.data.heist,snapshot.data.heist);assert.equal(store.put('test',1,snapshot).revision,2);
 }finally{db.close();}
});
