import {arcadeLearningSteps,arcadeLearningIds,inspectArcadeLearning,createArcadeLearningPreview} from './arcade-learning.js';
import {arcadeLearningSource,arcadeLearningProgress} from './arcade-learning-work.js';
import {arcadeWorkKey} from './guide-work.js';
import {cartridges} from './handheld.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const codeText=value=>String(value).split(/(\.log\(\)|\b(?:Tolang|let|if|then|else|for|in|score|energy|targetX|x)\b|\w+\([^)]*\))/g).map((part,i)=>i%2?`<bdi dir="ltr">${esc(part)}</bdi>`:esc(part)).join('');
export function mountArcadeLearning(root,{text:t,pathText,games,states={},errors,model,initialStep,urls,onSelect=()=>{},onChange=()=>true,onPassed=()=>{},onReset=()=>{},reduced={matches:false}}){
 const work=model.drafts;let id=arcadeLearningIds.includes(initialStep)?initialStep:arcadeLearningIds[0],report=null,caseIndex=0,hint=false,armed=false,disposed=false,raf=0,started=null,elapsed=0,last=null;
 const verified=new Set(arcadeLearningProgress(work));
 const el=selector=>root.querySelector(selector),task=()=>arcadeLearningSteps.find(step=>step.id===id),source=()=>arcadeLearningSource(work,id),copy=()=>t.steps[id];
 model.arcadeSaveSerial??=0;
 function stop(){cancelAnimationFrame(raf);raf=0;last=null;}
 async function persist(){
  const serial=++model.arcadeSaveSerial;model.arcadeSaving=true;model.arcadeSaveFailed=false;
  const pending=Promise.resolve().then(()=>onChange()).then(value=>value!==false,()=>false);model.arcadeSavePromise=pending;
  const ok=await pending;if(serial!==model.arcadeSaveSerial)return;
  model.arcadeSaving=false;model.arcadeSaveFailed=!ok;if(!disposed)paintStatus();
 }
 function draw(session){const canvas=el('[data-arcade-lesson-canvas]');if(!canvas||!session)return;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;cartridges[session.selected].draw(ctx,session.world,320,240);}
 function replay(){
  stop();const item=report?.cases[caseIndex],frames=item?.frames||[];if(!frames.length)return;
  if(reduced.matches){draw(frames.at(-1).session);return;}elapsed=0;started=null;last=null;draw(frames[0].session);
  const animate=now=>{if(disposed)return;if(document.hidden){last=null;raf=requestAnimationFrame(animate);return;}if(last!==null)elapsed+=Math.max(0,Math.min(100,now-last));last=now;
   const tick=Math.floor(elapsed/20),frame=frames.findLast(entry=>entry.tick<=tick)||frames[0];draw(frame.session);
   if(tick<frames.at(-1).tick)raf=requestAnimationFrame(animate);else{raf=0;last=null;}
  };raf=requestAnimationFrame(animate);
 }
 function results(){
  stop();const item=report?.cases[caseIndex],isOutput=task().kind==='output';
  const inputs=item?.actualInput&&(id==='score'?{score:item.actualInput.score}:id==='strategy'?{x:item.actualInput.x,targetX:item.actualInput.targetX}:null);
  const selector=report?.cases.length>1?`<label for="arcade-lesson-case">${esc(t.case)}</label><select id="arcade-lesson-case">${report.cases.map((entry,i)=>`<option value="${i}"${i===caseIndex?' selected':''}>${esc(id==='score'?`score = ${entry.actualInput.score}`:`x = ${entry.actualInput.x}, targetX = ${entry.actualInput.targetX}`)}</option>`).join('')}</select>`:'';
  const state=item?.session?.status||(['finish','strategy'].includes(id)?'running':'ready');
  el('[data-arcade-lesson-result]').innerHTML=`${selector}${inputs?`<dl class="arcade-lesson-input"><dt>${esc(t.input)}</dt><dd><code dir="ltr">${esc(Object.entries(inputs).map(([key,value])=>`${key} = ${value}`).join(' · '))}</code></dd></dl>`:''}${isOutput?`<h3>${esc(t.output)}</h3><output class="arcade-lesson-output" dir="ltr">${esc(item?.result?.logs?.join(' → ')||'—')}</output>${item?`<dl class="arcade-lesson-values"><div><dt>${esc(t.expected)}</dt><dd dir="ltr">${esc(item.expected?.join(' → ')||'—')}</dd></div><div><dt>${esc(t.actual)}</dt><dd dir="ltr">${esc(item.result?.logs?.join(' → ')||'—')}</dd></div></dl>`:''}`:`<h3>${esc(t.game)}</h3><canvas data-arcade-lesson-canvas width="320" height="240" aria-label="${esc(t.game)}"></canvas><dl class="arcade-lesson-values"><div><dt>${esc(t.state)}</dt><dd>${esc(games[(item?.session?.selected)??cartridges.findIndex(cart=>cart.id===task().game)])} · ${esc(states[state]||t[state]||t.state)}</dd></div>${item?`<div><dt>${esc(t.score)}</dt><dd>${esc(item.world.score)}</dd></div>${id==='control'?`<div><dt>${esc(t.shots)}</dt><dd>${esc(item.actual.shots)}</dd></div><div><dt>${esc(t.position)}</dt><dd dir="ltr">${Math.round(item.initial.world.player.x)} → ${Math.round(item.world.player.x)} px</dd></div>`:id==='repeat'?`<div><dt>${esc(t.position)}</dt><dd>${esc(item.initial.world.piece.x)} → ${esc(item.world.piece?.x??'—')}</dd></div>`:id==='strategy'?`<div><dt>${esc(t.placed)}</dt><dd>${esc(item.world.pieces)}</dd></div>`:''}`:''}</dl><button type="button" class="text-button" data-arcade-lesson="replay"${item?.frames?.length?'':' disabled'}>${esc(t.replay)} ↺</button><p class="scope-note">${esc(t.practice)}</p>`}`;
  if(!isOutput){draw(item?.session||createArcadeLearningPreview(id));if(item?.frames?.length)replay();}
  paintStatus();
 }
 function paintStatus(){
  if(disposed)return;el('[data-arcade-lesson-status]').textContent=report?(report.ok?t.passed:t.needsWork+(report.code==='conceptMissing'?' '+errors.conceptMissing:errors[report.code==='name'?'nameError':report.code]?' '+errors[report.code==='name'?'nameError':report.code]:'')):pathText.notRun.replace(pathText.run,t.run);
  const current=report?.cases[caseIndex],position=report?.code==='syntax'&&Number.isInteger(current?.position)?Math.min(source().length,Math.max(0,current.position)):null,excerpt=el('[data-arcade-lesson-error]');excerpt.hidden=position===null;
  if(position!==null){el('[data-arcade-lesson-status]').textContent+=' '+(position+1)+'.';const text=source();excerpt.innerHTML=esc(text.slice(Math.max(0,position-28),position))+'<mark>'+esc(text[position]||'▏')+'</mark>'+esc(text.slice(position+1,position+29));}
  el('[data-arcade-lesson-status]').dataset.passed=String(!!report?.ok);
  el('[data-arcade-lesson-save]').textContent=model.arcadeSaveFailed?t.saveError:model.arcadeSaving?t.saving:'';
  const next=el('[data-arcade-lesson="next"]');next.hidden=!report?.ok||id===arcadeLearningIds.at(-1);next.disabled=!!model.arcadeSaving||!!model.arcadeSaveFailed;
  el('[data-arcade-lesson-all]').hidden=verified.size!==arcadeLearningIds.length;
  el('[data-arcade-lesson-complete]').hidden=id!==arcadeLearningIds.at(-1)||!report?.ok||!!model.arcadeSaving||!!model.arcadeSaveFailed;
  el('[data-arcade-lesson="reset"]').textContent=armed?t.confirmReset:t.reset;el('[data-arcade-lesson="cancel"]').hidden=!armed;
  for(const option of el('#arcade-lesson-step').options)option.textContent=`${arcadeLearningIds.indexOf(option.value)+1}. ${t.steps[option.value].title}${verified.has(option.value)?' ✓':''}`;
 }
 function render(){
  stop();hint=false;armed=false;caseIndex=0;report=work[arcadeWorkKey(id,true)]===source()?inspectArcadeLearning(id,source()):null;
  root.innerHTML=`<nav class="page-trail"><a data-action="open-guide" href="${esc(urls.guide)}">${esc(pathText.backGuide)}</a><span aria-hidden="true">/</span><span>${esc(pathText.beginnerTitle)}</span></nav><section class="arcade-learning"><header class="path-heading"><span class="eyebrow">TOLANG / START</span><h1 id="learning-title">${esc(t.title)}</h1><p>${esc(t.intro)}</p></header><label class="path-step-label" for="arcade-lesson-step">${esc(t.step)} <bdi dir="ltr">${arcadeLearningIds.indexOf(id)+1} / ${arcadeLearningIds.length}</bdi></label><select id="arcade-lesson-step">${arcadeLearningIds.map(key=>`<option value="${key}"${key===id?' selected':''}>${esc(t.steps[key].title)}</option>`).join('')}</select><div class="arcade-lesson-workbench"><section class="arcade-lesson-writing"><span class="eyebrow">${esc(t.goal)}</span><h2>${esc(copy().title)}</h2><p>${codeText(copy().goal)}</p><form id="arcade-lesson-form"><label for="arcade-lesson-editor">${esc(t.editor)}</label><textarea id="arcade-lesson-editor" rows="6" maxlength="4096" dir="ltr" spellcheck="false" autocapitalize="off" autocomplete="off">${esc(source())}</textarea><div class="path-actions"><button class="primary" type="submit">${esc(t.run)} ▶</button><button class="text-button" type="button" data-arcade-lesson="hint" aria-expanded="false">${esc(t.hint)}</button></div></form><p data-arcade-lesson-hint hidden>${codeText(copy().hint)}</p><details class="teaching-step"${id==='run'?' open':''}><summary>${esc(t.meaning)}</summary><p>${codeText(copy().meaning)}</p>${task().kind!=='output'?`<p>${esc(t.scope)}</p>`:''}</details><div class="path-reset"><button type="button" class="text-button" data-arcade-lesson="reset">${esc(t.reset)}</button><button type="button" class="text-button" data-arcade-lesson="cancel" hidden>${esc(t.cancel)}</button></div></section><section class="arcade-lesson-observation"><div data-arcade-lesson-result></div><p data-arcade-lesson-status role="status" aria-live="polite"></p><pre data-arcade-lesson-error dir="ltr" hidden></pre><p data-arcade-lesson-save role="status"></p><button class="primary" type="button" data-arcade-lesson="next" hidden>${esc(t.next)} →</button><div data-arcade-lesson-complete hidden><p data-arcade-lesson-all hidden>${esc(t.complete)}</p><a class="primary" data-action="open-advance" href="${esc(urls.advance)}">${esc(t.continueCourse)} ↗</a><a data-action="open-play" href="${esc(urls.play)}">${esc(t.play)} ↗</a></div></section></div></section>`;results();
 }
 const input=event=>{if(event.target.id!=='arcade-lesson-editor')return;onReset();work[arcadeWorkKey(id)]=event.target.value;delete work[arcadeWorkKey(id,true)];verified.delete(id);report=null;armed=false;void persist();results();};
 const change=event=>{if(event.target.id==='arcade-lesson-step'&&arcadeLearningIds.includes(event.target.value)){onReset();id=event.target.value;onSelect(id);render();el('#arcade-lesson-editor').focus({preventScroll:true});}if(event.target.id==='arcade-lesson-case'){caseIndex=Math.max(0,Math.min((report?.cases.length||1)-1,Number(event.target.value)||0));results();}};
 const submit=event=>{if(event.target.id!=='arcade-lesson-form')return;event.preventDefault();report=inspectArcadeLearning(id,source());work[arcadeWorkKey(id,true)]=source();caseIndex=Math.max(0,report.cases.findIndex(item=>!item.ok));if(report.ok){verified.add(id);onPassed(id,source());}else verified.delete(id);void persist();results();if(matchMedia('(max-width:850px)').matches)el('[data-arcade-lesson-status]').scrollIntoView({block:'center',behavior:reduced.matches?'instant':'smooth'});};
 const click=event=>{const action=event.target.closest('[data-arcade-lesson]')?.dataset.arcadeLesson;if(action==='hint'){hint=!hint;el('[data-arcade-lesson-hint]').hidden=!hint;el('[data-arcade-lesson="hint"]').setAttribute('aria-expanded',String(hint));}if(action==='replay')replay();if(action==='cancel'){armed=false;paintStatus();}if(action==='reset'){if(source()!==task().starter&&!armed){armed=true;paintStatus();return;}onReset();work[arcadeWorkKey(id)]=task().starter;delete work[arcadeWorkKey(id,true)];verified.delete(id);void persist();render();}if(action==='next'&&report?.ok&&!model.arcadeSaving&&!model.arcadeSaveFailed){onReset();id=arcadeLearningIds[arcadeLearningIds.indexOf(id)+1];onSelect(id);render();el('#learning-title').scrollIntoView({block:'start',behavior:'instant'});el('#arcade-lesson-editor').focus({preventScroll:true});}};
 root.addEventListener('input',input);root.addEventListener('change',change);root.addEventListener('submit',submit);root.addEventListener('click',click);render();
 if(model.arcadeSavePromise)void model.arcadeSavePromise.finally(()=>{if(!disposed)paintStatus();});
 return {dispose(){disposed=true;stop();root.removeEventListener('input',input);root.removeEventListener('change',change);root.removeEventListener('submit',submit);root.removeEventListener('click',click);}};
}
