import test from 'node:test';
import assert from 'node:assert/strict';
import {emptySave,normalizeSave,parseSave,SaveError,saveLimit} from '../server/save-format.mjs';
import {newVault,restoreVault} from '../src/vault.js';
import {newChase,restoreChase} from '../src/chase.js';
import {newDispatch,restoreDispatch} from '../src/dispatch.js';
import {lessonWork} from '../src/progress.js';
const fixture=()=>{
 const snapshot=emptySave();
 snapshot.data.course={lang:'zh',state:{lesson:1,phase:'independent',draft:'',assessedSource:null,completed:['signal'],score:100,errors:0,keys:4,grades:{signal:{score:100,best:100,attempts:1}},lessonWork:{addition:{phase:'independent',draft:'',assessedSource:null,fragment:0,typed:'',score:0,errors:0,keys:0}}}};
 snapshot.data.vault=newVault(8);snapshot.data.vault.edited=[0];
 snapshot.data.chase=newChase();snapshot.data.chase.work.thief.drafts[0]='';
 snapshot.data.dispatch=newDispatch(9);snapshot.data.dispatch.drafts.relay='';
 return snapshot;
};
test('guide scratch drafts travel inside the course backup without changing legacy lesson work',()=>{
 const original=fixture(),lesson=structuredClone(original.data.course.state.lessonWork);
 original.data.course.state.guideWork={signal:'',repeat:'for n in [3,5] { n.log() }'};original.data.course.state.guideSelected='repeat';
 const restored=parseSave(JSON.stringify(original));assert.deepEqual(restored.data.course.state.guideWork,original.data.course.state.guideWork);assert.equal(restored.data.course.state.guideSelected,'repeat');assert.deepEqual(restored.data.course.state.lessonWork,lesson);
 original.data.course.state.guideWork.signal='x'.repeat(4097);assert.throws(()=>normalizeSave(original),SaveError);
});
test('save files preserve all four legacy formats, intentionally empty work and absent domains',()=>{
 const original=fixture(),parsed=parseSave(JSON.stringify(original));
 assert.deepEqual(parsed,original);
 assert.deepEqual(restoreVault(parsed.data.vault,99),original.data.vault);
 assert.deepEqual(restoreChase(parsed.data.chase),original.data.chase);
 assert.deepEqual(restoreDispatch(parsed.data.dispatch,99),original.data.dispatch);
 assert.equal(lessonWork(parsed.data.course.state,'addition').draft,'');
 assert.deepEqual(parseSave(JSON.stringify(emptySave())),emptySave());
});
test('save validation rejects future, oversized and unrelated data before any application',()=>{
 for(const invalid of [null,[],{}, {...emptySave(),version:2},{...emptySave(),password:'private'}, {...emptySave(),data:{course:null,vault:null,chase:null,dispatch:null,account:{}}}])assert.throws(()=>normalizeSave(invalid),SaveError);
 const oversized=fixture();oversized.data.chase.work.police.drafts[0]='x'.repeat(4097);
 assert.throws(()=>normalizeSave(oversized),SaveError);
 const secret=fixture();secret.data.course.state.form={password:'private'};
 assert.throws(()=>normalizeSave(secret),SaveError);
 assert.throws(()=>parseSave(' '.repeat(saveLimit+1)),e=>e.code==='SAVE_TOO_LARGE');
 assert.throws(()=>parseSave('{'),e=>e.code==='SAVE_INVALID');
});
test('stale results are invalidated without removing source or completion history',()=>{
 const snapshot=fixture();snapshot.data.course.state.assessedSource='old.log()';snapshot.data.course.state.lessonWork.addition.assessedSource='old.log()';
 snapshot.data.vault.submitted='old.log()';snapshot.data.chase.work.police.submitted='old.log()';snapshot.data.dispatch.submitted.relay='old.log()';
 const clean=normalizeSave(snapshot);
 assert.equal(clean.data.course.state.assessedSource,null);assert.equal(clean.data.course.state.lessonWork.addition.assessedSource,null);
 assert.equal(clean.data.vault.submitted,null);assert.equal(clean.data.chase.work.police.submitted,null);assert.equal(clean.data.dispatch.submitted.relay,null);
 assert.deepEqual(clean.data.course.state.completed,['signal']);assert.deepEqual(clean.data.vault.edited,[0]);
});
