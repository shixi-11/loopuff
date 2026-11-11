import {course} from './course.js';
import {learningLanes} from './learning-map.js';
import {startStepIds,startWorkKey} from './guide-work.js';
import {startSteps,startSource,startProgress,editStart,checkStart,inspectStartStep,advanceProgress} from './learning-paths.js';
import {diagnosticIds} from './diagnostic.js';
import {dispatchIds} from './dispatch.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const prose=value=>String(value).split(/(if obstacle < 4 then \{ \.\.\. \} else \{ \.\.\. \}|let energy = 10|\d+\.log\(\)|\.log\(\)|\bobstacle\b|\benergy\b)/g).map((part,index)=>index%2?`<bdi dir="ltr">${esc(part)}</bdi>`:esc(part)).join('');

export function pathEntrances(t,urls){return `<section class="path-entrances" aria-labelledby="path-choice"><h2 id="path-choice">${esc(t.choose)}</h2><div>${[['start','beginnerTitle','beginnerIntro','enterStart'],['advance','advancedTitle','advancedIntro','enterAdvance']].map(([view,title,intro,action])=>`<article><h3>${esc(t[title])}</h3><p>${esc(t[intro])}</p><a class="${view==='start'?'primary':'text-button'}" data-action="open-${view}" href="${esc(urls[view])}">${esc(t[action])} ↗</a></article>`).join('')}</div></section>`;}
const trail=(t,urls,title)=>`<nav class="page-trail"><a data-action="open-guide" href="${esc(urls.guide)}">${esc(t.backGuide)}</a><span aria-hidden="true">/</span><span>${esc(title)}</span></nav>`;

export function mountStartPath(root,{text:t,beginner,guideText,errors,concepts,model,initialStep,completed,lessons,urls,onSelect,onChange}){
 const work=model.drafts,verified=new Set(startProgress(work));
 let id=startStepIds.includes(initialStep)?initialStep:startStepIds[0],report=null,caseIndex=0,hints=false,resetArmed=false,disposed=false,paintedReport,paintedCase,paintedId;
 const el=selector=>root.querySelector(selector),task=()=>startSteps.find(item=>item.id===id),copy=()=>t.steps[id],source=()=>startSource(work,id);
 function persist(){
  const token=model.startSaveToken=(model.startSaveToken||0)+1;model.startSaving=true;model.startSaveFailed=false;
  let saved;try{saved=onChange();}catch{saved=false;}
  model.startSavePromise=Promise.resolve(saved).then(ok=>{if(model.startSaveToken!==token)return;model.startSaving=false;model.startSaveFailed=ok===false;if(!disposed)paint();},()=>{if(model.startSaveToken!==token)return;model.startSaving=false;model.startSaveFailed=true;if(!disposed)paint();});
 }
 function render(){
  paintedId=null;
  const checked=work[startWorkKey(id,true)];report=typeof checked==='string'&&checked===source()?inspectStartStep(id,source()):null;caseIndex=0;hints=false;resetArmed=false;
  const meaning=id==='repair'?t.repairHelp:beginner.concepts[({run:'signal',change:'signal',calculate:'addition',name:'names',decide:'branch'})[id]].read;
  root.innerHTML=`${trail(t,urls,t.beginnerTitle)}<section class="learning-path"><header class="path-heading"><h1 id="learning-title">${esc(t.beginnerTitle)}</h1><p>${esc(t.startIntro)}</p><a data-action="open-advance" href="${esc(urls.advance)}">${esc(t.advancedTitle)} ↗</a></header><label class="path-step-label" for="start-step">${esc(t.step)} <bdi dir="ltr">${startStepIds.indexOf(id)+1} / ${startStepIds.length}</bdi></label><select id="start-step"></select><div class="path-workbench"><section><h2>${esc(copy().title)}</h2><p>${prose(copy().goal)}</p><form id="start-form"><label for="start-editor">${esc(t.editor)}</label><textarea id="start-editor" dir="ltr" rows="${Math.max(3,Math.min(8,source().split('\n').length+1))}" maxlength="4096" spellcheck="false" autocapitalize="off" autocomplete="off">${esc(source())}</textarea><div class="path-actions"><button type="submit" class="primary">${esc(t.run)} ▶</button><button type="button" class="text-button" data-start="hint" aria-controls="start-hint" aria-expanded="false">${esc(t.hint)}</button></div></form><p id="start-hint" hidden>${prose(copy().hint)}</p><details class="path-reading"${id==='run'?' open':''}><summary>${esc(t.read)}</summary><p>${prose(meaning)}</p></details><div class="path-reset"><button type="button" class="text-button" data-start="reset">${esc(t.reset)}</button><button type="button" class="text-button" data-start="cancel" hidden>${esc(t.cancelReset)}</button><p data-start-reset hidden>${esc(t.resetNote)}</p></div></section><section class="path-observation" aria-label="${esc(t.actual)}"><div data-start-result></div><p data-start-status role="status" aria-live="polite"></p><p data-start-save role="status"></p><button type="button" class="primary" data-start="next" hidden>${esc(t.next)} →</button><p data-start-finished hidden>${esc(t.allStartDone)}</p></section></div><section class="path-course"><h2>${esc(t.courseRoad)}</h2><p>${esc(t.courseIntro)}</p>${learningLanes.map((lane,index)=>`<details${index===0?' open':''}><summary>${esc(t.lanes[index])}</summary><ol>${lane.map(key=>{const item=lessons[course.findIndex(lesson=>lesson.id===key)];return `<li><div><strong>${esc(item.title)}</strong><p>${esc(item.goal)}</p></div><a href="${esc(urls.lesson(key))}">${esc(completed.includes(key)?t.verified:t.continueCourse)} ↗</a></li>`;}).join('')}</ol></details>`).join('')}</section></section>`;
  paint();
 }
 function paint(){
  el('#start-step').innerHTML=startStepIds.map((key,index)=>`<option value="${key}"${key===id?' selected':''}>${index+1}. ${esc(t.steps[key].title)} · ${esc(verified.has(key)?t.verified:t.notVerified)}</option>`).join('');
  el('#start-hint').hidden=!hints;el('[data-start="hint"]').setAttribute('aria-expanded',String(hints));
  el('[data-start="reset"]').textContent=resetArmed?t.confirmReset:t.reset;el('[data-start="cancel"]').hidden=!resetArmed;el('[data-start-reset]').hidden=!resetArmed;
  const item=report?.cases[caseIndex],logs=item?.result?.logs,output=item?.outputs?.[0],program=source();
  const observed=!report?t.notRun:!item?.result?errors[item?.code==='name'?'nameError':item?.code]||errors.syntax:logs.length?logs.join(' → '):guideText.noOutput;
  const caseSelect=task().inputs?`<label for="start-case">${esc(t.case)}</label><select id="start-case">${task().inputs.map((value,index)=>`<option value="${index}"${index===caseIndex?' selected':''}>obstacle = ${value}</option>`).join('')}</select>`:'';
  const expected=task().inputs?[task().inputs[caseIndex]<4?'3':'1']:task().logs;
  if(paintedId!==id||paintedReport!==report||paintedCase!==caseIndex){
   el('[data-start-result]').innerHTML=`${caseSelect}<dl><div><dt>${esc(t.expected)}</dt><dd dir="ltr">${esc(expected.join(' → '))}</dd></div><div><dt>${esc(t.actual)}</dt><dd class="${item?.result&&logs.length?'path-output':'path-message'}"${item?.result?' dir="ltr"':''}>${esc(observed)}</dd></div></dl>${output?`<p>${esc(t.executed)}</p><pre dir="ltr"><mark>${esc(program.slice(output.start,output.end))}</mark></pre>`:''}`;
   paintedId=id;paintedReport=report;paintedCase=caseIndex;
  }
  const missing=item?.code==='conceptMissing'?(item.checks.find(check=>check.id==='concepts')?.requirements||[]).filter(requirement=>!requirement.passed).map(requirement=>concepts[requirement.concept]).join(' · '):'';
  el('[data-start-status]').textContent=!report?'':report.ok?t.passed:`${t.needsWork}${item?.code==='waiting'?' '+errors.waiting:''}${missing?' · '+missing:''}${!item?.result&&item?.code==='syntax'?' '+(item.position+1):''}`;
  el('[data-start-save]').textContent=model.startSaveFailed?errors.nosave:'';
  const last=id===startStepIds.at(-1);el('[data-start="next"]').hidden=last||!report?.ok;el('[data-start="next"]').disabled=!!model.startSaving||!!model.startSaveFailed;
  el('[data-start-finished]').hidden=!last||!report?.ok||verified.size!==startStepIds.length;
 }
 function input(event){if(event.target.id!=='start-editor')return;editStart(work,id,event.target.value);verified.delete(id);report=null;resetArmed=false;persist();paint();}
 function change(event){
  if(event.target.id==='start-step'&&startStepIds.includes(event.target.value)){id=event.target.value;onSelect(id);render();el('#start-editor').focus({preventScroll:true});}
  if(event.target.id==='start-case'){caseIndex=Math.max(0,Math.min(task().inputs.length-1,Number(event.target.value)||0));paint();el('#start-case').focus({preventScroll:true});}
 }
 function submit(event){if(event.target.id!=='start-form')return;event.preventDefault();report=checkStart(work,id);if(report.ok){verified.add(id);hints=false;}else verified.delete(id);caseIndex=Math.max(0,report.cases.findIndex(item=>!item.ok));persist();paint();}
 function click(event){
  const action=event.target.closest('[data-start]')?.dataset.start;if(!action)return;
  if(action==='hint'){hints=!hints;paint();}
  if(action==='cancel'){resetArmed=false;paint();el('[data-start="reset"]').focus({preventScroll:true});}
  if(action==='reset'){
   if(source()!==task().starter&&!resetArmed){resetArmed=true;paint();return;}
   editStart(work,id,task().starter);verified.delete(id);report=null;persist();render();el('#start-editor').focus();
  }
  if(action==='next'&&report?.ok&&!model.startSaving&&!model.startSaveFailed){const next=startStepIds[startStepIds.indexOf(id)+1];if(next){id=next;onSelect(id);render();el('#start-editor').focus({preventScroll:true});el('#learning-title').scrollIntoView({block:'start',behavior:'instant'});}}
 }
 root.addEventListener('input',input);root.addEventListener('change',change);root.addEventListener('submit',submit);root.addEventListener('click',click);render();
 model.startSavePromise?.then(()=>{if(!disposed)paint();});
 return {dispose(){disposed=true;root.removeEventListener('input',input);root.removeEventListener('change',change);root.removeEventListener('submit',submit);root.removeEventListener('click',click);}};
}

export function mountAdvancePath(root,{text:t,diagnosticText,dispatchText,diagnostic,dispatch,urls}){
 const progress=advanceProgress(diagnostic,dispatch),next=progress.next||'coordination',project=dispatchIds.find(id=>!progress.projects.includes(id))||'relay';
 root.innerHTML=`${trail(t,urls,t.advancedTitle)}<section class="learning-path"><header class="path-heading"><h1 id="learning-title">${esc(t.advancedTitle)}</h1><p>${esc(t.advanceGoal)}</p><a data-action="open-start" href="${esc(urls.start)}">${esc(t.beginnerTitle)} ↗</a></header>${progress.bad?`<p role="status">${esc(t.badSave)} <a data-action="open-saves" href="${esc(urls.saves)}">${esc(urls.saveLabel)} ↗</a></p>`:''}<section class="path-recommendation"><span>${esc(t.recommend)}</span><h2>${esc(progress.next?diagnosticText.tasks[next].title:dispatchText.missions[dispatchIds.indexOf(project)].title)}</h2><a class="primary" href="${esc(progress.next?urls.diagnostic(next):urls.project(project))}">${esc(progress.next?t.checkTask:t.applyTask)} →</a></section><section class="path-course"><h2>${esc(t.diagnosticRoad)}</h2><p>${esc(t.diagnosticIntro)}</p><ol>${diagnosticIds.map(id=>`<li><div><strong>${esc(diagnosticText.tasks[id].title)}</strong><p>${esc(diagnosticText.tasks[id].goal)}</p><small>${esc(progress.passed.includes(id)?t.verified:t.notVerified)}</small></div><div><a href="${esc(urls.diagnostic(id))}">${esc(t.checkTask)} ↗</a><a href="${esc(urls.compare)}">${esc(urls.compareLabel)} ↗</a></div></li>`).join('')}</ol></section><section class="path-course"><h2>${esc(t.projectRoad)}</h2><p>${esc(t.projectIntro)}</p><ol>${dispatchIds.map((id,index)=>`<li><div><strong>${esc(dispatchText.missions[index].title)}</strong><p>${esc(dispatchText.missions[index].brief)}</p><small>${esc(progress.projects.includes(id)?t.verified:t.notVerified)}</small></div><a href="${esc(urls.project(id))}">${esc(t.applyTask)} ↗</a></li>`).join('')}</ol></section></section>`;
 return {dispose(){}};
}
