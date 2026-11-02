import test from 'node:test';
import assert from 'node:assert/strict';
import {course,locales} from '../src/course.js';
import {learningLanes,learningPrerequisites,learningContext,learningSyntax} from '../src/learning-map.js';
import {executeGuide} from '../src/guide.js';
import {parseRoute,routeUrl,languageUrl} from '../src/routing.js';

test('the map covers the exact existing lesson ids once and has no dangling or cyclic dependencies',()=>{
 const ids=course.map(item=>item.id),nodes=learningLanes.flat();assert.deepEqual([...nodes].sort(),[...ids].sort());assert.equal(new Set(nodes).size,nodes.length);assert.deepEqual(Object.keys(learningPrerequisites).sort(),[...ids].sort());assert.deepEqual(Object.keys(learningSyntax).sort(),[...ids].sort());
 const visit=(id,trail=[])=>{assert.ok(ids.includes(id));assert.ok(!trail.includes(id));for(const parent of learningPrerequisites[id])visit(parent,[...trail,id]);};for(const id of ids)visit(id);
});
test('recommendations follow actual foundations without locking or inventing progress',()=>{
 assert.equal(learningContext('coordination').suggested,'signal');
 const completed=course.map(item=>item.id),before=[...completed];assert.equal(learningContext('coordination',completed).suggested,'coordination');assert.deepEqual(completed,before);
 assert.deepEqual(learningContext('function').prerequisites,['names']);assert.ok(!learningContext('reply').ancestors.includes('repeat'));
 assert.ok(learningContext('join').ancestors.includes('message'));assert.throws(()=>learningContext('not-a-lesson'));
});
test('every map example executes the existing program instead of displaying canned logs',()=>{
 for(const item of course){const report=executeGuide(item.source);assert.equal(report.ok,true,item.id);assert.equal(report.result.waiting,0,item.id);assert.deepEqual(report.result.logs,item.logs,item.id);}
});
test('concept map deep links and selected hashes survive language changes on both hosts',()=>{
 for(const [lang]of locales)for(const prefix of ['', '/games/loopuff']){
  const source=`https://example.com${prefix}/zh/guide/map/#coordination`,url=languageUrl(source,lang);
  assert.equal(url.pathname,`${prefix}/${lang}/guide/map/`);assert.equal(url.hash,'#coordination');assert.deepEqual(parseRoute(url.pathname),{locale:lang,view:'map'});assert.equal(routeUrl(source,lang,'map').pathname,url.pathname);
 }
 assert.equal(parseRoute('/zh/guide/map/extra/'),null);
});
