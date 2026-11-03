import test from 'node:test';
import assert from 'node:assert/strict';
import {emptySave,parseSave} from '../server/save-format.mjs';
import {createMergePlan,resolveMerge} from '../src/save-merge.js';
import {rememberLesson,lessonWork} from '../src/progress.js';
import {createProgressStore} from '../server/progress-store.mjs';
import {DatabaseSync} from 'node:sqlite';
const work=(rewriteDraft)=>({phase:'rewrite',draft:'12.log()',assessedSource:'12.log()',fragment:0,typed:'',score:0,errors:0,keys:0,...(rewriteDraft===undefined?{}:{rewriteDraft})});
const snapshot=(rewriteDraft)=>{const s=emptySave();s.data.course={state:{lesson:0,...work(rewriteDraft),lessonWork:{signal:work(rewriteDraft)}}};return s;};
test('rewrite drafts round-trip, including intentional empty; old lessons do not inherit another rewrite',()=>{
 for(const draft of ['3.log(); 8.log()','']){
  const state={...work(draft)};rememberLesson(state,'signal');assert.equal(lessonWork(state,'signal').rewriteDraft,draft);
  assert.deepEqual(parseSave(JSON.stringify(snapshot(draft))),snapshot(draft));
 }
 const state={lessonWork:{signal:{phase:'independent',draft:''}},rewriteDraft:'other lesson'};
 Object.assign(state,lessonWork(state,'signal'));assert.equal(state.rewriteDraft,undefined);
 const bad=snapshot('x'.repeat(4097));assert.throws(()=>parseSave(JSON.stringify(bad)));
});
test('whole lesson choice retains optional rewrite from an old file and explicitly compares two edited drafts',()=>{
 const a=snapshot('3.log(); 8.log()'),old=snapshot(undefined);old.data.course.state.phase='independent';old.data.course.state.lessonWork.signal.phase='independent';
 const p=createMergePlan(a,old);assert.equal(p.conflicts.length,1);
 const chosen=resolveMerge(p,{[p.conflicts[0].id]:'incoming'}).data.course.state;
 assert.equal(chosen.rewriteDraft,a.data.course.state.rewriteDraft);assert.equal(chosen.draft,'12.log()');assert.equal(chosen.assessedSource,'12.log()');
 const b=snapshot(''),q=createMergePlan(a,b);assert.equal(q.conflicts.length,1);
 assert.equal(q.conflicts[0].incoming.work.rewriteDraft,'');assert.equal(resolveMerge(q,{[q.conflicts[0].id]:'incoming'}).data.course.state.rewriteDraft,'');
});
test('old writers cannot erase rewrite fields even with a matching revision; stale revision wins',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE user (id TEXT PRIMARY KEY); INSERT INTO user VALUES (\'learner\')');
 try{
  const store=createProgressStore(db);store.put('learner',0,snapshot(''));
  const old=snapshot(undefined);old.data.course.state.phase='independent';old.data.course.state.lessonWork.signal.phase='independent';
  assert.throws(()=>store.put('learner',1,old),e=>e.code==='SAVE_VERSION');
  assert.throws(()=>store.put('learner',0,old),e=>e.code==='SAVE_CONFLICT');
  assert.equal(store.get('learner').snapshot.data.course.state.rewriteDraft,'');
  store.put('learner',1,snapshot('3.log(); 8.log()'));assert.equal(store.get('learner').revision,2);
 }finally{db.close();}
});
test('a single-lesson mirror may migrate to its own map, while another lesson cannot hide its omission',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE user (id TEXT PRIMARY KEY); INSERT INTO user VALUES (\'learner\')');
 try{
  const store=createProgressStore(db),before=snapshot('R');delete before.data.course.state.lessonWork;
  store.put('learner',0,before);
  const moved=snapshot(undefined);moved.data.course.state={lesson:1,phase:'independent',draft:'',lessonWork:{signal:work('R')}};
  store.put('learner',1,moved);assert.equal(store.get('learner').revision,2);
  const mirror=structuredClone(moved);mirror.data.course.state.rewriteDraft='B';store.put('learner',2,mirror);
  assert.throws(()=>store.put('learner',3,moved),e=>e.code==='SAVE_VERSION');
  assert.equal(store.get('learner').snapshot.data.course.state.rewriteDraft,'B');
 }finally{db.close();}
});
