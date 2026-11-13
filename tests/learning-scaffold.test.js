import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {learningExamples,learningStage} from '../src/learning-scaffold.js';
import {arcadeLearningIds,inspectArcadeLearning} from '../src/arcade-learning.js';
import {locales} from '../src/course.js';

test('worked examples all execute and demonstrate a different goal without changing assessed task ids',()=>{
 assert.deepEqual(Object.keys(learningExamples),arcadeLearningIds);
 for(const id of arcadeLearningIds){const result=inspectArcadeLearning(id,learningExamples[id]);
  assert.ok(result.cases.length>0,id);assert.ok(!['syntax','name','limit'].includes(result.code),id);
 }
 assert.deepEqual(arcadeLearningIds.map((_,i)=>learningStage(i)),[0,0,0,1,1,1,2,2,2,2,2]);
});

test('every supported language has the complete beginner explanations, not fallback English',()=>{
 const en=JSON.parse(readFileSync(new URL('../public/locales/en.json',import.meta.url))).arcadeLearning.scaffold;
 for(const[locale]of locales){const s=JSON.parse(readFileSync(new URL(`../public/locales/${locale}.json`,import.meta.url))).arcadeLearning.scaffold;
  assert.ok(s,locale);assert.deepEqual(Object.keys(s).sort(),Object.keys(en).sort(),locale);
  assert.equal(s.terms.length,3,locale);assert.equal(s.stages.length,3,locale);assert.deepEqual(Object.keys(s.steps),arcadeLearningIds,locale);
  assert.ok(s.terms[1].text.includes('{run}'),locale+' must use the actual button label');
  for(const id of arcadeLearningIds)for(const field of ['read','predict','reflect'])assert.ok(typeof s.steps[id][field]==='string'&&s.steps[id][field].length>10,`${locale}:${id}:${field}`);
  if(locale!=='en')assert.notEqual(s.foundationIntro,en.foundationIntro,locale);
 }
});
