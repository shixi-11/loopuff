import { chaseRoles, chasePuzzle, newChase, restoreChase, inspectChase, submitChase, advanceChase } from './chase.js';
import { mountChaseScene } from './chase-scene.js';
const key='loopuff-chase-v1';
const html=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asset=name=>new URL(`../assets/chase-${name}-idle.webp`,import.meta.url).href;
const plan=moves=>moves.map(n=>`${n}.log()`).join(';\n');
export function loadChase(){try{return restoreChase(JSON.parse(localStorage.getItem(key)));}catch{return newChase();}}
export function mountChase(root,{text:t,errors,reduced}){
  const state=loadChase();let scene=null,generation=0,disposed=false,playing=false,paused=false,report=null,saveFailed=false,practiceMode=false,practiceMoves=[],debugMode=false,debugCursor=0;
  const work=()=>state.work[state.role];
  const el=selector=>root.querySelector(selector);
  const action=name=>el(`[data-chase-action="${name}"]`);
  const initial=()=>({police:0,thief:chasePuzzle(work().stage).gap,signal:1,outcome:'unfinished'});
  const persist=()=>{try{localStorage.setItem(key,JSON.stringify(state));saveFailed=false;}catch{saveFailed=true;}const status=el('[data-chase-save]');if(status)status.textContent=saveFailed?t.noSave:'';};
  function cancel(){generation++;playing=false;paused=false;scene?.reset();}
  function render(){
    cancel();scene?.dispose();practiceMode=false;practiceMoves=[];debugMode=false;debugCursor=0;
    const w=work(),p=chasePuzzle(w.stage);
    report=w.submitted!==null&&w.submitted===w.drafts[w.stage]?inspectChase(state.role,w.stage,w.submitted):null;
    root.innerHTML=`<section class="chase-page"><header class="chase-heading"><div><span class="eyebrow">${html(t.tag)} · <bdi dir="ltr">0${w.stage+1} / 03</bdi></span><h1 id="learning-title">${html(t.title)}</h1><p>${html(t.intro)}</p></div><div class="chase-roles" role="group" aria-label="${html(t.choose)}">${chaseRoles.map(role=>`<button type="button" data-chase-role="${role}" aria-pressed="${state.role===role}"><img src="${asset(role)}" alt="" aria-hidden="true"><span>${html(t[role])}<small><bdi dir="ltr">${state.work[role].cleared.length} / 3</bdi></small></span></button>`).join('')}</div></header>
    <ol class="vault-path">${t.stages.map((s,i)=>`<li aria-current="${i===w.stage?'step':'false'}" data-cleared="${w.cleared.includes(i)}"><bdi dir="ltr">${w.cleared.includes(i)?'✓':i+1}</bdi><span>${html(s)}</span></li>`).join('')}</ol>
    <section class="chase-theatre"><header><h2>${html(t[state.role+'Goal'])}</h2><dl class="chase-legend">${chaseRoles.map(role=>`<div><dt>${html(t[role])}</dt><dd data-position="${role}" dir="ltr">${role==='police'?0:p.gap}</dd></div>`).join('')}<div><dt>${html(t.blocks)}</dt><dd dir="ltr">${p.blocks.join(', ')||'—'}</dd></div></dl></header>
    <div class="chase-scene" data-chase-scene data-scene="loading" tabindex="0" role="group" aria-label="${html(t.sceneControls)}" aria-describedby="chase-controls-note"><canvas aria-hidden="true"></canvas><p class="chase-scene-loading" data-scene-status>${html(t.loading)}</p></div>
    <div class="chase-controlbar"><div class="chase-practice"><button type="button" class="text-button" data-chase-action="practice" disabled>${html(t.practice)}</button><div role="group" aria-label="${html(t.sceneControls)}" class="chase-moves">${[1,2,3].map(n=>`<button type="button" data-chase-move="${n}" disabled><kbd>${n}</kbd><span>${html(t.moveButton.replace('{n}',n))}</span></button>`).join('')}</div></div><div class="dialog-actions"><button class="text-button" type="button" data-chase-action="pause" hidden>${html(t.pause)}</button><button class="text-button" type="button" data-chase-action="watch" hidden>${html(t.watch)}</button></div></div>
    <p id="chase-controls-note" class="chase-controls-note">${html(t.practiceHint)}</p><p data-chase-trace role="status" aria-live="polite" class="chase-move"></p>
    <details class="chase-trace" data-chase-review hidden><summary>${html(t.debugTitle)}</summary><p>${html(t.debugHint)}</p><div data-chase-debug-controls hidden><p data-chase-debug-count role="status" aria-live="polite"></p><div class="dialog-actions"><button class="text-button" type="button" data-chase-action="debug-back">${html(t.debugBack)}</button><button class="primary" type="button" data-chase-action="debug-next">${html(t.debugNext)}</button><button class="text-button" type="button" data-chase-action="debug-restart">${html(t.debugRestart)}</button></div></div><p data-chase-trace-empty>${html(t.traceEmpty)}</p><ol class="chase-trace-list" data-chase-trace-list tabindex="0" aria-label="${html(t.debugTitle)}"></ol><p data-chase-unused hidden></p></details>
    <button class="text-button" type="button" data-chase-action="copy-plan" hidden>${html(t.copyPlan)}</button><button class="text-button" type="button" data-chase-action="reload-art" hidden>${html(t.retryArt)}</button></section>
    <div class="chase-workspace"><section class="chase-console"><form data-chase-form><label for="chase-editor">${html(t.editor)}</label><p>${html(t.signalRule)}</p><textarea id="chase-editor" class="practice-editor" rows="7" maxlength="4096" spellcheck="false" autocapitalize="off" autocomplete="off" dir="ltr" aria-describedby="chase-keyboard">${html(w.drafts[w.stage])}</textarea><small id="chase-keyboard">${html(t.keyboard)}</small><div class="dialog-actions"><button class="primary" type="submit" data-chase-run disabled>${html(t.run)} ↗</button><button class="text-button" type="button" data-chase-action="debug" disabled>${html(t.debug)}</button><button class="text-button" type="button" data-chase-action="reset">${html(t.reset)}</button></div></form></section>
    <section class="chase-debrief"><div class="chase-feedback" role="status" aria-live="polite"><strong data-chase-status>${html(t.ready)}</strong><p data-chase-detail></p><code data-chase-output dir="ltr"></code></div><button class="primary" type="button" data-chase-action="next" hidden>${html(w.stage===2?t.replay:t.next)} →</button><details class="vault-help"><summary>${html(t.help)}</summary><p>${html(t.hints[w.stage])}</p><pre dir="ltr">${html(w.stage===0?'3.log();\n3.log()':w.stage===1?'let step = 1;\n(step + 1).log()':'let step = 3;\nstep.log();\n(1 + 1).log()')}</pre><p>${html(t.meaning)}</p></details><details class="vault-help"><summary>${html(t.rulesTitle)}</summary><p>${html(t.rules)}</p><p>${html(t.clue)}</p></details></section></div><p data-chase-save role="status">${saveFailed?html(t.noSave):''}</p><p class="vault-footnote">${html(t.local)}</p></section>`;
    const mounted=mountChaseScene(el('[data-chase-scene]'),{role:state.role,puzzle:p,reduced,text:t,onError:()=>{if(disposed||scene!==mounted)return;el('[data-scene-status]').textContent=t.artError;action('reload-art').hidden=false;}});
    scene=mounted;
    mounted.ready.then(ok=>{if(!ok||disposed||scene!==mounted)return;el('[data-scene-status]').hidden=true;controls();});
    if(report){scene.show(report.frames.at(-1)||initial());finish(report);}
  }
  function positions(frame){for(const role of chaseRoles)el(`[data-position="${role}"]`).textContent=frame[role];}
  function controls(){
    const ready=el('[data-chase-scene]').dataset.scene==='ready';
    el('[data-chase-run]').disabled=playing||!ready;action('practice').disabled=playing||!ready;
    action('debug').disabled=playing||!ready;
    action('debug-next').disabled=playing||!ready||!debugMode||debugCursor>=report?.frames.length;
    for(const name of ['debug-back','debug-restart'])action(name).disabled=playing||!ready||!debugMode||debugCursor===0;
    for(const button of root.querySelectorAll('button[data-chase-move]'))button.disabled=playing||!practiceMode||practiceMoves.length>=chasePuzzle(work().stage).maxSignals||report?.outcome==='caught'||report?.outcome==='escaped';
    action('pause').hidden=!playing;action('pause').textContent=paused?t.resume:t.pause;
  }
  function finish(current){
    playing=false;paused=false;report=current;positions(current.frames.at(-1)||initial());controls();
    action('watch').hidden=practiceMode||debugMode||!current.frames.length;action('next').hidden=practiceMode||!current.ok;
    action('copy-plan').hidden=!practiceMode||!practiceMoves.length;
    const error=current.code==='name'?'nameError':current.code;
    el('[data-chase-status]').textContent=practiceMode?t.practiceDone:current.ok?t.won:current.code?t.fix:t[current.outcome];
    el('[data-chase-detail]').textContent=practiceMode?t.practiceReview:current.ok?t.learned[work().stage]:current.code?(current.code==='signals'?t.signalRule:errors[error]||errors.limit):t.retry;
    el('.chase-feedback').dataset.ok=String(current.ok&&!practiceMode);
    el(`[data-chase-role="${state.role}"] small bdi`).textContent=`${work().cleared.length} / 3`;
    for(const [index,item] of [...root.querySelectorAll('.vault-path li')].entries()){
      const cleared=work().cleared.includes(index);item.dataset.cleared=String(cleared);
      item.querySelector('bdi').textContent=cleared?'✓':index+1;
    }
    showTrace(current,current.frames.length);
  }
  const format=(message,values)=>message.replace(/\{(\w+)\}/g,(_,key)=>values[key]??'');
  function stepReason(current,index){
    const frame=current.frames[index],previous=index?current.frames[index-1]:initial(),other=state.role==='police'?'thief':'police';
    const parts=[format(frame.blocked?t.traceBlocked:t.traceMove,{target:frame.blocked?frame.target:frame[state.role],from:frame.from})];
    if(frame[other]!==previous[other])parts.push(t.traceRival);
    if(frame.outcome==='caught')parts.push(format(t.traceCaught,{target:frame.police}));
    if(frame.outcome==='escaped')parts.push(format(t.traceEscaped,{target:frame.thief}));
    return parts.join(' ');
  }
  function showTrace(current,count){
    const panel=el('[data-chase-review]');panel.hidden=!current.frames.length;
    el('[data-chase-debug-controls]').hidden=!debugMode;
    el('[data-chase-debug-count]').textContent=format(t.debugCount,{n:count,total:current.logs.length});
    el('[data-chase-trace-empty]').hidden=count>0;
    el('[data-chase-trace-list]').innerHTML=current.frames.slice(0,count).map((frame,index)=>{
      const names=Object.entries(frame.output.names).map(([name,value])=>`${name} = ${value}`).join(', ');
      return `<li${index===count-1?' aria-current="step"':''}><strong>${html(t.traceSignal)} <bdi dir="ltr">${index+1}</bdi></strong><dl><div><dt>${html(t.traceCode)}</dt><dd><code dir="ltr">${html(current.source.slice(frame.output.start,frame.output.end))} → ${html(frame.output.value)}</code>${names?`<small>${html(t.traceBindings)}: <bdi dir="ltr">${html(names)}</bdi></small>`:''}</dd></div><div><dt>${html(t.tracePositions)}</dt><dd>${html(t.police)} <bdi dir="ltr">${frame.police}</bdi> · ${html(t.thief)} <bdi dir="ltr">${frame.thief}</bdi></dd></div><div><dt>${html(t.traceEvent)}</dt><dd>${html(stepReason(current,index))}</dd></div></dl></li>`;
    }).join('');
    const list=el('[data-chase-trace-list]');list.scrollTop=list.scrollHeight;
    const unused=count===current.frames.length?current.logs.length-current.frames.length:0;
    el('[data-chase-unused]').hidden=!unused;
    el('[data-chase-unused]').textContent=unused?format(t.traceUnused,{n:unused}):'';
  }
  function trace(frame,index){el('[data-chase-trace]').textContent=t.step.replace('{n}',index+1).replace('{move}',frame.signal)+(frame.blocked?` · ${t.blocked}`:'');}
  async function play(current,start=0){
    const token=++generation;playing=true;paused=false;report=current;controls();
    const beginning=start?current.frames[start-1]:initial();
    scene.show(beginning);positions(beginning);showTrace(current,start);
    action('next').hidden=true;action('watch').hidden=true;action('copy-plan').hidden=true;
    el('[data-chase-status]').textContent=t.running;el('[data-chase-detail]').textContent='';el('[data-chase-output]').textContent=current.logs.join(' → ');
    for(let i=start;i<current.frames.length;i++){
      trace(current.frames[i],i);
      const completed=await scene.play(i?current.frames[i-1]:initial(),current.frames[i]);
      if(disposed||token!==generation||!completed){if(!disposed&&token===generation){playing=false;controls();}return;}
      positions(current.frames[i]);
      showTrace(current,i+1);
    }
    if(!disposed&&token===generation)finish(current);
  }
  function resetDisplay(){
    cancel();practiceMode=false;practiceMoves=[];debugMode=false;debugCursor=0;report=null;positions(initial());
    el('[data-chase-review]').hidden=true;el('[data-chase-review]').open=false;
    el('[data-chase-trace-list]').innerHTML='';
    for(const name of ['next','watch','pause','copy-plan'])action(name).hidden=true;
    for(const name of ['detail','output','trace'])el(`[data-chase-${name}]`).textContent='';
    delete el('.chase-feedback').dataset.ok;controls();
  }
  function input(event){
    if(event.target.id!=='chase-editor')return;
    work().drafts[work().stage]=event.target.value;work().submitted=null;resetDisplay();
    el('[data-chase-status]').textContent=t.changed;persist();
  }
  function submit(event){
    if(!event.target.matches('[data-chase-form]'))return;event.preventDefault();if(playing)return;
    practiceMode=false;const current=submitChase(state,el('#chase-editor').value);persist();render();
    if(current.frames.length)play(current);else{el('[data-chase-output]').textContent=current.logs.join(' → ');finish(current);}
  }
  function practiceMove(n){
    const button=el(`button[data-chase-move="${n}"]`);if(!button||button.disabled)return;
    el('[data-chase-scene]').focus({preventScroll:true});
    practiceMoves.push(n);const current=inspectChase(state.role,work().stage,plan(practiceMoves));play(current,current.frames.length-1);
  }
  function debugDisplay(){
    const frame=debugCursor?report.frames[debugCursor-1]:initial();scene.show(frame);positions(frame);
    el('[data-chase-status]').textContent=debugCursor?format(t.debugCount,{n:debugCursor,total:report.logs.length}):t.debugReady;
    el('[data-chase-detail]').textContent='';el('[data-chase-output]').textContent=report.logs.slice(0,debugCursor).join(' → ');
    el('[data-chase-trace]').textContent=debugCursor?stepReason(report,debugCursor-1):'';
    delete el('.chase-feedback').dataset.ok;
    for(const name of ['next','watch','copy-plan'])action(name).hidden=true;
    showTrace(report,debugCursor);controls();
  }
  function startDebug(){
    if(playing||action('debug').disabled)return;
    resetDisplay();const current=inspectChase(state.role,work().stage,el('#chase-editor').value);report=current;
    if(!current.frames.length){el('[data-chase-output]').textContent=current.logs.join(' → ');finish(current);return;}
    debugMode=true;work().submitted=null;persist();
    el('[data-chase-review]').open=true;debugDisplay();action('debug-next').focus();
  }
  async function nextDebug(){
    if(!debugMode||playing||action('debug-next').disabled)return;
    const current=report,index=debugCursor,token=++generation;
    playing=true;paused=false;controls();trace(current.frames[index],index);
    const completed=await scene.play(index?current.frames[index-1]:initial(),current.frames[index]);
    if(disposed||token!==generation||!completed)return;
    playing=false;debugCursor++;debugDisplay();
    if(debugCursor===current.frames.length){submitChase(state,current.source);persist();finish(current);}
    action(debugCursor===current.frames.length?'debug-back':'debug-next').focus({preventScroll:true});
  }
  function pause(value){paused=value;scene.pause(value);controls();}
  function click(event){
    const role=event.target.closest('[data-chase-role]')?.dataset.chaseRole;
    if(role&&chaseRoles.includes(role)){state.role=role;render();persist();return;}
    const move=event.target.closest('button[data-chase-move]')?.dataset.chaseMove;
    if(move){practiceMove(Number(move));return;}
    const name=event.target.closest('[data-chase-action]')?.dataset.chaseAction;
    if(name==='pause'&&playing){pause(!paused);return;}
    if(name==='debug'){startDebug();return;}
    if(name==='debug-next'){nextDebug();return;}
    if((name==='debug-back'||name==='debug-restart')&&debugMode&&!playing&&debugCursor>0){
      debugCursor=name==='debug-back'?debugCursor-1:0;debugDisplay();return;
    }
    if(name==='watch'&&report&&!playing){scene.reset();play(report);return;}
    if(name==='practice'&&!playing){resetDisplay();practiceMode=true;el('[data-chase-status]').textContent=t.practiceReady;controls();el('[data-chase-scene]').focus({preventScroll:true});return;}
    if(name==='copy-plan'&&practiceMode&&!playing&&practiceMoves.length){
      const source=plan(practiceMoves);el('#chase-editor').value=source;
      work().drafts[work().stage]=source;work().submitted=null;resetDisplay();el('[data-chase-status]').textContent=t.changed;persist();el('#chase-editor').focus();return;
    }
    if(name==='reload-art'){render();return;}
    if(name==='reset'){work().drafts[work().stage]=chasePuzzle(work().stage).starter;work().submitted=null;}
    else if(name==='next'){
      if(playing||!report?.ok||practiceMode)return;
      if(work().stage===2){work().stage=0;work().drafts=[0,1,2].map(i=>chasePuzzle(i).starter);work().submitted=null;}
      else if(!advanceChase(state))return;
    }else return;
    render();persist();el('[data-chase-scene]').focus({preventScroll:true});
  }
  function keyboard(event){
    if(!event.target.closest('[data-chase-scene]')||!practiceMode||event.repeat||event.ctrlKey||event.metaKey||event.altKey)return;
    if(/^[1-3]$/.test(event.key)){event.preventDefault();practiceMove(Number(event.key));}
    if(event.key==='Escape'&&playing){event.preventDefault();pause(!paused);}
  }
  const visibility=()=>{if(document.hidden&&playing&&!paused)pause(true);};
  root.addEventListener('input',input);root.addEventListener('submit',submit);root.addEventListener('click',click);root.addEventListener('keydown',keyboard);document.addEventListener('visibilitychange',visibility);render();
  return {dispose(){disposed=true;cancel();scene?.dispose();root.removeEventListener('input',input);root.removeEventListener('submit',submit);root.removeEventListener('click',click);root.removeEventListener('keydown',keyboard);document.removeEventListener('visibilitychange',visibility);}};
}
