import test from 'node:test';
import assert from 'node:assert/strict';
import { newVault, restoreVault, vaultPuzzle, inspectVault, submitVault, advanceVault, replayVault } from '../src/vault.js';
import { routeUrl, parseRoute, languageUrl } from '../src/routing.js';
import { locales } from '../src/course.js';
import { readFile } from 'node:fs/promises';

test('vault challenge accepts executed solutions across changing clues and all stages',()=>{
  for(const seed of [0,1,42,1024,4294967295]){
    const state=newVault(seed);
    for(let i=0;i<3;i++){
      const puzzle=vaultPuzzle(state.seed,i);
      // Different valid programs are accepted, not just the example's text.
      const literal=puzzle.goal.logs.map(n=>`${n}.log()`).join('\n');
      assert.ok(inspectVault(state,puzzle.example).ok);
      assert.ok(submitVault(state,literal).ok);
      assert.equal(state.stamps.length,i+1);
      if(i<2)assert.ok(advanceVault(state));else assert.equal(advanceVault(state),false);
    }
    const another=replayVault(state,seed+1);
    assert.equal(another.stage,0);assert.deepEqual(another.stamps,[0,1,2]);assert.deepEqual(another.cleared,[]);
    submitVault(another,vaultPuzzle(another.seed,0).example);
    assert.equal(another.stamps.length,3);
  }
});

test('device rejects wrong values, extra signals, invalid code and reversed execution order',()=>{
  const state=newVault(42),p=vaultPuzzle(42,0);
  assert.equal(submitVault(state,'0.log()').ok,false);
  assert.equal(advanceVault(state),false);assert.equal(state.stamps.length,0);
  assert.equal(inspectVault(state,'missing.log()').code,'name');
  assert.equal(inspectVault(state,'alert(1)').code,'name');
  assert.equal(inspectVault(state,`${p.example};0.log()`).ok,false);
  assert.ok(submitVault(state,p.example).ok);advanceVault(state);
  submitVault(state,vaultPuzzle(42,1).example);advanceVault(state);
  const last=vaultPuzzle(42,2),reversed=[...last.goal.logs].reverse().map(n=>`${n}.log()`).join(';');
  const report=submitVault(state,reversed);
  assert.equal(report.ok,false);assert.equal(report.matched,0);assert.equal(state.stamps.length,2);
  assert.ok(submitVault(state,last.example).ok);
});

test('drafts, invalidated results and stamps survive roundtrip without reviving deleted code',()=>{
  let state=newVault(777);
  submitVault(state,vaultPuzzle(777,0).example);
  state=restoreVault(JSON.parse(JSON.stringify(state)),3);
  assert.ok(advanceVault(state));
  state.drafts[1]='';state.edited.push(1);state.submitted=null;
  state=restoreVault(JSON.parse(JSON.stringify(state)),4);
  assert.equal(state.seed,777);assert.equal(state.stage,1);assert.equal(state.drafts[1],'');assert.ok(state.edited.includes(1));assert.equal(state.submitted,null);
  submitVault(state,vaultPuzzle(777,1).example);
  state.drafts[1]='0.log()';
  assert.equal(advanceVault(state),false);
  assert.equal(restoreVault({version:1,seed:1,stage:2,drafts:[],cleared:[]},3).stage,0);
  assert.equal(restoreVault({version:99,seed:1},4).seed,4);
});

test('games have full locale routes, persistent language destinations and complete teaching text',async()=>{
  let baseline;
  for(const [locale]of locales){
    for(const prefix of ['', '/games/loopuff'])for(const [view,suffix]of [['play','play/'],['vault','play/vault/']]){
      const url=routeUrl(`https://example.com${prefix}/en/`,locale,view);
      assert.equal(url.pathname,`${prefix}/${locale}/${suffix}`);
      assert.deepEqual(parseRoute(url.pathname),{locale,view});
      assert.equal(languageUrl(url.href,'en').pathname,`${prefix}/en/${suffix}`);
    }
    const {vault}=JSON.parse(await readFile(new URL(`../public/locales/${locale}.json`,import.meta.url),'utf8'));
    if(!baseline)baseline=Object.keys(vault).sort();assert.deepEqual(Object.keys(vault).sort(),baseline);
    assert.equal(vault.stages.length,3);assert.ok(vault.compare.includes('{expected}'));
    assert.ok(vault.meaning.includes('let')&&vault.meaning.includes('.log()'));
    for(const stage of vault.stages)for(const key of ['title','task','hint','learned'])assert.ok(stage[key]?.trim(),`${locale} ${key}`);
  }
});
