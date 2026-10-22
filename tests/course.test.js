import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { course, locales } from '../src/course.js';
import { run } from '../src/runner.js';
import { assess } from '../src/assessment.js';
test('eleven complete catalogs cover the same course and controls', async()=>{
  const files=await readdir(new URL('../public/locales/',import.meta.url));
  assert.deepEqual(files.sort(),locales.map(([id])=>id+'.json').sort());
  const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
  const calledKeys=[...source.matchAll(/ui\('([^']+)'\)/g)].map(match=>match[1]);
  let baseline;
  function shape(value){return Array.isArray(value)?value.map(shape):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,shape(value[k])])):typeof value;}
  for(const [id]of locales){
    const data=JSON.parse(await readFile(new URL(`../public/locales/${id}.json`,import.meta.url),'utf8'));
    if(!baseline)baseline=shape(data);assert.deepEqual(shape(data),baseline,id);
    for(const key of calledKeys)assert.ok(data.ui[key],`${id} missing ${key}`);
    assert.equal(data.ui.name,id==='zh'?'环灵':id==='zh-Hant'?'環靈':'Loopuff');
    assert.equal(data.lessons.length,course.length);
    data.lessons.forEach((lesson,index)=>assert.equal(lesson.coach.length,course[index].fragments.length));
    function check(value){if(typeof value==='string')assert.ok(value.trim()&&!/undefined|TODO|TBD/.test(value),id);else if(Array.isArray(value))value.forEach(check);else Object.values(value).forEach(check);}
    check(data);
  }
});
test('all original and modified programs have matching actual output',()=>{
  for(const lesson of course){
    assert.equal(lesson.fragments.join(''),lesson.source);
    assert.deepEqual(run(lesson.source).logs,lesson.logs);
    assert.equal(lesson.remix.template.replace('___',lesson.remix.solution),lesson.remix.source);
    assert.deepEqual(run(lesson.remix.source).logs,lesson.remix.logs);
    assert.ok(assess(lesson.independent.example,lesson.independent).ok);
  }
});
test('assessment accepts distinct solutions and rejects unmet output or concepts',()=>{
  for(const program of ['(4 + 7).log()','(2 + 9).log()','let x = 3; (x + 8).log()'])assert.ok(assess(program,course[1].independent).ok);
  assert.equal(assess('11.log()',course[1].independent).code,'conceptMissing');
  assert.equal(assess('(1 + 2).log()',course[1].independent).code,'goalMismatch');
  assert.equal(assess('let n = 14; 14.log()',course[2].independent).code,'conceptMissing');
  assert.equal(assess('let a = 1; let b = a + 1; 14.log()',course[2].independent).code,'conceptMissing');
  assert.ok(assess('let fuel = 6; (fuel + 8).log()',course[2].independent).ok);
});
