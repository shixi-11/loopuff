import test from 'node:test';
import assert from 'node:assert/strict';
import {rememberLesson,lessonWork,explorationProgress} from '../src/progress.js';
test('lesson snapshots keep independent drafts and invalidate changed assessments',()=>{
  const state={phase:'independent',draft:'(2 + 4).log()',assessedSource:'(2 + 4).log()',fragment:2,typed:'',score:400,errors:1,keys:50};
  rememberLesson(state,'leap');
  Object.assign(state,{draft:'9.log()',assessedSource:null,phase:'remix'});
  rememberLesson(state,'signal');
  state.phase='play';rememberLesson(state,'leap');
  assert.equal(lessonWork(state,'leap').draft,'(2 + 4).log()');
  assert.equal(lessonWork(state,'signal').draft,'9.log()');
  state.lessonWork.leap.draft='0.log()';
  assert.equal(lessonWork(state,'leap').assessedSource,null);
  const restored=JSON.parse(JSON.stringify(state));
  assert.deepEqual(lessonWork(restored,'signal'),lessonWork(state,'signal'));
});
test('paused and empty work resumes without restoring a deleted draft',()=>{
  const state={phase:'pause',previousPhase:'independent',draft:'',assessedSource:'7.log()'};
  rememberLesson(state,'signal');
  assert.equal(lessonWork(state,'signal').phase,'independent');
  assert.equal(lessonWork(state,'signal').draft,'');
  assert.equal(lessonWork(state,'signal').assessedSource,null);
  assert.equal(lessonWork({lessonWork:{signal:{phase:'fake'}}},'signal'),null);
  const legacy={phase:'welcome',resumePhase:'independent',draft:'12.log()',assessedSource:null};
  rememberLesson(legacy,'signal',legacy.resumePhase);
  assert.equal(lessonWork(legacy,'signal').draft,'12.log()');
});
test('exploration rewards count unique completions, never typing scores or repeated stamps',()=>{
  const ids=['signal','add','name','leap'];
  const state={completed:['signal','signal','leap','unknown'],score:999999,grades:{name:{best:100}}};
  assert.deepEqual(explorationProgress(state,{stamps:[0,1,1,9]},ids),{completed:2,stamps:2,points:300,next:1});
  assert.equal(explorationProgress({completed:ids},{stamps:[0,1,2]},ids).points,550);
  assert.equal(explorationProgress({completed:ids},{stamps:[]},ids).next,-1);
});
