import test from 'node:test';
import assert from 'node:assert/strict';
import {locales} from '../src/course.js';
import {diagnosticIds} from '../src/diagnostic.js';
import {languageUrl} from '../src/routing.js';
import {lessonApplication,diagnosticApplication,nextDiagnosticArea,requestedDispatchMission,dispatchMissionUrl,diagnosticAreaUrl} from '../src/learning-transfer.js';
import {applicationPanel} from '../src/learning-transfer-ui.js';

test('applications follow demonstrated concepts without awarding or inventing completion',()=>{
 for(const [lesson,mission]of Object.entries({branch:'branch',repeat:'manifest',function:'fuel',coordination:'relay'}))assert.equal(lessonApplication(lesson),mission);
 assert.equal(lessonApplication('signal'),null);assert.equal(lessonApplication('join'),null);
 assert.equal(diagnosticApplication('function',[]),null);assert.equal(diagnosticApplication('function',['function']),'fuel');
 assert.equal(diagnosticApplication('names',diagnosticIds),'relay');assert.equal(diagnosticApplication('join',['join']),null);
 assert.throws(()=>lessonApplication('__proto__'));assert.throws(()=>diagnosticApplication('unknown',[]));
});
test('experienced learners move forward or combine checked branch/function/join instead of restarting names',()=>{
 assert.equal(nextDiagnosticArea('function',['function']),'reply');
 assert.equal(nextDiagnosticArea('branch',['branch']),'counter');
 assert.equal(nextDiagnosticArea('join',['join']),'branch');
 assert.equal(nextDiagnosticArea('branch',['join','branch']),'function');
 const checked=['branch','function','join'],before=[...checked];
 assert.equal(nextDiagnosticArea('function',checked),'coordination');assert.deepEqual(checked,before);
 assert.equal(nextDiagnosticArea('counter',['counter','branch','repeat']),'function');
 assert.equal(nextDiagnosticArea('coordination',diagnosticIds),null);
});
test('an explicit application mission survives language and both hosts without stale lesson or diagnostic parameters',()=>{
 for(const [locale]of locales)for(const prefix of ['', '/games/loopuff']){
  const input=`https://example.com${prefix}/zh/guide/check/?area=function&practice=rewrite&return=diagnostic&mode=lab#old`;
  const url=dispatchMissionUrl(input,locale,'fuel');
  assert.equal(url.pathname,`${prefix}/${locale}/play/dispatch/`);assert.equal(url.search,'?mission=fuel');assert.equal(url.hash,'');
  assert.equal(requestedDispatchMission(languageUrl(url.href,'ar')),'fuel');
  const back=diagnosticAreaUrl(url.href,locale,'join');assert.equal(back.pathname,`${prefix}/${locale}/guide/check/`);assert.equal(back.search,'?area=join');assert.equal(languageUrl(back.href,'ar').search,'?area=join');
 }
 assert.equal(requestedDispatchMission('https://example.com/zh/play/dispatch/?mission=unknown'),null);
 assert.equal(requestedDispatchMission('https://example.com/zh/play/dispatch/'),null);
 assert.throws(()=>dispatchMissionUrl('https://example.com/zh/','zh','__proto__'));
 assert.throws(()=>diagnosticAreaUrl('https://example.com/zh/','zh','unknown'));
});

test('application protocols isolate code identifiers and escape visitor-facing content',()=>{
 const html=applicationPanel('fuel',{text:{title:'Use <it>',lesson:'Keep "this" draft.',apply:'Try {mission}',protocols:{fuel:'Define fuel and use cargo < reserve.'}},titles:['branch','manifest','Fuel<script>','relay'],context:'lesson',href:'/zh/play/dispatch/?mission=fuel&from=lesson'});
 assert.ok(!html.includes('<script>'));assert.ok(html.includes('Fuel&lt;script&gt;'));assert.ok(html.includes('<bdi dir="ltr">fuel</bdi>'));assert.ok(html.includes(' &lt; '));assert.ok(html.includes('&amp;from=lesson'));
});
