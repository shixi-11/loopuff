import { chaseRoles, chasePuzzle, newChase, restoreChase, inspectChase, submitChase, advanceChase } from './chase.js';
const key = 'loopuff-chase-v1';
const html = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function loadChase() { try { return restoreChase(JSON.parse(localStorage.getItem(key))); } catch { return newChase(); } }
export function mountChase(root, {text:t, errors, reduced}) {
  const state = loadChase(); let timer = null, disposed = false, playing = false, paused = false, frame = 0, report = null, saveFailed = false;
  const work = () => state.work[state.role];
  const cancel = () => { clearTimeout(timer); timer = null; playing = false; paused = false; };
  const persist = () => {
    try { localStorage.setItem(key,JSON.stringify(state)); saveFailed=false; } catch { saveFailed=true; }
    const status=root.querySelector('[data-chase-save]');if(status)status.textContent=saveFailed?t.noSave:'';
  };
  function render() {
    cancel(); const w = work(), p = chasePuzzle(w.stage);
    report = w.submitted !== null && w.submitted === w.drafts[w.stage] ? inspectChase(state.role,w.stage,w.submitted) : null;
    root.innerHTML = `<section class="chase-page"><header class="chase-heading"><div><span class="eyebrow">${html(t.tag)} · <bdi dir="ltr">0${w.stage+1} / 03</bdi></span><h1 id="learning-title">${html(t.title)}</h1><p>${html(t.intro)}</p></div><div class="chase-roles" role="group" aria-label="${html(t.choose)}">${chaseRoles.map(role=>`<button type="button" data-chase-role="${role}" aria-pressed="${state.role===role}"><span aria-hidden="true">${role==='police'?'◇':'●'}</span>${html(t[role])}<small><bdi dir="ltr">${state.work[role].cleared.length} / 3</bdi></small></button>`).join('')}</div></header>
    <ol class="vault-path">${t.stages.map((s,i)=>`<li aria-current="${i===w.stage?'step':'false'}" data-cleared="${w.cleared.includes(i)}"><bdi dir="ltr">${w.cleared.includes(i)?'✓':i+1}</bdi><span>${html(s)}</span></li>`).join('')}</ol>
    <div class="chase-workspace"><section class="chase-observation"><h2>${html(t[state.role+'Goal'])}</h2><p>${html(t.rules)}</p><div class="chase-board" dir="ltr" aria-hidden="true"><div class="chase-sky"><i></i><i></i><i></i><i></i><i></i><span>✦</span></div><div class="chase-finish">⚑</div>${chaseRoles.map(role=>`<div class="chase-track ${role}">${p.blocks.map(n=>`<i class="chase-block" style="left:${n/18*100}%"></i>`).join('')}<span class="chase-actor" data-actor="${role}" style="left:${(role==='police'?0:p.gap)/18*100}%">${role==='police'?'◇':'●'}</span></div>`).join('')}<div class="chase-scale">${[0,3,6,9,12,15,18].map(n=>`<span style="left:${n/18*100}%">${n}</span>`).join('')}</div></div>
    <dl class="chase-legend"><div><dt>◇ ${html(t.police)}</dt><dd data-position="police" dir="ltr">0</dd></div><div><dt>● ${html(t.thief)}</dt><dd data-position="thief" dir="ltr">${p.gap}</dd></div><div><dt>${html(t.blocks)}</dt><dd dir="ltr">${p.blocks.join(', ')||'—'}</dd></div></dl>
    <p class="chase-clue">${html(t.clue)}</p><p class="chase-move" data-chase-move role="status" aria-live="polite"></p><div class="dialog-actions"><button class="text-button" type="button" data-chase-action="pause" hidden>${html(t.pause)}</button><button class="text-button" type="button" data-chase-action="watch" hidden>${html(t.watch)}</button></div></section>
    <section class="chase-console"><form data-chase-form><label for="chase-editor">${html(t.editor)}</label><p>${html(t.signalRule)}</p><textarea id="chase-editor" class="practice-editor" rows="8" maxlength="4096" spellcheck="false" autocapitalize="off" autocomplete="off" dir="ltr" aria-describedby="chase-keyboard">${html(w.drafts[w.stage])}</textarea><small id="chase-keyboard">${html(t.keyboard)}</small><div class="dialog-actions"><button class="primary" type="submit" data-chase-run>${html(t.run)} ↗</button><button class="text-button" type="button" data-chase-action="reset">${html(t.reset)}</button></div></form>
    <div class="chase-feedback" role="status" aria-live="polite"><strong data-chase-status>${html(t.ready)}</strong><p data-chase-detail></p><code data-chase-output dir="ltr"></code></div><button class="primary" type="button" data-chase-action="next" hidden>${html(w.stage===2?t.replay:t.next)} →</button>
    <details class="vault-help"><summary>${html(t.help)}</summary><p>${html(t.hints[w.stage])}</p><pre dir="ltr">${html(w.stage===0?'3.log();\n3.log()':w.stage===1?'let step = 1;\n(step + 1).log()':'let step = 3;\nstep.log();\n(1 + 1).log()')}</pre><p>${html(t.meaning)}</p></details></section></div><p data-chase-save role="status">${saveFailed?html(t.noSave):''}</p><p class="vault-footnote">${html(t.local)}</p></section>`;
    if(report) present(false);
  }
  function position(f) {
    for(const role of chaseRoles) {
      root.querySelector(`[data-actor="${role}"]`).style.left = `${f[role]/18*100}%`;
      root.querySelector(`[data-position="${role}"]`).textContent = f[role];
    }
  }
  function finish() {
    playing=false; paused=false;
    root.querySelector('[data-chase-run]').disabled=false;
    root.querySelector('[data-chase-action="pause"]').hidden=true;
    root.querySelector('[data-chase-action="watch"]').hidden=!report.frames.length;
    const error = report.code === 'name' ? 'nameError' : report.code;
    root.querySelector('[data-chase-status]').textContent = report.ok ? t.won : report.code ? t.fix : t[report.outcome];
    root.querySelector('[data-chase-detail]').textContent = report.ok ? t.learned[work().stage] : report.code ? (report.code==='signals'?t.signalRule:errors[error]||errors.limit) : t.retry;
    root.querySelector('[data-chase-action="next"]').hidden=!report.ok;
    root.querySelector('.chase-feedback').dataset.ok=String(report.ok);
  }
  function step() {
    if(disposed || paused) return;
    const f = report.frames[frame++]; position(f);
    root.querySelector('[data-chase-move]').textContent = t.step.replace('{n}',frame).replace('{move}',f.signal)+(f.blocked?` · ${t.blocked}`:'');
    if(frame < report.frames.length) timer=setTimeout(step,650); else timer=setTimeout(finish,650);
  }
  function present(animate) {
    cancel(); frame=0;
    root.querySelector('[data-chase-output]').textContent=report.logs.join(' → ');
    if(animate && !reduced.matches && report.frames.length) {
      playing=true; position({police:0,thief:chasePuzzle(work().stage).gap});
      root.querySelector('[data-chase-run]').disabled=true;
      root.querySelector('[data-chase-status]').textContent=t.running;
      root.querySelector('[data-chase-detail]').textContent='';
      root.querySelector('[data-chase-action="next"]').hidden=true;
      root.querySelector('[data-chase-action="watch"]').hidden=true;
      root.querySelector('[data-chase-action="pause"]').hidden=false;
      root.querySelector('[data-chase-action="pause"]').textContent=t.pause;
      timer=setTimeout(step,350);
    } else { if(report.frames.length)position(report.frames.at(-1)); finish(); }
  }
  function input(e) {
    if(e.target.id!=='chase-editor')return;
    work().drafts[work().stage]=e.target.value; work().submitted=null; report=null;
    cancel(); position({police:0,thief:chasePuzzle(work().stage).gap});
    root.querySelector('[data-chase-run]').disabled=false;
    for(const a of ['next','watch','pause'])root.querySelector(`[data-chase-action="${a}"]`).hidden=true;
    for(const s of ['detail','output','move'])root.querySelector(`[data-chase-${s}]`).textContent='';
    root.querySelector('[data-chase-status]').textContent=t.changed;
    delete root.querySelector('.chase-feedback').dataset.ok; persist();
  }
  function submit(e) {
    if(!e.target.matches('[data-chase-form]'))return;
    e.preventDefault(); if(playing)return;
    report=submitChase(state,root.querySelector('#chase-editor').value); persist(); render(); present(true);
  }
  function click(e) {
    const role=e.target.closest('[data-chase-role]')?.dataset.chaseRole;
    if(role && chaseRoles.includes(role)){state.role=role;render();persist();return;}
    const action=e.target.closest('[data-chase-action]')?.dataset.chaseAction;
    if(action==='pause'){paused=!paused;clearTimeout(timer);e.target.textContent=paused?t.resume:t.pause;if(!paused){if(frame<report.frames.length)step();else finish();}return;}
    if(action==='watch' && report){present(true);return;}
    if(action==='reset'){work().drafts[work().stage]=chasePuzzle(work().stage).starter;work().submitted=null;}
    else if(action==='next'){
      if(playing || !report?.ok)return;
      if(work().stage===2){work().stage=0;work().drafts=[0,1,2].map(i=>chasePuzzle(i).starter);work().submitted=null;}
      else if(!advanceChase(state))return;
    }else return;
    render();persist();root.querySelector('#chase-editor').focus({preventScroll:true});
  }
  function visibility(){if(document.hidden && playing && !paused){paused=true;clearTimeout(timer);root.querySelector('[data-chase-action="pause"]').textContent=t.resume;}}
  root.addEventListener('input',input);root.addEventListener('submit',submit);root.addEventListener('click',click);document.addEventListener('visibilitychange',visibility);render();
  return {dispose(){disposed=true;cancel();root.removeEventListener('input',input);root.removeEventListener('submit',submit);root.removeEventListener('click',click);document.removeEventListener('visibilitychange',visibility);}};
}
