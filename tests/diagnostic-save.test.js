import test from 'node:test';
import assert from 'node:assert/strict';
import {newDiagnostic,diagnosticPuzzle,submitDiagnostic,editDiagnostic} from '../src/diagnostic.js';
import {emptySave,parseSave} from '../server/save-format.mjs';
import {createMergePlan,resolveMerge} from '../src/save-merge.js';

test('diagnostics round-trip as optional course work while legacy files stay unchanged',()=>{
 const old={format:'loopuff-save',version:1,data:{course:{lang:'zh',state:{completed:['signal'],guideWork:{signal:'9.log()'}}},vault:null,chase:null,dispatch:null}};
 const restored=parseSave(JSON.stringify(old));assert.equal(Object.hasOwn(restored.data.course.state,'diagnostic'),false);
 const value=emptySave();value.data.course={state:{completed:['signal'],diagnostic:newDiagnostic(42)}};submitDiagnostic(value.data.course.state.diagnostic,'names',diagnosticPuzzle(42,'names').example);
 assert.deepEqual(parseSave(JSON.stringify(value)),value);
 assert.deepEqual(resolveMerge(createMergePlan(value,old)).data.course.state.diagnostic,value.data.course.state.diagnostic);
 const bad=structuredClone(value);bad.data.course.state.diagnostic.passed=['names'];assert.throws(()=>parseSave(JSON.stringify(bad)));
});
test('same input conflicts select the complete draft, invalidation and hint record even for equal text',()=>{
 const a=emptySave(),b=emptySave();a.data.course={state:{diagnostic:newDiagnostic(42)}};b.data.course=structuredClone(a.data.course);
 const source=diagnosticPuzzle(42,'names').example;submitDiagnostic(a.data.course.state.diagnostic,'names',source);editDiagnostic(b.data.course.state.diagnostic,'names',source);b.data.course.state.diagnostic.hints.names=2;
 const plan=createMergePlan(a,b),issue=plan.conflicts.find(c=>c.kind==='diagnostic-task');assert.ok(issue);assert.equal(issue.item,'names');
 const incoming=resolveMerge(plan,{[issue.id]:'incoming'}).data.course.state.diagnostic;assert.equal(incoming.submitted.names,null);assert.equal(incoming.hints.names,2);assert.equal(incoming.drafts.names,source);
 const local=resolveMerge(plan,{[issue.id]:'local'}).data.course.state.diagnostic;assert.equal(local.submitted.names,source);assert.equal(local.hints.names,0);
});
test('different input sets choose a whole diagnostic run without mixing clocks, submissions or hints',()=>{
 const a=emptySave(),b=emptySave();a.data.course={state:{diagnostic:newDiagnostic(42)}};b.data.course={state:{diagnostic:newDiagnostic(43)}};
 b.data.course.state.diagnostic.hints.reply=2;const p=createMergePlan(a,b);assert.equal(p.conflicts.length,1);assert.equal(p.conflicts[0].kind,'diagnostic-run');
 for(const side of ['local','incoming'])assert.deepEqual(resolveMerge(p,{[p.conflicts[0].id]:side}).data.course.state.diagnostic,(side==='local'?a:b).data.course.state.diagnostic);
});
