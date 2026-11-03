import test from 'node:test';
import assert from 'node:assert/strict';
import {run} from '../src/runner.js';
import {observeProgram,programFrame} from '../src/program-scene.js';
import {course} from '../src/course.js';
import {diagnosticIds,diagnosticPuzzle} from '../src/diagnostic.js';
test('opt-in recording preserves every existing runtime observation and default result shape',()=>{
 const sources=[...course.flatMap(item=>[item.source,item.remix.source,item.independent.example]),...diagnosticIds.flatMap(id=>diagnosticPuzzle(42,id).cases.map(item=>item.prefix+diagnosticPuzzle(42,id).example+(item.suffix||'')))];
 for(const source of sources){const normal=run(source),recorded=run(source,{trace:true}),{recording,...observed}=recorded;assert.deepEqual(observed,normal,source);assert.equal(Object.hasOwn(normal,'recording'),false);assert.ok(recording.events.length>0);recording.events.forEach((event,index)=>{assert.equal(event.sequence,index+1);assert.ok(event.start>=0&&event.end>event.start&&event.end<=source.length);});}
});
test('coordination records actual atomic messages, scoped function values, condition and selected output',()=>{
 const source=course.find(item=>item.id==='coordination').source,report=observeProgram(source),events=report.events;
 assert.equal(report.ok,true);assert.deepEqual(events.filter(e=>e.type==='send').map(e=>e.value),['6','7']);assert.equal(events.some(e=>e.type==='wait'),false);
 const receive=events.find(e=>e.type==='receive');assert.deepEqual(receive.values,['6','7']);assert.equal(receive.messages.length,2);
 const before=programFrame(report,receive.sequence-1),after=programFrame(report,receive.sequence);assert.deepEqual(before.channels.map(c=>c.messages.length),[1,1]);assert.deepEqual(after.channels.map(c=>c.messages.length),[0,0]);
 const entered=events.find(e=>e.type==='call'),inside=events.find(e=>e.type==='calculate'&&e.context===entered.invocation);assert.equal(entered.name,'total');assert.deepEqual(entered.args,['6','7']);assert.equal(inside.value,'13');
 const outer=events.find(e=>e.type==='received-names');assert.notEqual(inside.bindingIds.a,outer.bindingIds.a);assert.equal(programFrame(report,inside.sequence).context.name,'total');
 assert.equal(events.find(e=>e.type==='branch').value,'true');assert.deepEqual(events.filter(e=>e.type==='log').map(e=>e.value),['18']);assert.equal(events.filter(e=>source.slice(e.start,e.end)==='load.log()').length,0);
});
test('waiting, duplicate channel demand and competing receivers never fabricate partial consumption',()=>{
 const pending=observeProgram('let west; let east; { west ! 6 | ?(a <- west & b <- east) { (a+b).log() } }');assert.equal(pending.result.waiting,1);const state=programFrame(pending,pending.events.length);assert.equal(state.waiting.length,1);assert.equal(state.channels.find(c=>c.names.includes('west')).messages.length,1);assert.equal(pending.events.some(e=>e.type==='receive'),false);
 const visible=observeProgram('let n=5; let box; ?(x <- box) { (n+x).log() }'),wait=programFrame(visible,visible.events.length);assert.equal(wait.event.type,'wait');assert.equal(wait.names.n,5);assert.ok(wait.bindingIds.n>0);
 const duplicate=observeProgram('let box; { box ! 4 | ?(a <- box & b <- box) { (a+b).log() } | box ! 4 }');const received=duplicate.events.find(e=>e.type==='receive');assert.equal(new Set(received.messages).size,2);assert.equal(received.channels[0],received.channels[1]);assert.deepEqual(programFrame(duplicate,duplicate.events.length).channels[0].messages,[]);
 const competition=observeProgram('let box; { ?(a <- box) { a.log() } | ?(b <- box) { b.log() } | box ! 3 }'),end=programFrame(competition,competition.events.length);assert.equal(competition.result.waiting,1);assert.equal(end.waiting.length,1);assert.deepEqual(end.outputs,['3']);
});
test('function replies, nested calls and name shadowing keep their actual origins',()=>{
 const reply=observeProgram(course.find(item=>item.id==='reply').source),called=reply.events.find(e=>e.type==='call');assert.equal(called.kind,'reply');assert.equal(reply.events.find(e=>e.type==='send').reply,true);assert.equal(reply.events.find(e=>e.type==='call-result').value,'7');const done=programFrame(reply,reply.events.length);assert.equal(done.channels[0].reply,true);assert.deepEqual(done.channels[0].messages,[]);
 const nested=observeProgram('sync fn add(a,b) { return a+b }; sync fn twice(a) { return add(a,a) }; let a=9; twice(3).log()');assert.equal(nested.ok,true);assert.deepEqual(nested.events.filter(e=>e.type==='call').map(e=>e.invocation),[1,2]);assert.deepEqual(nested.events.filter(e=>e.type==='call-result').map(e=>e.invocation),[2,1]);assert.deepEqual(nested.result.logs,['6']);
});

test('channel aliases follow the exact binding through reassignment and same-name shadowing',()=>{
 const moved=observeProgram('let a; let b; let c = a; c = b; c ! 7'),end=programFrame(moved,moved.events.length);
 assert.deepEqual(end.channels.map(port=>port.names),[['a'],['b','c']]);assert.equal(end.channels[1].messages[0].value,'7');
 const released=observeProgram('let a; let c=a; c=4; a ! c'),done=programFrame(released,released.events.length);assert.deepEqual(done.channels[0].names,['a']);
 const shadowed=observeProgram('let a; let b; let c=a; { let c=b; c ! 2 | a ! 1 }'),sent=shadowed.events.filter(e=>e.type==='send');assert.equal(shadowed.ok,true);
 const first=programFrame(shadowed,sent[0].sequence),second=programFrame(shadowed,sent[1].sequence);assert.ok(first.channels[1].names.includes('c'));assert.ok(second.channels[0].names.includes('c'));assert.notEqual(first.channels[1].bindings.find(v=>v.name==='c').bindingId,second.channels[0].bindings.find(v=>v.name==='c').bindingId);
 const fn=observeProgram('let a; let b; let c=a; sync fn switch() { c=b; return 0 }; switch().log(); c!7'),fnEnd=programFrame(fn,fn.events.length);assert.ok(fnEnd.channels[0].names.includes('c'));assert.ok(!fnEnd.channels[1].names.includes('c'));
 const parallel=observeProgram('let a; let b; let c=a; { c=b; c!2 | c!1 }'),parallelSends=parallel.events.filter(e=>e.type==='send');assert.ok(programFrame(parallel,parallelSends[0].sequence).channels[1].names.includes('c'));assert.ok(programFrame(parallel,parallelSends[1].sequence).channels[0].names.includes('c'));
});
test('empty loops, final false checks, runtime errors and truncation remain different outcomes',()=>{
 const empty=observeProgram('for item in [] { item.log() }');assert.equal(empty.ok,true);assert.deepEqual(empty.result.logs,[]);assert.equal(empty.events.some(e=>e.type==='iteration'),false);
 const loop=observeProgram('let n=0; while n<2 { n.log(); n=n+1 }');assert.deepEqual(loop.events.filter(e=>e.type==='while').map(e=>e.value),['true','true','false']);assert.deepEqual(loop.events.filter(e=>e.type==='assign').map(e=>e.value),['1','2']);
 const error=observeProgram('7.log(); (1/0).log()');assert.equal(error.ok,false);assert.equal(error.code,'zeroDivision');assert.deepEqual(error.result.logs,['7']);assert.deepEqual(programFrame(error,error.events.length).outputs,['7']);assert.equal(observeProgram('let =').events.length,0);
 const source='for n in 0..200 { (n+1).log() }',normal=run(source),bounded=run(source,{trace:true});assert.equal(bounded.recording.events.length,512);assert.equal(bounded.recording.truncated,true);const {recording,...rest}=bounded;assert.deepEqual(rest,normal);assert.equal(normal.logs.length,200);assert.ok(programFrame({...bounded,...recording},512).outputs.length<200);
});

test('nested shared lists cannot expand a trace label without bound',()=>{
 const source='let a=['+Array(16).fill('1').join(',')+']; let b=['+Array(16).fill('a').join(',')+']; let c=['+Array(16).fill('b').join(',')+']; let d=['+Array(16).fill('c').join(',')+']; 7.log()',report=observeProgram(source);
 assert.equal(report.ok,true);assert.deepEqual(report.result.logs,['7']);const labels=report.events.filter(event=>event.type==='bind').map(event=>event.value);assert.equal(labels.length,4);assert.ok(labels.at(-1).includes('…'));assert.ok(labels.every(value=>value.length<256));
});
