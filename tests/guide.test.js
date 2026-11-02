import test from 'node:test';
import assert from 'node:assert/strict';
import {guideStations,executeGuide,comparisonPrograms,readGuideWork} from '../src/guide.js';
import {course,locales} from '../src/course.js';
import {parseRoute,routeUrl,languageUrl} from '../src/routing.js';

test('guide scenes use the native-checked course programs and actual output spans',()=>{
 assert.equal(guideStations.length,8);
 for(const station of guideStations){
  assert.equal(station,course.find(c=>c.id===station.id));
  const report=executeGuide(station.source);assert.equal(report.ok,true,station.id);assert.deepEqual(report.result.logs,station.logs);
  for(const output of report.result.outputs){assert.ok(output.start>=0&&output.end<=station.source.length&&output.start<output.end);assert.match(station.source.slice(output.start,output.end),/log/);}
 }
});
test('guide observations come from the edited source, including errors and empty output',()=>{
 const original=executeGuide('7.log()');assert.equal(original.ok,true);assert.deepEqual(original.result.logs,['7']);
 const edited=executeGuide('(4 + 5).log()');assert.equal(edited.ok,true);assert.deepEqual(edited.result.logs,['9']);assert.equal(edited.source,'(4 + 5).log()');
 const broken=executeGuide('unknown.log()');assert.equal(broken.ok,false);assert.ok(broken.code);assert.ok(!broken.result);
 const silent=executeGuide('let n = 3;');assert.equal(silent.ok,true);assert.deepEqual(silent.result.logs,[]);
 const runaway=executeGuide('while true {}');assert.equal(runaway.ok,false);
 const loop=executeGuide('for n in [3,5,9] { n.log() }');assert.equal(loop.ok,true);assert.deepEqual(loop.result.logs,['3','5','9']);assert.equal(loop.result.outputs[0].start,loop.result.outputs[2].start);
 const waiting=executeGuide('let parcel; ?(value <- parcel) { value.log() }');assert.equal(waiting.ok,true);assert.equal(waiting.result.waiting,1);assert.deepEqual(waiting.result.logs,[]);
});
test('guide reload restores explicit empty drafts without taking over course work',()=>{
 const saved={signal:'',repeat:'for n in [3,5] { n.log() }',unknown:'1.log()',function:8};
 const restored=readGuideWork(JSON.parse(JSON.stringify(saved)));assert.deepEqual(restored,{signal:'',repeat:saved.repeat});
 assert.equal(readGuideWork({signal:'x'.repeat(5000)}).signal.length,4096);assert.deepEqual(readGuideWork(null),{});
});
test('comparison routes remain a guide child in both hosts and across every language',()=>{
 for(const [locale]of locales)for(const prefix of ['','/games/loopuff']){
  const url=routeUrl(`https://example.com${prefix}/zh/guide/`,locale,'compare');
  assert.equal(url.pathname,`${prefix}/${locale}/guide/compare/`);
  assert.deepEqual(parseRoute(url.pathname),{locale,view:'compare'});
  assert.equal(languageUrl(url.href,'en').pathname,`${prefix}/en/guide/compare/`);
 }
 assert.deepEqual(Object.keys(comparisonPrograms),['signal','addition','names','branch','repeat','function']);
 // No fake cross-language equivalents are offered for replies and message joins.
 assert.equal(comparisonPrograms.reply,undefined);assert.equal(comparisonPrograms.join,undefined);
});
