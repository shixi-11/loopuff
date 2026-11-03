import test from 'node:test';
import assert from 'node:assert/strict';
import {emptySave,saveKeys} from '../server/save-format.mjs';
import {captureSave,readBaseline,baselineMatches,createSaveAccess,journalKey,ownerKey,readOwner} from '../src/save-data.js';
const storage=()=>{const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem(key,value){values.set(key,String(value));},removeItem(key){values.delete(key);}};};
const lockManager=()=>{let tail=Promise.resolve();return {request(name,options,operation){const result=tail.then(operation);tail=result.catch(()=>{});return result;}};};
const access=store=>createSaveAccess(store,{locks:lockManager()});
const snapshot=draft=>{const result=emptySave();result.data.course={state:{lesson:0,phase:'independent',draft,assessedSource:null}};return result;};
test('capture reads six game domains and leaves absent domains absent',()=>{
 const store=storage();store.setItem('account-form','secret');store.setItem('other-site','private');store.setItem(saveKeys.course,JSON.stringify(snapshot('').data.course));
 const value=captureSave(store);assert.deepEqual(value.snapshot,snapshot(''));assert.equal(Object.keys(value.baseline).length,7);
 assert.equal(store.values.size,3);assert.ok(!JSON.stringify(value).includes('secret'));assert.ok(!JSON.stringify(value).includes('private'));
});
test('applying a save verifies its preview baseline, binds ownership and removes the completed journal',async()=>{
 const store=storage(),base=readBaseline(store),client=access(store);await client.apply(snapshot('7.log()'),base,{accountId:'a'});
 assert.equal(captureSave(store).snapshot.data.course.state.draft,'7.log()');assert.equal(readOwner(store),'a');assert.equal(store.getItem(journalKey),null);
 assert.equal(baselineMatches(store,base),false);await assert.rejects(client.apply(snapshot('8.log()'),base),e=>e.code==='SAVE_LOCAL_CHANGED');
 const current=readBaseline(store),owner=store.getItem(ownerKey);store.setItem(ownerKey,JSON.stringify({version:1,accountId:'b'}));
 await assert.rejects(client.apply(snapshot('9.log()'),current,{expectedOwner:owner}),e=>e.code==='SAVE_LOCAL_CHANGED');
});
test('invalid and future saves cannot change any stored byte',async()=>{
 const store=storage(),base=readBaseline(store),client=access(store);const bad=snapshot('x'.repeat(4097));
 await assert.rejects(client.apply(bad,base));assert.deepEqual(readBaseline(store),base);assert.equal(store.values.size,0);
 const future=snapshot('');future.data.course.state.lesson=999;await assert.rejects(client.apply(future,base),e=>e.code==='SAVE_NEW_LESSONS');assert.equal(store.values.size,0);
});
test('a quota failure rolls back earlier successful writes without deleting unrelated keys',async()=>{
 const store=storage();store.setItem('other','keep');const before=readBaseline(store),set=store.setItem;
 store.setItem=(key,value)=>{if(key===saveKeys.vault){store.setItem=set;throw Error('quota');}set.call(store,key,value);};
 const value=snapshot('7.log()');value.data.vault={version:1,seed:5,stage:0,drafts:['','',''],edited:[],stamps:[],cleared:[],submitted:null};
 await assert.rejects(access(store).apply(value,before),e=>e.code==='SAVE_STORAGE');assert.deepEqual(readBaseline(store),before);assert.equal(store.getItem('other'),'keep');assert.equal(store.getItem(journalKey),null);
});
test('a restart recovers a write interrupted after the first game was stored',async()=>{
 const store=storage(),base=readBaseline(store),next=JSON.stringify(snapshot('7.log()').data.course);
 store.setItem(journalKey,JSON.stringify({version:1,attempted:1,entries:[{key:saveKeys.course,before:null,after:next}]}));store.setItem(saveKeys.course,next);
 const client=access(store);assert.equal((await client.recover()).status,'recovered');assert.deepEqual(readBaseline(store),base);assert.equal(store.getItem(journalKey),null);
 await assert.rejects(client.write(()=>store.setItem(saveKeys.course,'old memory')),e=>e.code==='SAVE_RECOVERY_REQUIRED');
});
test('rollback preserves another tab third version and the two reviewed originals',async()=>{
 const store=storage(),base=readBaseline(store),set=store.setItem;
 const third=JSON.stringify(snapshot('third.log()').data.course);
 store.setItem=(key,value)=>{if(key===journalKey&&JSON.parse(value).attempted===2){set.call(store,saveKeys.course,third);store.setItem=set;throw Error('quota');}set.call(store,key,value);};
 const client=access(store);await assert.rejects(client.apply(snapshot('incoming.log()'),base),e=>e.code==='SAVE_RECOVERY_REQUIRED');
 assert.equal(store.getItem(saveKeys.course),third);assert.ok(store.getItem(journalKey));
 const recovered=await client.recover();assert.equal(recovered.status,'pending');assert.equal(recovered.conflicts[0].before,null);assert.match(recovered.conflicts[0].after,/incoming/);assert.equal(recovered.conflicts[0].current,third);
 const raw=store.getItem(journalKey),review=readBaseline(store);store.setItem(saveKeys.chase,'newer');
 await assert.rejects(client.keep(review,raw),e=>e.code==='SAVE_LOCAL_CHANGED');
 store.removeItem(saveKeys.chase);await client.keep(review,raw);assert.equal(store.getItem(journalKey),null);assert.equal(store.getItem(saveKeys.course),third);
});
test('a broken recovery or owner record blocks restoring instead of guessing a guest or overwriting',async()=>{
 const store=storage();store.setItem(ownerKey,'broken');assert.throws(()=>readOwner(store),e=>e.code==='SAVE_OWNER_INVALID');
 store.setItem(journalKey,JSON.stringify({version:1,attempted:1,entries:[{key:'other',before:null,after:'bad'}]}));
 await assert.rejects(access(store).recover(),e=>e.code==='SAVE_RECOVERY_REQUIRED');assert.equal(store.getItem('other'),null);
});
test('a journal update that fails once rolls back with the last successfully stored journal',async()=>{
 const store=storage(),base=readBaseline(store),set=store.setItem;
 store.setItem=(key,value)=>{if(key===journalKey&&JSON.parse(value).attempted===2){store.setItem=set;throw Error('quota');}set.call(store,key,value);};
 await assert.rejects(access(store).apply(snapshot('new.log()'),base,{accountId:'a'}),e=>e.code==='SAVE_STORAGE');
 assert.deepEqual(readBaseline(store),base);assert.equal(store.getItem(journalKey),null);
});
test('recovery confirmation is invalidated by a changed owner as well as game progress',async()=>{
 const store=storage();store.setItem(ownerKey,'third');store.setItem(journalKey,JSON.stringify({version:1,attempted:1,entries:[{key:ownerKey,before:'a',after:'b'}]}));
 const client=access(store);assert.equal((await client.recover()).status,'pending');const base=readBaseline(store),raw=store.getItem(journalKey);
 store.setItem(ownerKey,'fourth');await assert.rejects(client.keep(base,raw),e=>e.code==='SAVE_LOCAL_CHANGED');assert.ok(store.getItem(journalKey));
});
test('restoration and ordinary writers serialize, and a stale page cannot write after restoration',async()=>{
 const store=storage(),locks=lockManager(),restorer=createSaveAccess(store,{locks}),other=createSaveAccess(store,{locks});
 const before=readBaseline(store);const restored=restorer.apply(snapshot('incoming.log()'),before);
 let wrote=false;const writing=other.write(()=>{wrote=true;store.setItem(saveKeys.course,JSON.stringify(snapshot('third.log()').data.course));});
 await restored;await assert.rejects(writing,e=>e.code==='SAVE_LOCAL_CHANGED');assert.equal(wrote,false);assert.equal(captureSave(store).snapshot.data.course.state.draft,'incoming.log()');
 await assert.rejects(restorer.write(()=>{}),e=>e.code==='SAVE_RECOVERY_REQUIRED');
});
test('a current write queued first makes an older restore preview expire',async()=>{
 const store=storage(),locks=lockManager(),writer=createSaveAccess(store,{locks}),restorer=createSaveAccess(store,{locks}),base=readBaseline(store);
 const written=writer.write(()=>store.setItem(saveKeys.course,JSON.stringify(snapshot('third.log()').data.course)));
 const restored=restorer.apply(snapshot('incoming.log()'),base);await written;await assert.rejects(restored,e=>e.code==='SAVE_LOCAL_CHANGED');
 assert.equal(captureSave(store).snapshot.data.course.state.draft,'third.log()');assert.equal(store.getItem(journalKey),null);
});
test('without Web Locks restoration is unavailable, but ordinary local saves still work',async()=>{
 const store=storage(),client=createSaveAccess(store,{locks:null});await client.write(()=>store.setItem(saveKeys.course,JSON.stringify(snapshot('7.log()').data.course)));
 await assert.rejects(client.apply(snapshot('9.log()'),readBaseline(store)),e=>e.code==='SAVE_LOCK_REQUIRED');assert.equal(captureSave(store).snapshot.data.course.state.draft,'7.log()');
});
test('a page cancelled while waiting for the shared lock cannot restore or change ownership',async()=>{
 const store=storage(),locks=lockManager(),client=createSaveAccess(store,{locks}),base=readBaseline(store);let release,active=true;
 const held=locks.request('loopuff-progress-v1',{},()=>new Promise(done=>release=done));await Promise.resolve();
 const pending=client.apply(snapshot('incoming.log()'),base,{isCurrent:()=>active});active=false;release();await held;
 await assert.rejects(pending,e=>e.code==='SAVE_CANCELLED');assert.deepEqual(readBaseline(store),base);assert.equal(store.getItem(journalKey),null);
 await assert.rejects(client.bind('a',base,{isCurrent:()=>active}),e=>e.code==='SAVE_CANCELLED');assert.equal(readOwner(store),null);
});
test('account binding follows a confirmed matching browser snapshot without replacing its drafts',async()=>{
 const store=storage(),client=access(store);store.setItem(saveKeys.course,JSON.stringify(snapshot('7.log()').data.course));const base=readBaseline(store);
 await client.bind('a',base);assert.equal(readOwner(store),'a');assert.equal(captureSave(store).snapshot.data.course.state.draft,'7.log()');
 await client.write(()=>store.setItem(saveKeys.course,JSON.stringify(snapshot('8.log()').data.course)));
 await assert.rejects(client.bind('b',base),e=>e.code==='SAVE_LOCAL_CHANGED');assert.equal(readOwner(store),'a');
});
