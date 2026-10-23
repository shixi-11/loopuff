import { newVault, restoreVault, vaultPuzzle, inspectVault, submitVault, advanceVault, replayVault } from './vault.js';

const key='loopuff-vault-v1';
const html=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const freshSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
export function loadVault(){try{return restoreVault(JSON.parse(localStorage.getItem(key)),freshSeed());}catch{return newVault(freshSeed());}}
export function mountVault(root,{text:t,errors,reduced}){
  const state=loadVault();let timers=[],disposed=false;
  const persist=()=>{try{localStorage.setItem(key,JSON.stringify(state));}catch{const status=root.querySelector('[data-vault-status]');if(status)status.textContent=t.noSave;}};
  const cancel=()=>{for(const timer of timers)clearTimeout(timer);timers=[];};
  function render(){
    cancel();
    const p=vaultPuzzle(state.seed,state.stage),s=t.stages[state.stage];
    const source=state.drafts[state.stage]||(!state.submitted?p.starter:'');
    // A cleared empty editor must stay empty across locale changes and reloads.
    const draft=state.edited?.includes(state.stage)?state.drafts[state.stage]:source;
    const report=state.submitted===draft&&draft?inspectVault(state,draft):null;
    root.innerHTML=`<section class="vault-mission">
      <header class="vault-heading"><div><span class="eyebrow">${html(t.eyebrow)} · <bdi dir="ltr">0${state.stage+1} / 03</bdi></span><h1 id="learning-title">${html(t.title)}</h1><p>${html(t.intro)}</p></div><div class="vault-stamps"><span>${html(t.collection)}</span><strong><bdi dir="ltr">${state.stamps.length} / 3</bdi></strong></div></header>
      <ol class="vault-path">${t.stages.map((item,i)=>`<li ${i===state.stage?'aria-current="step"':''} data-cleared="${state.cleared.includes(i)}"><bdi dir="ltr">${state.cleared.includes(i)?'✓':String(i+1).padStart(2,'0')}</bdi><span>${html(item.title)}</span></li>`).join('')}</ol>
      <div class="vault-workspace"><section class="vault-observation" aria-label="${html(t.scene)}">
        <div class="vault-theatre" data-vault-scene data-state="idle" aria-hidden="true"><div class="vault-stars"></div><div class="vault-rim"><div class="vault-core"><span>✦</span></div><div class="vault-door"><div class="vault-ring"><i></i><i></i><i></i><div class="vault-dial"><span data-vault-dial>—</span></div></div><div class="vault-bolts"><i></i><i></i><i></i></div></div></div><div class="vault-scan"></div><div class="vault-scene-label">${html(t.bank)}</div></div>
        <div class="vault-receivers" aria-label="${html(t.receivers)}" dir="ltr">${p.goal.logs.map((_,i)=>`<span data-receiver="${i}"><small>${String(i+1).padStart(2,'0')}</small><b>—</b></span>`).join('')}</div>
        <div class="vault-brief"><h2>${html(s.title)}</h2><p>${html(s.task.replaceAll('{a}',p.a).replaceAll('{b}',p.b).replaceAll('{c}',p.c))}</p><div class="vault-clues" dir="ltr"><span><small>A</small>${p.a}</span><span><small>B</small>+ ${p.b}</span>${state.stage===2?`<span><small>C</small>+ ${p.c}</span>`:''}</div></div>
      </section><section class="vault-console"><form data-vault-form><label for="vault-editor">${html(t.editor)}</label><p class="vault-editor-note">${html(t.signalRule)}</p><textarea id="vault-editor" class="practice-editor" rows="7" maxlength="4096" dir="ltr" spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby="vault-keyboard">${html(draft)}</textarea><small id="vault-keyboard">${html(t.keyboard)}</small><div class="dialog-actions"><button class="primary" data-vault-run type="submit">${html(t.run)} <span aria-hidden="true">↗</span></button><button class="text-button" type="button" data-vault-action="reset">${html(t.reset)}</button></div></form>
        <div class="vault-feedback" data-vault-feedback data-kind="idle" role="status" aria-live="polite"><strong data-vault-status>${html(t.ready)}</strong><p data-vault-detail>${html(t.consequence)}</p><div data-vault-output hidden><span>${html(t.output)}</span><code dir="ltr"></code></div></div>
        <div class="vault-next" data-vault-next hidden><button class="primary" type="button" data-vault-action="next">${html(state.stage===2?t.replay:t.next)} <span aria-hidden="true">→</span></button><p>${html(state.stage===2?t.allDone:s.learned)}</p></div>
        <details class="vault-help"><summary>${html(t.help)}</summary><p>${html(s.hint)}</p><pre dir="ltr">${html(p.example)}</pre><p>${html(t.meaning)}</p></details>
      </section></div><p class="vault-footnote">${html(t.practiceNote)}</p></section>`;
    if(report)present(report,false);
  }
  function present(report,animate){
    cancel();const scene=root.querySelector('[data-vault-scene]'),feedback=root.querySelector('[data-vault-feedback]'),status=root.querySelector('[data-vault-status]'),detail=root.querySelector('[data-vault-detail]'),output=root.querySelector('[data-vault-output]');
    const finish=()=>{
      if(disposed)return;
      scene.dataset.state=report.ok?'open':'retry';feedback.dataset.kind=report.ok?'success':'retry';
      status.textContent=report.ok?(state.stage===2?t.complete:t.opened):report.result?t.mismatch:t.fixCode;
      detail.textContent=report.ok?t.stages[state.stage].learned:report.result?t.compare.replace('{expected}', '\u2066'+report.expected.join(' → ')+'\u2069'):errors[report.code==='name'?'nameError':report.code]||errors.limit;
      root.querySelector('[data-vault-next]').hidden=!report.ok;
      root.querySelector('[data-vault-run]').disabled=false;
    };
    output.hidden=!report.result;output.querySelector('code').textContent=report.actual.slice(0,8).join(' → ')||(report.result?t.noOutput:'');
    const frames=report.actual.slice(0,report.expected.length+1);
    function frame(value,i){
      root.querySelector('[data-vault-dial]').textContent=value;
      const receiver=root.querySelector(`[data-receiver="${i}"]`);
      if(receiver){receiver.querySelector('b').textContent=value;receiver.dataset.match=String(value===report.expected[i]);}
    }
    if(animate&&!reduced.matches&&frames.length){
      scene.dataset.state='running';status.textContent=t.running;detail.textContent=t.consequence;root.querySelector('[data-vault-run]').disabled=true;
      frames.forEach((value,i)=>timers.push(setTimeout(()=>frame(value,i),250+i*550)));
      timers.push(setTimeout(finish,350+frames.length*550));
    }else{frames.forEach(frame);finish();}
  }
  function onInput(event){
    if(event.target.id!=='vault-editor')return;
    cancel();state.drafts[state.stage]=event.target.value;state.submitted=null;
    if(!state.edited)state.edited=[];if(!state.edited.includes(state.stage))state.edited.push(state.stage);
    root.querySelector('[data-vault-run]').disabled=false;
    root.querySelector('[data-vault-scene]').dataset.state='idle';root.querySelector('[data-vault-dial]').textContent='—';
    for(const el of root.querySelectorAll('[data-receiver]')){el.querySelector('b').textContent='—';delete el.dataset.match;}
    root.querySelector('[data-vault-feedback]').dataset.kind='idle';root.querySelector('[data-vault-status]').textContent=t.changed;root.querySelector('[data-vault-detail]').textContent=t.consequence;
    root.querySelector('[data-vault-output]').hidden=true;root.querySelector('[data-vault-next]').hidden=true;persist();
  }
  function onSubmit(event){if(!event.target.matches('[data-vault-form]'))return;event.preventDefault();const source=root.querySelector('#vault-editor').value;const report=submitVault(state,source);persist();render();present(report,true);}
  function onClick(event){
    const action=event.target.closest('[data-vault-action]')?.dataset.vaultAction;if(!action)return;
    if(action==='reset'){state.drafts[state.stage]=vaultPuzzle(state.seed,state.stage).starter;state.edited=(state.edited||[]).filter(i=>i!==state.stage);state.submitted=null;}
    if(action==='next'){
      if(state.stage===2){if(!state.submitted||!inspectVault(state,state.submitted).ok)return;const next=replayVault(state,freshSeed());Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,next);}
      else if(!advanceVault(state))return;
    }
    persist();render();root.querySelector('#vault-editor').focus({preventScroll:true});
  }
  root.addEventListener('input',onInput);root.addEventListener('submit',onSubmit);root.addEventListener('click',onClick);render();
  return {dispose(){disposed=true;cancel();root.removeEventListener('input',onInput);root.removeEventListener('submit',onSubmit);root.removeEventListener('click',onClick);}};
}
