import { aircraftUrl } from './plane.js';
import {progressStorage} from './save-data.js';
import {dispatchFeedback} from './dispatch-feedback.js';
import {mountDispatchLayout,keepDispatchEditorVisible} from './dispatch-layout.js';
import {dispatchIds,dispatchSourceLimit,dispatchPuzzle,inspectDispatch,restoreDispatch,editDispatch,submitDispatch,nextDispatchRound} from './dispatch.js';
const key='loopuff-dispatch-v1';
const html=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function freshSeed(){try{return crypto.getRandomValues(new Uint32Array(1))[0];}catch{return Date.now()>>>0;}}
export function loadDispatch(){let value;try{value=JSON.parse(localStorage.getItem(key));}catch{}return restoreDispatch(value,freshSeed());}
const printed=(logs,empty)=>{if(!logs.length)return empty;const text=logs.join(' → ');return text.slice(0,200)+(text.length>200?' …':'');};
const inputCode=sample=>sample.inputCode||sample.prefix.trim();

export function mountDispatch(root,{text:t,errors,concepts,reduced,urls,format=html,statuses={pass:t.passed,fail:t.failed}}){
 let state=loadDispatch(),index=3,report=null,saveFailed=false;
 let disposeLayout=()=>{};
 const puzzle=()=>dispatchPuzzle(state.seed,state.selected),mission=()=>t.missions[dispatchIds.indexOf(state.selected)];
 const code=source=>`<pre class="exercise-code" dir="ltr">${html(source)}</pre>`;
 async function persist(){try{const raw=JSON.stringify(state);await progressStorage().write(()=>localStorage.setItem(key,raw));saveFailed=false;}catch{saveFailed=true;}const note=root.querySelector('[data-dispatch-save]');if(note)note.textContent=saveFailed?t.noSave:t.local;}
 function restoreReport(){const source=state.submitted[state.selected];report=source!==null&&source===state.drafts[state.selected]?inspectDispatch(state.seed,state.selected,source):null;}
 function repair(current,p){
  const feedback=dispatchFeedback(p,current);if(!feedback||feedback.kind==='passed')return '';
  const message=feedback.kind==='error'?errors[feedback.code]||errors.limit:t.repair[feedback.kind];
  const canInspect=feedback.outputIndex!==undefined&&feedback.outputIndex<8&&current.outputs[feedback.outputIndex];
  return '<aside class="dispatch-repair" aria-labelledby="dispatch-repair-title"><h3 id="dispatch-repair-title">'+html(t.repair.title)+'</h3><p>'+html(message.replace('{number}',String((feedback.outputIndex??0)+1)))+'</p>'+(canInspect?'<button class="text-button" type="button" data-dispatch-action="inspect">'+html(t.repair.inspect)+'</button>':'')+'</aside>';
 }
 function scene(){
  const p=puzzle(),sample=p.cases[index],current=report?.cases[index],outputs=current?.result?.logs||[];
  const targetLabel=['branch','manifest'].includes(p.id)?t.dock:t.expected;
  const signals=outputs.length?outputs.slice(0,8):[null];
  return `<header class="dispatch-preview-heading"><div><span class="eyebrow">${html(t.preview)}</span><h2>${html(t.batch)} <bdi dir="ltr">${index+1} / ${p.cases.length}</bdi></h2></div><span class="dispatch-verdict" data-status="${current?current.ok?'pass':'fail':'idle'}">${html(current?current.ok?t.passed:t.failed:t.pending)}</span></header>
   <div class="dispatch-input"><h3>${html(t.inputs)}</h3>${code(inputCode(sample))}<p>${html(t.inputNote)}</p></div>
   <div class="dispatch-board ${current&&!reduced.matches?'dispatch-animate':''}" aria-label="${html(t.preview)}">${signals.map((signal,i)=>`<div class="dispatch-lane" style="--delay:${i*180}ms" data-match="${current?String(signal===sample.logs[i]):'idle'}"><div class="dispatch-station"><img src="${aircraftUrl}" alt=""><span>${html(t.origin)}</span></div><div class="dispatch-track"><span class="dispatch-packet">${signal===null?'—':html(signal)}</span></div><div class="dispatch-target"><small>${html(targetLabel)}</small><strong dir="ltr">${html(sample.logs[i]??'—')}</strong></div></div>`).join('')}</div>
   <dl class="dispatch-signals"><div><dt>${html(t.expected)}</dt><dd dir="ltr">${html(printed(sample.logs,t.noOutput))}</dd></div><div><dt>${html(t.actual)}</dt><dd dir="ltr">${current?html(printed(outputs,t.noOutput)):'—'}</dd></div></dl>
   ${repair(current,p)}
   ${current?.outputs.length?`<details class="dispatch-trace"><summary>${html(t.code)}</summary>${current.outputs.slice(0,8).map((output,i)=>{const names=Object.entries(output.names).map(([name,value])=>name+' = '+value).join(', ');return `<article data-dispatch-trace-output="${i}" tabindex="-1">`+code(output.source+' → '+output.value)+(names?`<p>${html(t.names)}: <bdi dir="ltr">${html(names)}</bdi></p>`:'')+'</article>';}).join('')}</details>`:''}`;
 }
 function result(){
  if(!report)return '';
  const p=puzzle();
  const current=report.cases[index],failure=report.cases.find(item=>!item.ok);
  const requirements=current?.checks.find(check=>check.id==='concepts')?.requirements;
  const errorCode=failure?.result?.waiting?'waiting':(failure?.code||report.code)==='name'?'nameError':failure?.code||report.code;
  return `<div class="dispatch-result-head" data-ok="${report.ok}"><h2>${html(report.ok?t.success:t.retry)}</h2><strong><bdi>${html(t.summary.replace('{passed}',report.passed).replace('{total}',report.total))}</bdi></strong>${!report.ok?`<p>${html(errors[errorCode]||errors.limit)}</p>`:`<p>${html(mission().learned)}</p>`}</div>
   ${requirements?`<section class="dispatch-requirements"><h3>${html(t.rules)}</h3><ul>${requirements.map(item=>`<li><span aria-hidden="true">${item.passed?'✓':'○'}</span><span class="sr-only">${html(item.passed?statuses.pass:statuses.fail)}: </span> ${html(concepts[item.concept])}</li>`).join('')}</ul></section>`:''}
   <details class="dispatch-batches"><summary>${html(t.details)}</summary><div class="dispatch-table-scroll"><table><thead><tr><th>${html(t.batch)}</th><th>${html(t.inputs)}</th><th>${html(t.expected)}</th><th>${html(t.actual)}</th></tr></thead><tbody>${report.cases.map((item,i)=>`<tr data-status="${item.ok?'pass':'fail'}"><td><button type="button" data-dispatch-case="${i}" aria-label="${html(t.batch+' '+(i+1)+' · '+(item.ok?t.passed:t.failed))}"><bdi dir="ltr">${i+1}</bdi> ${html(item.ok?t.passed:t.failed)}</button></td><td><code dir="ltr">${html(inputCode(p.cases[i]).replaceAll('\n',' '))}</code></td><td><code dir="ltr">${html(printed(item.expected,t.noOutput))}</code></td><td><code dir="ltr">${html(printed(item.result?.logs||[],t.noOutput))}</code></td></tr>`).join('')}</tbody></table></div></details>`;
 }
 function updatePreview(){
  const batchesOpen=root.querySelector('.dispatch-batches')?.open,traceOpen=root.querySelector('.dispatch-trace')?.open;
  root.querySelector('[data-dispatch-preview]').innerHTML=scene();
  root.querySelector('[data-dispatch-results]').innerHTML=result();
  const batches=root.querySelector('.dispatch-batches'),trace=root.querySelector('.dispatch-trace');
  if(batches)batches.open=!!batchesOpen;if(trace)trace.open=!!traceOpen;
  const select=root.querySelector('#dispatch-batch');select.value=String(index);
 }
 function render(){
  disposeLayout();
  const p=puzzle(),m=mission();index=Math.min(index,p.cases.length-1);
  root.innerHTML=`<section class="dispatch-page"><nav class="page-trail"><a href="${html(urls.home)}">${html(urls.homeLabel)}</a><span aria-hidden="true">/</span><a href="${html(urls.play)}">${html(urls.playLabel)}</a><span aria-hidden="true">/</span><span>${html(t.title)}</span></nav><header class="dispatch-hero"><span class="eyebrow">${html(t.tag)}</span><h1 id="learning-title">${html(t.title)}</h1><p>${html(t.intro)}</p><dl><div><dt>${html(t.badges)}</dt><dd dir="ltr">${state.stamps.length} / ${dispatchIds.length}</dd></div><div><dt>${html(t.rounds)}</dt><dd dir="ltr">${state.rounds}</dd></div></dl></header>
   <nav class="dispatch-missions" aria-label="${html(t.title)}">${dispatchIds.map((id,i)=>`<button type="button" data-dispatch-mission="${id}" ${id===state.selected?'aria-current="step"':''}><span aria-hidden="true">${state.cleared.includes(id)?'✓':String(i+1).padStart(2,'0')}</span>${html(t.missions[i].title)}</button>`).join('')}</nav>
   <div class="dispatch-workspace"><section class="dispatch-console"><h2>${html(m.title)}</h2><p>${format(m.brief)}</p><div class="dispatch-editing"><form data-dispatch-form><label class="editor-label" for="dispatch-editor">${html(t.editor)}</label><textarea id="dispatch-editor" class="practice-editor" rows="10" maxlength="${dispatchSourceLimit}" dir="ltr" spellcheck="false" autocapitalize="off" autocomplete="off">${html(state.drafts[state.selected])}</textarea><div class="dialog-actions"><button class="primary" type="submit">${html(t.run)} ↗</button><button class="text-button" type="button" data-dispatch-action="replay" ${report?'':'disabled'}>${html(t.replay)}</button></div></form><p class="dispatch-status" data-dispatch-status tabindex="-1" role="status" aria-live="polite">${html(report?t.summary.replace('{passed}',report.passed).replace('{total}',report.total):t.idle)}</p><div class="dispatch-support"><details class="dispatch-help"><summary>${html(t.help)}</summary><p>${format(m.hint)}</p><a href="${html(urls.lessons[dispatchIds.indexOf(state.selected)])}">${html(t.learn)} ↗</a></details><details class="dispatch-reset"><summary>${html(t.reset)}</summary><button type="button" class="text-button" data-dispatch-action="reset">${html(t.reset)}</button></details></div></div></section>
   <div class="dispatch-review"><section class="dispatch-inspector"><label for="dispatch-batch">${html(t.batch)}</label><select id="dispatch-batch" dir="ltr">${p.cases.map((sample,i)=>`<option value="${i}" ${i===index?'selected':''}>${i+1} · ${html(inputCode(sample).replaceAll('\n',' '))}</option>`).join('')}</select><p>${html(t.previewNote)}</p><div data-dispatch-preview>${scene()}</div></section><section class="dispatch-results" data-dispatch-results>${result()}</section></div></div>
   <section class="dispatch-round"><div><button class="text-button" type="button" data-dispatch-action="new-round">${html(t.newRound)} ↗</button><p>${html(t.newRoundNote)}</p></div><p data-dispatch-save>${html(saveFailed?t.noSave:t.local)}</p></section></section>`;
  disposeLayout=mountDispatchLayout(root);
 }
 function onInput(event){if(event.target.id!=='dispatch-editor')return;const hadReport=!!report;editDispatch(state,state.selected,event.target.value);report=null;persist();updatePreview();root.querySelector('[data-dispatch-status]').textContent=t.changed;root.querySelector('[data-dispatch-action="replay"]').disabled=true;if(hadReport)keepDispatchEditorVisible(root);}
 function onChange(event){if(event.target.id!=='dispatch-batch')return;index=Number(event.target.value);updatePreview();}
 function onSubmit(event){
  if(!event.target.matches('[data-dispatch-form]'))return;event.preventDefault();
  report=submitDispatch(state,state.selected,root.querySelector('#dispatch-editor').value);
  const failed=report.cases.findIndex(item=>!item.ok);if(failed>=0)index=failed;
  persist();render();root.querySelector('[data-dispatch-status]').focus({preventScroll:true});
 }
 function onClick(event){
  const target=event.target.closest('button');if(!target)return;
  if(target.dataset.dispatchMission){state.selected=target.dataset.dispatchMission;index=3;restoreReport();persist();render();root.querySelector(`[data-dispatch-mission="${state.selected}"]`).focus({preventScroll:true});return;}
  if(target.dataset.dispatchCase!==undefined){index=Number(target.dataset.dispatchCase);updatePreview();const heading=root.querySelector('.dispatch-preview-heading h2');heading.tabIndex=-1;heading.focus({preventScroll:true});root.querySelector('[data-dispatch-preview]').scrollIntoView({block:'nearest',behavior:reduced.matches?'instant':'smooth'});return;}
  const action=target.dataset.dispatchAction;
  if(action==='inspect'){
   const feedback=dispatchFeedback(puzzle(),report?.cases[index]),trace=root.querySelector('.dispatch-trace'),output=root.querySelector('[data-dispatch-trace-output="'+feedback?.outputIndex+'"]');
   if(trace&&output){trace.open=true;output.focus({preventScroll:true});output.scrollIntoView({block:'nearest',behavior:reduced.matches?'instant':'smooth'});}return;
  }
  if(action==='reset'){editDispatch(state,state.selected,puzzle().starter);report=null;persist();render();root.querySelector('#dispatch-editor').focus();}
  if(action==='new-round'){state=nextDispatchRound(state,freshSeed());report=null;index=3;persist();render();root.querySelector('[data-dispatch-action="new-round"]').focus({preventScroll:true});}
  if(action==='replay')updatePreview();
 }
 restoreReport();render();persist();
 root.addEventListener('input',onInput);root.addEventListener('change',onChange);root.addEventListener('submit',onSubmit);root.addEventListener('click',onClick);
 return {dispose(){disposeLayout();root.removeEventListener('input',onInput);root.removeEventListener('change',onChange);root.removeEventListener('submit',onSubmit);root.removeEventListener('click',onClick);}};
}
