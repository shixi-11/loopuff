import {pursuitPracticeSource,checkPursuitPractice,currentPursuitPractice,stagePursuitPractice} from './pursuit-practice.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountPursuitPractice(root,{text:t,errors,model,getWorld,pause,canStage,onStage}){
 const state=model.practice??={source:pursuitPracticeSource,report:null,confirmation:null,notice:'ready'};
 const el=selector=>root.querySelector(selector);
 let lastAllowed,disposed=false;
 root.innerHTML=`<details class="pursuit-practice"><summary>${esc(t.title)}</summary><p>${esc(t.intro)}</p><p>${esc(t.rule)}</p><label for="pursuit-practice-editor">${esc(t.editor)}</label><textarea id="pursuit-practice-editor" dir="ltr" rows="9" maxlength="3000" spellcheck="false" autocapitalize="off" autocomplete="off">${esc(state.source)}</textarea><div class="pursuit-code-actions"><button type="button" class="primary" data-pursuit-practice="check">${esc(t.check)}</button><button type="button" data-pursuit-practice="stage">${esc(t.stage)}</button><button type="button" data-pursuit-practice="cancel" hidden>${esc(t.cancel)}</button></div><p data-pursuit-practice-status role="status" aria-live="polite"></p><div data-pursuit-practice-result></div><p class="pursuit-practice-boundary">${esc(t.boundary)}</p></details>`;
 function refresh(){
  const stale=state.report&&!currentPursuitPractice(getWorld(),state.source,state.report),allowed=!state.pending&&canStage()&&['ready','paused'].includes(getWorld().status);
  if(!stale&&allowed===lastAllowed)return;
  if(stale){state.report=null;state.confirmation=null;state.notice='changed';}
  if(state.confirmation&&!allowed){state.confirmation=null;state.notice='unavailable';}
  paint();
 }
 function paint(){
  lastAllowed=!state.pending&&canStage()&&['ready','paused'].includes(getWorld().status);
  el('#pursuit-practice-editor').disabled=!!state.pending;el('[data-pursuit-practice="check"]').disabled=!!state.pending;
  const stage=el('[data-pursuit-practice="stage"]');stage.disabled=!state.report?.ready||!lastAllowed;
  stage.textContent=state.confirmation?t.confirm:t.stage;el('[data-pursuit-practice="cancel"]').hidden=!state.confirmation;
  el('[data-pursuit-practice-status]').textContent=t[state.notice];
  const result=el('[data-pursuit-practice-result]');
  if(!state.report){result.innerHTML='';return;}
  const action=logs=>logs.map(value=>`<bdi dir="ltr">${esc(value)}</bdi> ${esc(t['action'+value])}`).join(' → ');
  result.innerHTML=`<p>${esc(t.samples)}</p><div class="pursuit-practice-table" tabindex="0" role="region" aria-label="${esc(t.observation)}"><table><thead><tr>${[t.situation,t.input,t.expected,t.observation].map(label=>`<th scope="col">${esc(label)}</th>`).join('')}</tr></thead><tbody>${state.report.cases.map(item=>`<tr><th scope="row">${esc(t[item.id])}</th><td><span>${esc(t.energy)} <bdi dir="ltr">${item.inputs.energy}</bdi></span><span>${esc(t.obstacle)} <bdi dir="ltr">${item.inputs.obstacle}</bdi></span></td><td>${action([item.expected])}</td><td>${item.report.ok?action(item.report.logs):esc(item.report.code==='signals'?t.signalError:errors[item.report.code==='name'?'nameError':item.report.code]||errors.limit)}<small>${esc(item.matches?t.match:t.different)}</small></td></tr>`).join('')}</tbody></table></div>`;
 }
 function input(event){if(event.target.id!=='pursuit-practice-editor'||state.pending)return;state.source=event.target.value;state.report=null;state.confirmation=null;state.notice='changed';paint();}
 async function click(event){
  const action=event.target.closest('[data-pursuit-practice]')?.dataset.pursuitPractice;if(!action)return;
  if(state.pending)return;
  if(action==='check'){pause();state.report=checkPursuitPractice(getWorld(),state.source);state.confirmation=null;state.notice=state.report.ready?'checked':'mismatch';paint();return;}
  if(action==='cancel'){state.confirmation=null;state.notice='checked';paint();return;}
  if(action!=='stage')return;
  if(!canStage()){state.confirmation=null;state.notice='unavailable';paint();return;}
  const previous=getWorld().draft,result=stagePursuitPractice(getWorld(),state.source,state.report,state.confirmation===state.report?.stamp);
  if(result==='confirm'){state.confirmation=state.report.stamp;state.notice='replace';}
  else {state.confirmation=null;state.notice=result;if(result==='stale')state.report=null;}
  if(result==='staged'){
   state.report=null;state.pending=true;state.notice='saving';paint();
   let saved=false;try{saved=(await onStage(previous))!==false;}catch{}
   state.pending=false;state.notice=saved?'staged':'saveError';
  }
  if(!disposed)paint();
 }
 root.addEventListener('input',input);root.addEventListener('click',click);refresh();
 return {refresh,dispose(){disposed=true;root.removeEventListener('input',input);root.removeEventListener('click',click);}};
}
