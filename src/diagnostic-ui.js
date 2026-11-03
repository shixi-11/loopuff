import {diagnosticIds,diagnosticSourceLimit,normalizeDiagnostic,newDiagnostic,diagnosticPuzzle,diagnosticLessons,inspectDiagnostic,editDiagnostic,submitDiagnostic,requestDiagnosticHint,nextDiagnostic} from './diagnostic.js';
import {aircraftUrl} from './plane.js';
import {course} from './course.js';
import {diagnosticFeedback} from './diagnostic-feedback.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const code=source=>`<pre dir="ltr">${esc(source)}</pre>`;
const freshSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
const outlines={
 names:'(cargo + ___).log()',branch:'if fuel > ___ then {\n  ___.log()\n} else {\n  ___.log()\n}',
 repeat:'for dock in docks {\n  (dock + ___).log()\n}',counter:'let count = 0;\nwhile count < ___ {\n  count.log();\n  count = ___\n}',
 function:'sync fn combine(a, b) {\n  return ___\n}',reply:'fn boost(a, b) {\n  return ! ___\n}',
 message:'?(value <- mailbox) {\n  (___ + 1).log()\n}',join:'?(a <- west & b <- east) {\n  (___ + ___).log()\n}',
 coordination:'sync fn total(a, b) { return ___ };\n?(a <- west & b <- east) {\n  let load = total(___, ___);\n  if load > ___ then {\n    (load + ___).log()\n  } else { load.log() }\n}'
};
export function mountDiagnostic(root,{text:t,feedbackText:f,ui,errors,concepts,statuses,lessons,initial,model,urls,onChange=()=>true,reduced={matches:false}}){
 let disposed=false,timer=null,busy=null,caseIndex=0,outputIndex=0,resetArmed=false,saveSerial=0,saveFailed=false;
 if(!model.initialized||model.state!==initial){
  model.initialized=true;model.reports={};model.bad=false;
  try{model.state=initial===undefined?newDiagnostic(freshSeed()):normalizeDiagnostic(initial);}catch{model.state=initial;model.bad=true;}
 }
 const state=()=>model.state,id=()=>state().selected,puzzle=()=>diagnosticPuzzle(state().seed,id());
 function clearView(){model.viewSeed=state().seed;model.caseSelection={};model.hintsOpen={};}
 if(!model.bad&&model.viewSeed!==state().seed)clearView();
 const cached=area=>{const r=model.reports[area];return r&&r.seed===state().seed&&r.source===state().drafts[area]&&state().submitted[area]===r.source?r.report:null;};
 const selectedCase=area=>model.caseSelection[area]??Math.max(0,cached(area)?.cases.findIndex(item=>!item.ok)??0);
 const status=area=>busy===area?t.checking:cached(area)?cached(area).ok?t.passed:t.needsWork:state().submitted[area]!==null?t.reviewing:t.pending;
 const cancel=()=>{clearTimeout(timer);timer=null;busy=null;};
 async function persist(){
  const serial=++saveSerial;let ok=false;try{ok=await onChange(state())!==false;}catch{}
  if(disposed||serial!==saveSerial)return;saveFailed=!ok;const note=root.querySelector('[data-diagnostic-save]');if(note)note.textContent=saveFailed?t.saveFailed:'';
 }
 function reviewSaved(){
  if(disposed||model.bad||timer!==null)return;
  const area=diagnosticIds.find(key=>state().submitted[key]!==null&&!cached(key));if(!area)return;
  const snapshot=state(),source=snapshot.drafts[area];
  timer=setTimeout(()=>{timer=null;if(disposed||snapshot!==state()||snapshot.submitted[area]!==source||snapshot.drafts[area]!==source)return reviewSaved();
   model.reports[area]={seed:snapshot.seed,source,report:inspectDiagnostic(snapshot.seed,area,source)};if(area===id())caseIndex=selectedCase(area);paint();reviewSaved();
  },0);
 }
 function caseTitle(index){return t.caseLabel.replace('{number}',index+1);}
 function inspector(){
  const p=puzzle(),sample=p.cases[caseIndex],report=cached(id()),current=report?.cases[caseIndex],logs=current?.result?.logs||[];
  const inputs=sample.inputCode||sample.prefix.trim();
  outputIndex=Math.min(outputIndex,Math.max(0,logs.length-1));const output=current?.outputs[outputIndex],source=state().drafts[id()];
  const requirements=current?.checks.find(check=>check.id==='concepts')?.requirements||[];
  const errorKey=current?.result?.waiting?'waiting':current?.code==='name'?'nameError':current?.code;
  const error=current&&!current.ok?(t[errorKey]||errors[errorKey]||errors.limit):'';
  return `<header class="diagnostic-case-head"><h2>${esc(caseTitle(caseIndex))}</h2><span data-state="${current?current.ok?'pass':'fail':'idle'}">${esc(current?current.ok?t.passed:t.needsWork:t.pending)}</span></header>
   <section class="diagnostic-input"><h3>${esc(t.input)}</h3>${code(inputs)}</section>
   <div class="diagnostic-flow" aria-hidden="true"><span>→</span><img src="${aircraftUrl}" alt=""><span>→</span></div>
   <div class="diagnostic-outputs"><section><h3>${esc(t.expected)}</h3>${code(sample.logs.join('\n')||t.noOutput)}</section><section><h3>${esc(t.actual)}</h3>${code(current?logs.join('\n')||t.noOutput:t.notRun)}</section></div>
   ${error?`<p class="diagnostic-error">${esc(error)}${current.code==='syntax'?` <span>${esc(t.position)} <bdi dir="ltr">${current.position+1}</bdi></span>`:''}</p>`:''}
   ${requirements.length?`<section class="diagnostic-methods"><h3>${esc(t.criteria)}</h3><ul>${requirements.map(item=>`<li><span aria-hidden="true">${item.passed?'✓':'○'}</span><span class="sr-only">${esc(item.passed?statuses.pass:statuses.fail)}: </span>${esc(concepts[item.concept])}</li>`).join('')}</ul></section>`:''}
   ${logs.length?`<details class="diagnostic-source"><summary>${esc(t.source)}</summary><div class="diagnostic-output-choices" role="group" aria-label="${esc(t.frame)}">${logs.map((value,index)=>`<button type="button" data-diagnostic-output="${index}" aria-pressed="${index===outputIndex}">${esc(value)}</button>`).join('')}</div>${output?.start===null?`<p>${esc(t.hostOutput)}</p>${code(output.source)}`:output?`<pre dir="ltr">${esc(source.slice(0,output.start))}<mark>${esc(source.slice(output.start,output.end))}</mark>${esc(source.slice(output.end))}</pre>`:''}</details>`:''}`;
 }
 function result(){
  const report=cached(id()),pending=state().submitted[id()]!==null&&!report;
  return `<p class="diagnostic-verdict" data-ok="${report?.ok??''}">${esc(busy===id()?t.checking:pending?t.reviewing:report?report.ok?t.allPassed:t.partial:t.ready)}${report?` <strong><bdi>${esc(t.caseResult.replace('{passed}',report.passed).replace('{total}',report.total))}</bdi></strong>`:''}</p>`;
 }
 function hints(){
  const level=state().hints[id()],passed=cached(id())?.ok,open=!passed||model.hintsOpen[id()]===true,toggle=passed&&level>0;
  return `${level&&open?`<aside class="diagnostic-hint"><h3>${esc(t.hintLabel)}</h3><p>${esc(t.tasks[id()].hint)}</p>${level===2?`${code(outlines[id()])}<p>${esc(t.hintFill)}</p>`:''}</aside>`:''}<button type="button" class="text-button" data-diagnostic-action="${toggle?'toggle-hints':'hint'}"${toggle?` aria-expanded="${open}"`:level===2?' disabled':''}>${esc(toggle?open?f.hideHints:f.showHints:level?t.moreHint:t.hint)}</button>`;
 }
 function progress(){
  const checked=diagnosticIds.filter(area=>cached(area)),passed=checked.filter(area=>cached(area).ok);
  return `<span>${esc(t.checked.replace('{number}',checked.length))}</span><span>${esc(t.passedCount.replace('{number}',passed.length))}</span>`;
 }
 function next(){
  const report=cached(id()),feedback=diagnosticFeedback(id(),report,state().drafts[id()]),lesson=feedback.lesson,lessonTitle=lessons[lesson].title;
  const next=diagnosticIds.find(area=>area!==id()&&!cached(area)?.ok);
  const guided=report&&!report.ok&&state().drafts[id()].trim(),reason=f.reasons[feedback.reason].replace('{concept}',concepts[feedback.concept]||'');
  return `<section class="diagnostic-guidance"><h3>${esc(f.title)}</h3><p>${esc(reason)}</p>${feedback.caseIndex!==null?`<p>${esc(f.case.replace('{number}',feedback.caseIndex+1))}${caseIndex!==feedback.caseIndex?` <button type="button" class="text-button" data-diagnostic-action="feedback-case">${esc(f.seeCase)}</button>`:''}</p>`:''}${!report?.ok?`<p>${esc(t.recommend.replace('{lesson}',lessonTitle))}</p>`:''}<div class="diagnostic-links"><a data-lesson="${course.findIndex(item=>item.id===lesson)}" data-diagnostic-return="true"${guided?' data-practice="rewrite"':''} href="${urls.lesson(lesson)}?${guided?'practice=rewrite&':''}return=diagnostic">${esc(t.learn)} ↗</a><a data-lesson="${course.findIndex(item=>item.id===diagnosticLessons[id()].at(-1))}" data-diagnostic-return="true" data-practice="true" href="${urls.lesson(diagnosticLessons[id()].at(-1))}?practice=independent&return=diagnostic">${esc(t.independent)} ↗</a></div>${report?.ok&&next?`<div class="diagnostic-next"><span>${esc(t.next.replace('{topic}',t.tasks[next].title))}</span><button class="text-button" type="button" data-diagnostic-area="${next}">${esc(t.nextAction)} →</button></div>`:''}</section>`;
 }
 function paint(){
  if(disposed||model.bad)return;
  for(const button of root.querySelectorAll('[data-diagnostic-area]')){const area=button.dataset.diagnosticArea;if(button.querySelector('small'))button.querySelector('small').textContent=status(area);}
  root.querySelector('[data-diagnostic-progress]').innerHTML=progress();
  root.querySelector('[data-diagnostic-inspector]').innerHTML=inspector();root.querySelector('[data-diagnostic-result]').innerHTML=result();root.querySelector('[data-diagnostic-next]').innerHTML=next();
  root.querySelector('[data-diagnostic-hints]').innerHTML=hints();
  root.querySelector('[data-diagnostic-submit]').disabled=busy!==null;
  for(const button of root.querySelectorAll('[data-diagnostic-case]')){const index=Number(button.dataset.diagnosticCase),current=cached(id())?.cases[index];button.dataset.state=current?current.ok?'pass':'fail':'idle';button.setAttribute('aria-pressed',String(index===caseIndex));button.setAttribute('aria-label',caseTitle(index)+' · '+(current?current.ok?t.passed:t.needsWork:t.pending));}
 }
 function render(){
  const trail=`<nav class="page-trail" aria-label="${esc(ui.navigation)}"><a href="${urls.home}" data-action="home">${esc(ui.navHome)}</a><span aria-hidden="true">/</span><a href="${urls.guide}" data-action="open-guide">${esc(ui.navGuide)}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(t.title)}</span></nav>`;
  if(model.bad){root.innerHTML=`${trail}<section class="diagnostic-page"><h1 id="learning-title">${esc(t.title)}</h1><p>${esc(t.badSave)}</p><a href="${urls.saves}" data-action="open-saves">${esc(t.saveTitle)} ↗</a><div><button type="button" class="text-button" data-diagnostic-action="reset-bad">${esc(resetArmed?t.confirmBad:t.resetBad)}</button></div></section>`;return;}
  const area=id(),copy=t.tasks[area],source=state().drafts[area];caseIndex=selectedCase(area);
  root.innerHTML=`${trail}<section class="diagnostic-page"><header class="diagnostic-heading"><div><span class="eyebrow">${esc(t.tag)}</span><h1 id="learning-title">${esc(t.title)}</h1><p>${esc(t.intro)}</p></div><a href="${urls.map}" class="guide-crosslink" data-action="open-map">${esc(t.map)} ↗</a></header>
   <div class="diagnostic-progress" data-diagnostic-progress>${progress()}</div><nav class="diagnostic-areas" aria-label="${esc(t.areas)}">${diagnosticIds.map((key,index)=>`<button type="button" data-diagnostic-area="${key}" aria-pressed="${key===area}"><span>${String(index+1).padStart(2,'0')}</span><strong>${esc(t.tasks[key].title)}</strong><small>${esc(status(key))}</small></button>`).join('')}</nav>
   <div class="diagnostic-workspace"><section class="diagnostic-editor"><header><h2>${esc(copy.title)}</h2><p>${esc(copy.goal)}</p><p class="diagnostic-context">${esc(copy.context)}</p></header><form data-diagnostic-form><label for="diagnostic-editor">${esc(t.editor)}</label><textarea id="diagnostic-editor" dir="ltr" rows="8" maxlength="${diagnosticSourceLimit}" spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby="diagnostic-result">${esc(source)}</textarea><div class="diagnostic-run"><button type="submit" class="primary" data-diagnostic-submit>${esc(t.run)} ▶</button><span data-diagnostic-hints-status>${esc(state().hints[area]?t.withHints:t.withoutHints)}</span></div></form><div id="diagnostic-result" data-diagnostic-result role="status" aria-live="polite">${result()}</div><div data-diagnostic-next class="diagnostic-recommendation">${next()}</div><div data-diagnostic-hints>${hints()}</div></section>
   <section class="diagnostic-observation" aria-label="${esc(t.cases)}"><div class="diagnostic-cases" role="group" aria-label="${esc(t.cases)}">${puzzle().cases.map((_,index)=>`<button type="button" data-diagnostic-case="${index}" aria-pressed="${index===caseIndex}" aria-label="${esc(caseTitle(index))}">${index+1}</button>`).join('')}</div><div data-diagnostic-inspector>${inspector()}</div></section></div>
   <footer class="diagnostic-footer"><div><button type="button" class="text-button" data-diagnostic-action="new-set">${esc(t.newSet)} ↻</button><p>${esc(t.newSetNote)}</p></div><a href="${urls.saves}" data-action="open-saves">${esc(t.saveTitle)} ↗</a><p data-diagnostic-save role="status">${esc(saveFailed?t.saveFailed:'')}</p></footer><p class="diagnostic-scope">${esc(t.scope)}</p></section>`;
  paint();
 }
 function click(event){
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.diagnosticAction==='reset-bad'){
   if(!resetArmed){resetArmed=true;render();root.querySelector('[data-diagnostic-action="reset-bad"]').focus();return;}
   model.state=newDiagnostic(freshSeed());model.reports={};model.bad=false;clearView();persist();render();root.querySelector('#diagnostic-editor').focus();return;
  }
  if(model.bad)return;
  const area=button.dataset.diagnosticArea;
  if(area){cancel();state().selected=area;outputIndex=0;persist();render();reviewSaved();root.querySelector(`[data-diagnostic-area="${area}"]`).focus({preventScroll:true});return;}
  if(button.dataset.diagnosticCase!==undefined){caseIndex=Number(button.dataset.diagnosticCase);model.caseSelection[id()]=caseIndex;outputIndex=0;paint();root.querySelector(`[data-diagnostic-case="${caseIndex}"]`).focus({preventScroll:true});return;}
  if(button.dataset.diagnosticOutput!==undefined){outputIndex=Number(button.dataset.diagnosticOutput);paint();const details=root.querySelector('.diagnostic-source');if(details)details.open=true;root.querySelector(`[data-diagnostic-output="${outputIndex}"]`)?.focus({preventScroll:true});return;}
  if(button.dataset.diagnosticAction==='hint'){requestDiagnosticHint(state(),id());model.hintsOpen[id()]=true;persist();root.querySelector('[data-diagnostic-hints]').innerHTML=hints();root.querySelector('[data-diagnostic-hints-status]').textContent=t.withHints;const hint=root.querySelector('.diagnostic-hint');hint.tabIndex=-1;hint.focus({preventScroll:true});return;}
  if(button.dataset.diagnosticAction==='toggle-hints'){model.hintsOpen[id()]=!model.hintsOpen[id()];root.querySelector('[data-diagnostic-hints]').innerHTML=hints();root.querySelector('[data-diagnostic-action="toggle-hints"]').focus({preventScroll:true});return;}
  if(button.dataset.diagnosticAction==='feedback-case'){const suggested=diagnosticFeedback(id(),cached(id()),state().drafts[id()]).caseIndex;if(suggested!==null){caseIndex=suggested;model.caseSelection[id()]=caseIndex;outputIndex=0;paint();root.querySelector(`[data-diagnostic-case="${caseIndex}"]`).focus({preventScroll:true});root.querySelector('[data-diagnostic-inspector]').scrollIntoView({block:'start',behavior:reduced.matches?'instant':'smooth'});}return;}
  if(button.dataset.diagnosticAction==='new-set'){cancel();model.state=nextDiagnostic(state(),freshSeed());model.reports={};clearView();caseIndex=0;outputIndex=0;persist();render();root.querySelector('[data-diagnostic-action="new-set"]').focus({preventScroll:true});}
 }
 function input(event){if(event.target.id!=='diagnostic-editor')return;cancel();editDiagnostic(state(),id(),event.target.value);delete model.reports[id()];outputIndex=0;persist();paint();reviewSaved();}
 function submit(event){
  if(!event.target.matches('[data-diagnostic-form]'))return;event.preventDefault();cancel();const snapshot=state(),area=id(),source=root.querySelector('#diagnostic-editor').value;
  editDiagnostic(snapshot,area,source);delete model.reports[area];busy=area;paint();
  timer=setTimeout(()=>{timer=null;if(disposed||snapshot!==state()||snapshot.drafts[area]!==source)return;const report=submitDiagnostic(snapshot,area,source);model.reports[area]={seed:snapshot.seed,source,report};busy=null;
   const firstFailure=report.cases.findIndex(item=>!item.ok);caseIndex=Math.max(0,firstFailure);model.caseSelection[area]=caseIndex;if(report.ok)model.hintsOpen[area]=false;outputIndex=0;persist();paint();reviewSaved();
   if(matchMedia('(max-width:700px)').matches)root.querySelector('[data-diagnostic-result]').scrollIntoView({block:'center',behavior:reduced.matches?'instant':'smooth'});
  },0);
 }
 root.addEventListener('click',click);root.addEventListener('input',input);root.addEventListener('submit',submit);render();
 if(!model.bad){persist();reviewSaved();}
 return {dispose(){disposed=true;cancel();root.removeEventListener('click',click);root.removeEventListener('input',input);root.removeEventListener('submit',submit);}};
}
