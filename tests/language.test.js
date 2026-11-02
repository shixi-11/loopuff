import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { course } from '../src/course.js';
import { grade } from '../src/assessment.js';
import { run } from '../src/runner.js';
import { readSession, lessonWork } from '../src/progress.js';

export const candidates = [
  {
    id:'if-contribution', require:['if'], logs:['11'],
    good:['if 3 > 2 then { 11.log() } else { 9.log() }',
      'if 3 < 2 then { 9.log() } else { 11.log() }'],
    decoys:['if false then { (5 + 6).log() } else { let ignored = 0 }; 11.log()',
      'if true then { let ignored = 5 + 6 } else { let ignored = 1 }; 11.log()'],
    why:'Reject AST-wide concept collection and executed-but-unrelated control flow; require both true and false branch selection.'
  },
  {
    id:'for-contribution', require:['for'], logs:['2','3','4'],
    good:['for i in 2..5 { i.log() }','for number in [2,3,4] { number.log() }'],
    decoys:['for i in [] { i.log() }; 2.log(); 3.log(); 4.log()',
      'for i in [2,3,4] { let ignored = i + 1 }; 2.log(); 3.log(); 4.log()'],
    why:'Distinguish zero iterations and a completed unused loop from a loop that generates output; accept list and range solutions.'
  },
  {
    id:'while-contribution', require:['while'], logs:['0','1','2'],
    good:['let i = 0; while i < 3 { i.log(); i = i + 1 }'],
    decoys:['while false { 99.log() }; 0.log(); 1.log(); 2.log()',
      'let i = 0; while i < 3 { i = i + 1 }; 0.log(); 1.log(); 2.log()'],
    why:'Executed control flow alone must not earn the concept; the iterations must generate displayed values or their data dependencies.'
  },
  {
    id:'function-contribution', require:['call'], logs:['11'],
    good:['sync fn sum(a,b) { return a + b }; sum(5,6).log()',
      'sync fn sum(a,b) { return a + b }; let addFive = sum(5); addFive(6).log()',
      'sync fn display(a,b) { (a + b).log(); return 0 }; display(5,6)'],
    decoys:['sync fn sum(a,b) { return a + b }; 11.log()',
      'sync fn sum(a,b) { return a + b }; let ignored = sum(5,6); 11.log()',
      'sync fn sum(a,b) { return a + b }; let unusedPartial = sum(5); 11.log()'],
    why:'Unused declarations, ignored completed calls and unused partial applications differ from a consumed return or a call that emits output.'
  },
  {
    id:'single-message-contribution', require:['send','receive'], logs:['11'],
    good:['let parcel; { parcel ! 11 | ?(value <- parcel) { value.log() } }'],
    decoys:['let parcel; parcel ! 11; 11.log()',
      'let parcel; { parcel ! 8 | ?(value <- parcel) { let ignored = value + 3 } }; 11.log()'],
    why:'A queued unconsumed message and a consumed but discarded value must not satisfy transport-to-output requirements.'
  },
  {
    id:'join-contribution', require:['join'], logs:['37'],
    good:['let west; let east; { west ! 12 | east ! 25 | ?(a <- west & b <- east) { (a + b).log() } }'],
    decoys:['let west; let east; { west ! 12 | ?(a <- west & b <- east) { (a + b).log() } }; 37.log()',
      'let west; let east; { west ! 12 | east ! 25 | ?(a <- west & b <- east) { let ignored = a + b } }; 37.log()'],
    why:'Both messages must actually activate a join whose body contributes to the output; textual joint receive is insufficient.'
  },
  {
    id:'comparison-data-contribution', require:['compare'], logs:['true'],
    good:['(4 > 2).log()','let high = 4; (high > 2).log()'],
    decoys:['let ignored = 4 > 2; true.log()'],
    why:'Comparison metadata must flow with values rather than accumulate globally.'
  }
];

export function assertSemanticCandidate(candidate) {
  const goal={logs:candidate.logs,require:candidate.require};
  for(const source of candidate.good) {
    const report=grade(source,goal);
    assert.notEqual(report.result,null,`${candidate.id}: positive must execute: ${source}`);
    assert.deepEqual(report.result.logs,goal.logs,`${candidate.id}: positive output`);
    assert.equal(report.ok,true,`${candidate.id}: positive concepts`);
    assert.equal(report.score,100,`${candidate.id}: positive score`);
  }
  for(const source of candidate.decoys) {
    const report=grade(source,goal);
    // These preconditions prevent syntax errors from masquerading as anti-cheating success.
    assert.notEqual(report.result,null,`${candidate.id}: decoy MUST execute: ${source}`);
    assert.deepEqual(report.result.logs,goal.logs,`${candidate.id}: decoy MUST match output`);
    assert.equal(report.code,'conceptMissing',`${candidate.id}: fail for the intended reason`);
    assert.equal(report.ok,false);
    assert.equal(report.score,70,`${candidate.id}: no requested concept contributes`);
    const requirements=report.checks.find(item=>item.id==='concepts').requirements;
    assert.ok(requirements.every(item=>!item.passed),`${candidate.id}: no concept points`);
  }
}

export function verifyLegacy() {
  const expected=[
    ['signal','7.log()',[],['12'],'9.log()'],
    ['addition','(2 + 3).log()',['add'],['11'],'(2 + 6).log()'],
    ['names','let n = 5;\n(n + 2).log()',['name','add'],['14'],'let n = 8;\n(n + 2).log()'],
    ['leap','(2 + 3).log()',['add'],['6'],'(2 + 5).log()']
  ];
  assert.deepEqual(course.slice(0,4).map(item=>[item.id,item.source,item.independent.require,item.independent.logs,item.remix.source]),expected,
    'New lessons must be appended; existing ids, order, source and assessment goals stay unchanged');
  for(const lesson of course.slice(0,4)) {
    assert.equal(lesson.fragments.join(''),lesson.source);
    assert.deepEqual(run(lesson.source).logs,lesson.logs);
    assert.deepEqual(run(lesson.remix.source).logs,lesson.remix.logs);
    assert.equal(grade(lesson.independent.example,lesson.independent).score,100);
  }
  // A genuine v1 snapshot with a correct output that is missing the required concept.
  const raw=JSON.stringify({lang:'zh',state:{phase:'result',lesson:1,draft:'11.log()',
    assessedSource:'11.log()',grades:{addition:{score:70,best:70,attempts:2}},completed:['signal'],
    lessonWork:{addition:{phase:'result',draft:'11.log()',assessedSource:'11.log()',score:900,keys:12,errors:0}}}});
  const restored=readSession(raw),before=structuredClone(restored);
  const work=lessonWork(restored.state,'addition');
  assert.equal(work.draft,'11.log()');
  assert.equal(grade(work.draft,course[1].independent).score,70,'Old output-only draft must not become full credit');
  assert.deepEqual(restored,before,'Reading a report must not rewrite stored attempts, completion or drafts');
  const stale=structuredClone(restored.state);
  stale.lessonWork.addition.draft='(4 + 7).log()';
  assert.equal(lessonWork(stale,'addition').assessedSource,null,'Editing invalidates the previous assessment');
}

export function verifyIterationAndBranchSensitivity() {
  assert.deepEqual(run('if 2 > 4 then { 11.log() } else { 9.log() }').logs,['9']);
  assert.deepEqual(run('for i in 2..4 { i.log() }').logs,['2','3']);
  assert.deepEqual(run('for i in 2..=4 { i.log() }').logs,['2','3','4']);
  assert.deepEqual(run('let i = 0; while i < 2 { i.log(); i = i + 1 }').logs,['0','1']);
  assert.deepEqual(run('for i in 4..2 { i.log() }').logs,[]);
  assert.deepEqual(run('let west; let east; { west ! 12 | ?(a <- west & b <- east) { (a + b).log() } }').logs,[],
    'Missing message is normal quiescence, not a fabricated output or runtime error');
  const partial=grade('sync fn sum(a,b) { return a + b }; let plus = sum(5); plus(6).log()',
    {logs:['11'],require:['call','add']});
  assert.equal(partial.score,100);
  const oneConcept=grade('sync fn constant() { return 11 }; constant().log()',
    {logs:['11'],require:['call','add']});
  assert.equal(oneConcept.ok,false);assert.equal(oneConcept.score,85);
  assert.deepEqual(oneConcept.checks.find(item=>item.id==='concepts').requirements,
    [{concept:'call',passed:true},{concept:'add',passed:false}]);
}

export async function boundedFailure(source, expectedCodes, timeoutMs=1500) {
  const runner=new URL('../src/runner.js',import.meta.url).href;
  const assessment=new URL('../src/assessment.js',import.meta.url).href;
  const worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads');
    (async()=>{const {grade}=await import(workerData.assessment);
      const {run,LessonError}=await import(workerData.runner);
      try{run(workerData.source);parentPort.postMessage({accepted:true});}
      catch(e){parentPort.postMessage({lessonError:e instanceof LessonError,code:e.code,
        grade:grade(workerData.source,{logs:['11'],require:[]})});}
    })().catch(e=>{parentPort.postMessage({hostError:e.message});});`,
    {eval:true,workerData:{source,runner,assessment}});
  const result=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{worker.terminate();reject(Error(`Timeout is not a language-limit result: ${source}`));},timeoutMs);
    worker.once('message',message=>{clearTimeout(timer);resolve(message);});
    worker.once('error',error=>{clearTimeout(timer);reject(error);});
    worker.once('exit',code=>{clearTimeout(timer);reject(Error(`Worker exited before a language result: ${code}`));});
  });
  await worker.terminate();
  assert.equal(result.lessonError,true,`Expected deliberate language rejection: ${JSON.stringify(result)}`);
  assert.ok(expectedCodes.includes(result.code),`Unexpected language error ${result.code}`);
  assert.equal(result.grade.score,0);assert.equal(result.grade.result,null);
  assert.equal(result.grade.checks[1].status,'blocked');
}

export async function verifyBoundaries() {
  await boundedFailure('while true {}',['limit']);
  await boundedFailure('sync fn recurse(n) { return recurse(n) }; recurse(1).log()',['limit']);
  await boundedFailure('for i in 0..1000000 { i.log() }',['limit']);
  await boundedFailure('sync fn add(a,b) { return a+b }; add(1,2,3).log()',['arity']);
  for(const source of ['window.log()','process.env.log()','globalThis.log()',
    'fetch(7)','eval(7)','import(7)','let x = 1; x.constructor.log()'])
    await boundedFailure(source,['name','syntax']);
}


for(const candidate of candidates)test(candidate.id,()=>assertSemanticCandidate(candidate));
test('new learning units preserve the original four lessons and v1 work',verifyLegacy);
test('branch choices, iteration counts, partial calls and missing messages stay observable',verifyIterationAndBranchSensitivity);
test('language limits reject work deliberately rather than timing out',async()=>{await verifyBoundaries();await boundedFailure('let items = [1];'+Array(18).fill('items = [items, items];').join('')+'items.log()',['limit']);});

test('bindings, captures and local scopes follow the supported Tolang behavior',()=>{
  assert.deepEqual(run('let n = 2; let old = n; n = n + 3; old.log(); n.log()').logs,['2','5']);
  assert.deepEqual(run('let n = 2; let n = 5; n.log()').logs,['5']);
  assert.deepEqual(run('let n = 2; { n = 5; n.log() }; n.log()').logs,['5','5']);
  assert.deepEqual(run('let n = 2; sync fn read() { return n }; n = 5; read().log()').logs,['2']);
  assert.deepEqual(run('let n = 2; for i in [1,2] { let n = n + 1; n.log() }; n.log()').logs,['3','3','2']);
  assert.deepEqual(run('let n = 2; if true then { let n = 5; n.log() }; n.log()').logs,['5','2']);
  assert.deepEqual(run('let total = 0; for i in [2,3] { total = total + i }; total.log()').logs,['5']);
  assert.throws(()=>run('if false then { missing.log() } else { 3.log() }'),e=>e.code==='name');
  assert.throws(()=>run('let n = 2; if true then { n = 5 }; n.log()'),e=>e.code==='bindingScope');
  assert.throws(()=>run('for i in [2,3] { i.log() }; i.log()'),e=>e.code==='name');
});

test('arithmetic, boolean operators and list display keep language behavior',()=>{
  assert.deepEqual(run('(7 / 2).log(); (-7 / 2).log(); (7 % 3).log()').logs,['3','-3','1']);
  assert.deepEqual(run('[].log(); [true,2].log(); [[1],[2,3]].log()').logs,['[ ]','[ true 2 ]','[ [ 1 ] [ 2 3 ] ]']);
  assert.throws(()=>run('(false and (1 / 0 == 0)).log()'),e=>e.code==='zeroDivision');
  assert.throws(()=>run('let flag = 1; if flag then { 2.log() } else { 3.log() }'),e=>e.code==='type');
  assert.throws(()=>run('2 + 3.log()'),e=>e.code==='subset');
});

test('explicit state loops and reply functions produce consumed results',()=>{
  const source='let answer = loop (count = 0, total = 0) { if count < 4 then { continue (count + 1, total + 3) } else { break total } }; answer.log()';
  assert.deepEqual(run(source).logs,['12']);
  assert.deepEqual(run('let n = 9; let answer = loop (n = 0) { if n < 3 then { continue (n + 1) } else { break n } }; answer.log(); n.log()').logs,['3','9']);
  assert.deepEqual(run('fn increase(n) { return ! (n + 4) }; increase(9).log()').logs,['13']);
  const result=run('fn offset(n) { n + 3 }; let answer = offset(6); answer.log()');
  assert.deepEqual(result.logs,[]);assert.equal(result.waiting,1);
});

test('a parallel block does not hold unrelated continuation behind a waiting receive',()=>{
  const source='let west; let east; { west ! 12 | ?(a <- west & b <- east) { (a + b).log() } }; 37.log()';
  assert.deepEqual(run(source).logs,['37']);assert.equal(run(source).waiting,1);
  assert.deepEqual(run('{ 41.log() | 73.log() | 41.log() }').logs.sort(),['41','41','73']);
});

test('a reply sends once and continues the function body',()=>{
  assert.deepEqual(run('fn f(n) { return ! n; 8.log() }; f(3).log()').logs,['8','3']);
  assert.throws(()=>run('fn f(n) { let i = 0; while i < 2 { i = i + 1; return ! i } }; f(3).log()'),e=>e.code==='replyUsed');
});

test('synchronous functions need tail returns while still allowing an earlier return',()=>{
  assert.throws(()=>run('sync fn f(n) { if n > 1 then { return 8 } }; f(3).log()'),e=>e.code==='type');
  assert.throws(()=>run('sync fn f(n) { return 8; 9.log() }; f(3).log()'),e=>e.code==='type');
  assert.deepEqual(run('sync fn f(n) { if n > 0 then { return n }; return 7 }; f(2).log()').logs,['2']);
});

test('loop restrictions preserve the supported compile-time boundaries',()=>{
  assert.throws(()=>run('for i in [1,2] { { i.log() | 9.log() } }'),e=>e.code==='subset');
  assert.throws(()=>run('let i = 0; while i < 2 { break 8 }; i.log()'),e=>e.code==='syntax');
  assert.throws(()=>run('let item = 9; for item in [1,2] { item = item + 1 }; item.log()'),e=>e.code==='bindingScope');
  assert.deepEqual(run('for item in [1,2] { item = item + 1; item.log() }').logs,['2','3']);
});

test('unused collection items, bound arguments and message payloads do not add concept points',()=>{
  for(const source of [
    'for item in [11, 2 + 3] { item.log(); break }',
    'sync fn items() { return [11, 2 + 3] }; for item in items() { item.log(); break }',
    'sync fn first(a,b,c) { return a }; let partial = first(11, 2 + 3); partial(9).log()',
    'let parcel; { parcel ! (2 + 3) | ?(received <- parcel) { 11.log() } }'
  ]){
    const report=grade(source,{logs:['11'],require:['add']});
    assert.ok(report.result);assert.deepEqual(report.result.logs,['11']);assert.equal(report.score,70,source);
  }
  assert.equal(grade('for item in [2 + 3] { item.log() }',{logs:['5'],require:['add']}).score,100);
});

test('an early exit controls the value reached on either condition outcome',()=>{
 const source='sync fn choose(n) { if n > 0 then { return 1 }; return 2 };';
 for(const [input,output] of [[1,'1'],[0,'2']])assert.equal(grade(source+` choose(${input}).log()`,{logs:[output],require:['if','compare']}).score,100);
 assert.equal(grade('sync fn choose(n) { { if n > 0 then { return 1 } }; return 2 }; choose(0).log()',{logs:['2'],require:['if','compare']}).score,100);
 assert.equal(grade('sync fn choose(n) { if n > 0 then { { if n < 2 then { return 1 } } }; return 2 }; choose(3).log()',{logs:['2'],require:['if','compare']}).score,100);
 assert.equal(grade('for i in [1,2,3] { if i == 2 then { break }; i.log() }',{logs:['1'],require:['if','compare','for']}).score,100);
 assert.equal(grade('if 2 > 1 then { 3; }; 7.log()',{logs:['7'],require:['if','compare']}).score,70);
});

test('data-dependent tasks reject ignored messages and hard-coded branch answers',()=>{
 const cases=[
  ['let parcel; { parcel ! 8 | ?(n <- parcel) { 11.log() } }',{logs:['11'],require:['send','receive','name'],dataRequire:['receive','send']}],
  ['let west; let east; { west ! 15 | east ! 99 | ?(a <- west & b <- east) { (a + 0).log() } }',{logs:['15'],require:['send','receive','join','name','add'],dataRequire:['join','receive','send','add']}],
  ['sync fn total(a,b) { return a+b }; let west; let east; { west ! 6 | east ! 7 | ?(a <- west & b <- east) { let load = total(a,b); if load > 12 then { 18.log() } else { load.log() } } }',{logs:['18'],require:['send','receive','join','name','add','call','if','compare'],dataRequire:['join','receive','send','add','call']}]
 ];
 for(const [source,goal] of cases){const result=grade(source,goal);assert.equal(result.result.logs[0],goal.logs[0]);assert.equal(result.code,'conceptMissing');}
 const program='let a; let b; { a ! 7 | b ! 8 | ?(x <- a & y <- b) { (x+y).log() } }';
 assert.equal(grade(program,cases[1][1]).score,100);
});

test('range and list iteration preserve separate data and control sources',()=>{
 const goal={logs:['11'],require:['send','receive','name'],dataRequire:['receive','send']};
 const constant='let parcel; { parcel ! 99 | ?(n <- parcel) { let fixed = 11; for x in fixed..12 { x.log() } } }';
 const wrong=grade(constant,goal);assert.deepEqual(wrong.result.logs,['11']);assert.equal(wrong.code,'conceptMissing');
 assert.equal(grade('let parcel; { parcel ! 11 | ?(n <- parcel) { for x in n..12 { x.log() } } }',goal).score,100);
 const joined='let west; let east; { west ! [6] | east ! 7 | ?(xs <- west & y <- east) { for x in xs { (x+y).log() } } }';
 assert.equal(grade(joined,{logs:['13'],require:['join'],dataRequire:['join']}).score,100);
 const unused='let west; let east; { west ! [6] | east ! 7 | ?(xs <- west & y <- east) { for x in xs { (x+7).log() } } }';
 assert.equal(grade(unused,{logs:['13'],require:['join'],dataRequire:['join']}).score,70);
});
