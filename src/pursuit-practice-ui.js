import {pursuitPracticeStarter,checkPursuitPractice,currentPursuitPractice,stagePursuitPractice} from './pursuit-practice.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountPursuitPractice(root,{text:t,errors,model,getWorld,pause,canStage,onStage,mountReplay}){
 const state=model.practice??={source:pursuitPracticeStarter,report:null,confirmation:null,notice:'ready'};
 const el=selector=>root.querySelector(selector);
 let lastAllowed,lastPending,lastNotice,disposed=false,replay=null,paintedReport,paintedSelection;
 root.innerHTML=`<details class="pursuit-practice"><summary>${esc(t.title)}</summary><p>${esc(t.intro)}</p><p>${esc(t.rule)}</p><div class="pursuit-practice-workbench"><div class="pursuit-practice-writing"><label for="pursuit-practice-editor">${esc(t.editor)}</label><textarea id="pursuit-practice-editor" dir="ltr" rows="9" maxlength="3000" spellcheck="false" autocapitalize="off" autocomplete="off">${esc(state.source)}</textarea><div class="pursuit-code-actions"><button type="button" class="primary" data-pursuit-practice="check">${esc(t.check)}</button><button type="button" data-pursuit-practice="stage">${esc(t.stage)}</button><button type="button" data-pursuit-practice="cancel" hidden>${esc(t.cancel)}</button></div><div class="pursuit-practice-hints"><button type="button" data-pursuit-practice="hint" aria-controls="pursuit-practice-hints">${esc(t.hint)}</button><button type="button" data-pursuit-practice="hideHints" hidden>${esc(t.hideHints)}</button><ol id="pursuit-practice-hints" hidden></ol></div><p data-pursuit-practice-status role="status" aria-live="polite"></p></div><div data-pursuit-practice-result></div></div><p class="pursuit-practice-boundary">${esc(t.boundary)}</p></details>`;
 function refresh(){
  const stale=state.report&&!currentPursuitPractice(getWorld(),state.source,state.report),allowed=!state.pending&&canStage()&&['ready','paused'].includes(getWorld().status);
  if(!stale&&allowed===lastAllowed&&!!state.pending===lastPending&&state.notice===lastNotice)return;
  if(stale){state.report=null;state.confirmation=null;state.notice='changed';}
  if(state.confirmation&&!allowed){state.confirmation=null;state.notice='unavailable';}
  paint();
 }
 function paint(){
  lastAllowed=!state.pending&&canStage()&&['ready','paused'].includes(getWorld().status);
  lastPending=!!state.pending;lastNotice=state.notice;
  el('#pursuit-practice-editor').disabled=!!state.pending;el('[data-pursuit-practice="check"]').disabled=!!state.pending;
  const stage=el('[data-pursuit-practice="stage"]');stage.disabled=!state.report?.ready||!lastAllowed;
  stage.textContent=state.confirmation?t.confirm:t.stage;el('[data-pursuit-practice="cancel"]').hidden=!state.confirmation;
  el('[data-pursuit-practice-status]').textContent=t[state.notice];
  const level=state.hintLevel||0,hint=el('[data-pursuit-practice="hint"]');
  hint.textContent=level?t.nextHint:t.hint;hint.disabled=level===3;hint.setAttribute?.('aria-expanded',String(level>0));
  el('[data-pursuit-practice="hideHints"]').hidden=!level;
  const hints=el('#pursuit-practice-hints');hints.hidden=!level;hints.innerHTML=Array.from({length:level},(_,i)=>`<li>${esc(t['hint'+(i+1)])}</li>`).join('');
  const result=el('[data-pursuit-practice-result]');
  if(state.report===paintedReport&&state.selected===paintedSelection)return;
  paintedReport=state.report;paintedSelection=state.selected;replay?.dispose();replay=null;
  if(!state.report){result.innerHTML='';return;}
  const action=logs=>logs.map(value=>`<bdi dir="ltr">${esc(value)}</bdi> ${esc(t['action'+value])}`).join(' → ');
  const item=state.report.cases.find(item=>item.id===state.selected)||state.report.cases[0],observed=item.report.ok?action(item.report.logs):esc(item.report.code==='signals'?t.signalError:errors[item.report.code==='name'?'nameError':item.report.code]||errors.limit);
  const output=item.report.outputs[0],source=state.report.source;
  const trace=output?`<mark>${esc(source.slice(output.start,output.end))}</mark>`:'';
  result.innerHTML=`<p>${esc(t.samples)}</p><label class="pursuit-practice-situations">${esc(t.situation)}<select id="pursuit-practice-case">${state.report.cases.map(row=>`<option value="${row.id}" data-case="${row.id}"${item.id===row.id?' selected':''}>${esc(t[row.id])} · ${esc(row.matches?t.match:t.different)}</option>`).join('')}</select></label><dl class="pursuit-practice-observation"><div><dt>${esc(t.energy)}</dt><dd><bdi dir="ltr">${item.inputs.energy}</bdi></dd></div><div><dt>${esc(t.obstacle)}</dt><dd><bdi dir="ltr">${item.inputs.obstacle}</bdi></dd></div><div><dt>${esc(t.expected)}</dt><dd>${action([item.expected])}</dd></div><div><dt>${esc(t.observation)}</dt><dd>${observed}</dd></div></dl>${output?`<p>${esc(t.executed)}</p><pre class="pursuit-code-trace" dir="ltr">${trace}</pre>`:''}<div data-practice-replay></div>`;
  if(item.report.ok)replay=mountReplay?.(el('[data-practice-replay]'),{world:getWorld(),item});
 }
 function input(event){if(event.target.id!=='pursuit-practice-editor'||state.pending)return;state.source=event.target.value;state.report=null;state.confirmation=null;state.notice='changed';paint();}
 function change(event){if(event.target.id!=='pursuit-practice-case')return;const id=event.target.value;if(state.report?.cases.some(item=>item.id===id)){state.selected=id;paint();el('#pursuit-practice-case').focus?.({preventScroll:true});}}
 async function click(event){
  const action=event.target.closest('[data-pursuit-practice]')?.dataset.pursuitPractice;if(!action)return;
  if(state.pending)return;
  if(action==='hint'){state.hintLevel=Math.min(3,(state.hintLevel||0)+1);paint();if(state.hintLevel===3)el('[data-pursuit-practice="hideHints"]').focus?.();return;}
  if(action==='hideHints'){state.hintLevel=0;paint();el('[data-pursuit-practice="hint"]').focus?.();return;}
  if(action==='check'){pause();state.report=checkPursuitPractice(getWorld(),state.source);state.selected=(state.report.cases.find(item=>!item.matches)||state.report.cases[0]).id;state.confirmation=null;state.notice=state.report.ready?'checked':'mismatch';if(state.report.ready)state.hintLevel=0;paint();return;}
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
 root.addEventListener('input',input);root.addEventListener('change',change);root.addEventListener('click',click);refresh();
 return {refresh,dispose(){disposed=true;replay?.dispose();root.removeEventListener('input',input);root.removeEventListener('change',change);root.removeEventListener('click',click);}};
}
