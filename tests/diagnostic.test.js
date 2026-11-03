import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnosticIds,diagnosticPuzzle,inspectDiagnostic,newDiagnostic,normalizeDiagnostic,editDiagnostic,submitDiagnostic,nextDiagnostic,requestDiagnosticHint,diagnosticSummary} from '../src/diagnostic.js';

test('one diagnostic program handles varied inputs including boundaries and accepts different algorithms',()=>{
 const alternatives={names:'let total = reserve + cargo; total.log()',branch:'if fuel <= threshold then { 2.log() } else { 1.log() }',repeat:'for target in docks { let adjusted = offset + target; adjusted.log() }',counter:'let n = 0; while n < limit { n.log(); n = 1 + n }',function:'fn combine(load,extra) { return extra + load }',reply:'fn boost(load,extra) { return ! (extra + load) }',message:'?(parcel <- mailbox) { (1 + parcel).log() }',join:'?(b <- east & a <- west) { (b + a).log() }',coordination:'sync fn total(a,b) { return b+a }; ?(b <- east & a <- west) { let n=total(a,b); if n <= threshold then { n.log() } else { (reserve+n).log() } }'};
 for(const seed of [0,1,42,0xffffffff])for(const id of diagnosticIds){
  const p=diagnosticPuzzle(seed,id);assert.deepEqual(diagnosticPuzzle(seed,id),p);assert.ok(p.cases.length>=9,id);
  for(const source of [p.example,alternatives[id]]){const report=inspectDiagnostic(seed,id,source);assert.equal(report.ok,true,`${seed}/${id}: ${report.code}`);assert.equal(report.passed,report.total);}
 }
});
test('correct constants, unused computations and the wrong function mechanism do not prove a skill',()=>{
 assert.equal(inspectDiagnostic(42,'names','7.log()').ok,false);
 assert.equal(inspectDiagnostic(42,'function','fn combine(a,b) { return ! (a+b) }').ok,false);
 assert.equal(inspectDiagnostic(42,'reply','sync fn boost(a,b) { return a+b }').ok,false);
 assert.equal(inspectDiagnostic(42,'join','?(a <- west & b <- east) { a.log() }').ok,false);
 const r=inspectDiagnostic(42,'function','sync fn combine(a,b) { let unused=a+b; return 0 }');assert.equal(r.ok,false);assert.ok(r.cases.some(c=>c.result));
 const b=inspectDiagnostic(42,'branch','if fuel > threshold then { 1.log() } else { 1.log() }');assert.ok(b.passed>0&&b.passed<b.total);
});
test('the mechanism belongs to the actual host entry call, not an incidental helper or function selector',()=>{
 for(const source of ['sync fn zero() { return 0 }; fn combine(a,b) { return ! (a+b+zero()) }','sync fn identity(f) { return f }; fn replyAdd(a,b) { return ! (a+b) }; let combine=identity(replyAdd);'])assert.equal(inspectDiagnostic(42,'function',source).ok,false,source);
 assert.equal(inspectDiagnostic(42,'reply','sync fn add(a,b) { return a+b }; fn pick() { return ! add }; let boost=pick();').ok,false);
 assert.equal(inspectDiagnostic(42,'function','fn add(a,b) { return a+b }; let combine=add;').ok,true);
 assert.equal(inspectDiagnostic(42,'reply','fn replyAdd(a,b) { return ! (a+b) }; let boost=replyAdd;').ok,true);
});
test('all nine areas reject unresolved waiting and a new set really changes their inputs',()=>{
 const a=newDiagnostic(1),b=nextDiagnostic(a,5);
 for(const id of diagnosticIds){
  assert.ok(JSON.stringify(diagnosticPuzzle(a.seed,id).cases.map(c=>c.inputs))!==JSON.stringify(diagnosticPuzzle(b.seed,id).cases.map(c=>c.inputs)),`${id}: new inputs`);
  assert.equal(inspectDiagnostic(42,id,diagnosticPuzzle(42,id).example+'; let silent; ?(v <- silent) { v.log() }').ok,false,id);
 }
});
test('empty cases, runtime errors and waiting cannot manufacture diagnostic passes',()=>{
 const loop=diagnosticPuzzle(42,'counter');assert.equal(loop.cases[0].inputs.limit,0);assert.equal(loop.cases[1].inputs.limit,1);assert.equal(inspectDiagnostic(42,'counter',loop.example).ok,true);
 assert.equal(inspectDiagnostic(42,'repeat',diagnosticPuzzle(42,'repeat').example).cases[0].result.logs.length,0);
 for(const code of ['unknown.log()','let x = 0; while true { x=x+1 }'])assert.equal(inspectDiagnostic(42,'names',code).ok,false);
 const blocked=inspectDiagnostic(42,'names','(cargo+reserve).log(); let silent; ?(v <- silent) { v.log() }');assert.equal(blocked.ok,false);assert.equal(blocked.code,'waiting');
 assert.equal(inspectDiagnostic(42,'names','x'.repeat(3001)).code,'limit');
});
test('draft changes, progressive hints and new inputs preserve work without reviving a result',()=>{
 let s=newDiagnostic(42);const source=diagnosticPuzzle(s.seed,'names').example;assert.equal(submitDiagnostic(s,'names',source).ok,true);assert.deepEqual(diagnosticSummary(s).passed,['names']);
 editDiagnostic(s,'names','');editDiagnostic(s,'names',source);assert.equal(s.submitted.names,null);assert.deepEqual(diagnosticSummary(s).passed,[]);
 for(let i=0;i<4;i++)requestDiagnosticHint(s,'names');assert.equal(s.hints.names,2);
 const moved=nextDiagnostic(s,42);assert.notEqual(moved.seed,s.seed);assert.equal(moved.drafts.names,source);assert.equal(moved.hints.names,0);assert.equal(moved.submitted.names,null);
 assert.deepEqual(normalizeDiagnostic(JSON.parse(JSON.stringify(s))),s);const damaged=structuredClone(s);damaged.submitted.names='different';assert.equal(normalizeDiagnostic(damaged).submitted.names,null);
 assert.throws(()=>normalizeDiagnostic({...s,score:100}));assert.throws(()=>normalizeDiagnostic({...s,selected:'while'}));assert.throws(()=>normalizeDiagnostic({...s,hints:{...s.hints,names:3}}));
});
