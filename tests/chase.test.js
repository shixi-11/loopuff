import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chaseRoles, chasePuzzle, newChase, restoreChase, inspectChase, submitChase, advanceChase } from '../src/chase.js';
import { locales } from '../src/course.js';
import { routeUrl, languageUrl, parseRoute } from '../src/routing.js';
const code = moves => moves.map(n => `${n}.log()`).join(';');

// Breadth-first exploration finds a route rather than assuming the authored
// examples work. Every district and role must have multiple successful plans.
function solutions(role,stage) {
  let plans=[[]],found=[];
  for(let length=1;length<=8 && found.length<2;length++) {
    const next=[];
    for(const prefix of plans)for(const move of [1,2,3]) {
      const plan=[...prefix,move],r=inspectChase(role,stage,code(plan));
      if(r.ok)found.push(plan);
      else if(r.outcome==='unfinished')next.push(plan);
    }
    plans=next;
  }
  return found;
}
test('both roles can finish all three districts with distinct executed plans',()=>{
  for(const role of chaseRoles) {
    const state=newChase();state.role=role;
    for(let stage=0;stage<3;stage++) {
      const plans=solutions(role,stage);assert.ok(plans.length>=2,`${role}/${stage}`);
      for(const moves of plans.slice(0,2)) {
        const r=inspectChase(role,stage,code(moves));assert.ok(r.ok);
        const f=r.frames.at(-1);
        assert.equal(role==='police'?f.police>=f.thief:f.thief===18,true);
      }
      const binding='let step = 1;'+plans[0].map(n=>`(step + ${n-1}).log()`).join(';');
      assert.ok(submitChase(state,binding).ok);
      assert.equal(state.work[role].cleared.length,stage+1);
      assert.equal(advanceChase(state),stage<2);
    }
    assert.deepEqual(state.work[role==='police'?'thief':'police'].cleared,[]);
  }
});
test('movement follows printed order, roadblock landings, capture and escape priority',()=>{
  const stopped=inspectChase('police',1,'3.log()');
  assert.equal(stopped.frames[0].blocked,true);
  assert.equal(stopped.frames[0].police,0);assert.equal(stopped.frames[0].thief,5);
  const hopped=inspectChase('police',1,'2.log();2.log()');
  assert.equal(hopped.frames[1].police,4);assert.equal(hopped.frames[1].blocked,false);
  const caught=inspectChase('police',0,'3.log();3.log();1.log()');
  assert.equal(caught.outcome,'caught');assert.equal(caught.frames.length,2);
  assert.equal(caught.frames.at(-1).police,caught.frames.at(-1).thief,'capture stops at the interception point');
  const escape=inspectChase('thief',0,code([3,3,3,3,2]));
  assert.ok(escape.ok);assert.equal(escape.frames.at(-1).police,4);
  const a=inspectChase('police',1,code([3,2,3]));
  const b=inspectChase('police',1,code([2,3,3]));
  assert.equal(a.ok,false);assert.equal(b.ok,true);
  assert.equal(inspectChase('police',0,code(Array(8).fill(1))).outcome,'unfinished');
});
test('invalid or oversized plans never move an actor, even after an early winning signal',()=>{
  for(const source of [undefined, null, {}, '', '0.log()', '4.log()', 'missing.log()', 'fetch(1)', 'let x = 1;', code(Array(9).fill(3)), '3.log();3.log();0.log()']) {
    const r=inspectChase('police',0,source);assert.equal(r.ok,false,source);assert.equal(r.frames.length,0,source);
  }
  assert.throws(()=>inspectChase('other',0,'1.log()'));
  assert.throws(()=>chasePuzzle(3));
  const puzzle=chasePuzzle(1);puzzle.blocks.push(18);
  assert.deepEqual(chasePuzzle(1).blocks,[3,7,11]);
});
test('versioned role saves preserve empty drafts, invalidate edited wins and reject stage skips',()=>{
  let state=newChase();const route=solutions('police',0)[0];
  submitChase(state,code(route));state=restoreChase(JSON.parse(JSON.stringify(state)));
  assert.ok(advanceChase(state));state.work.police.drafts[1]='';state.work.police.submitted=null;
  state.role='thief';submitChase(state,code(solutions('thief',0)[0]));
  state=restoreChase(JSON.parse(JSON.stringify(state)));assert.equal(state.role,'thief');
  assert.equal(state.work.police.stage,1);assert.equal(state.work.police.drafts[1],'');
  state.work.thief.drafts[0]='0.log()';state=restoreChase(state);
  assert.equal(state.work.thief.submitted,null);assert.equal(advanceChase(state),false);
  assert.equal(restoreChase({version:1,work:{police:{stage:2,cleared:[2]}}}).work.police.stage,0);
  for(const invalid of [null,[],{version:99},{version:1,role:'oops',work:{police:{drafts:[9],cleared:'bad'}}}]) {
    assert.equal(restoreChase(invalid).role,'police');
  }
});
test('chase routes, language destinations and player instructions cover every locale',async()=>{
  const english=JSON.parse(await readFile(new URL('../public/locales/en.json',import.meta.url),'utf8')).chase;
  for(const [locale] of locales) {
    for(const prefix of ['', '/games/loopuff']) {
      const u=routeUrl(`https://example.com${prefix}/zh/`,locale,'chase');
      assert.equal(u.pathname,`${prefix}/${locale}/play/chase/`);
      assert.deepEqual(parseRoute(u.pathname),{locale,view:'chase'});
      assert.equal(languageUrl(u.href,'en').pathname,`${prefix}/en/play/chase/`);
    }
    const t=JSON.parse(await readFile(new URL(`../public/locales/${locale}.json`,import.meta.url),'utf8')).chase;
    assert.deepEqual(Object.keys(t).sort(),Object.keys(english).sort(),locale);
    for(const key of ['stages','hints','learned'])assert.equal(t[key].length,3,`${locale} ${key}`);
    assert.ok(t.step.includes('{n}')&&t.step.includes('{move}'),locale);
    assert.ok(t.meaning.includes('let')&&t.meaning.includes('.log()'),locale);
  }
});
