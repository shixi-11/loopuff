import {startPursuit,pausePursuit,advancePursuit,deployPursuit,inspectPursuit,setPursuitRoute,pursuitInputs} from './pursuit.js';
import {persistPursuitPractice} from './pursuit-practice.js';
import {mountPursuitPractice} from './pursuit-practice-ui.js';
import {mountPursuitScene} from './pursuit-scene.js';
import {createPursuitClock} from './pursuit-clock.js';
import {createPursuitSession} from './pursuit-session.js';
export {loadPursuit} from './pursuit-session.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=ms=>`${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;
export function mountPursuit(root,{text:t,practiceText,roles,errors,reduced,saveUrl,saveLabel,model}){
 const session=model.session??=createPursuitSession();
 let world=session.world,history=session.history,badSave=session.badSave,scene=null,disposed=false,raf=0,lastHUD=0,lastSave=0,saveFailed=session.saveFailed,notice=badSave?t.badSave:world.status==='finished'?t[world.outcome]:session.restored||world.activeMs?t.savedPaused:t.ready,report=null,lastReport=null,ready=false,confirmNew=false,keySprint=false,sprintPointer=null,jump=false,seenEvent=world.eventSerial;
 const el=selector=>root.querySelector(selector),button=name=>el(`[data-pursuit="${name}"]`);
 let clock,practice=null,stageWasPending=!!model.practice?.pending;
 function createClock(){clock=createPursuitClock({state:world,advance:elapsed=>{advancePursuit(world,elapsed,{sprint:keySprint||sprintPointer!==null,jump});jump=false;},pause:reason=>pause(reason)});}
 createClock();
 const persist=()=>session.persist();
 function pause(reason='paused'){
  if(world.status!=='running')return;pausePursuit(world);clock.reset();keySprint=false;sprintPointer=null;jump=false;notice=t[reason]||t.paused;updateHUD();persist();
 }
 function recordFinish(){
  if(!session.finish())return;
  el('.pursuit-history ol').innerHTML=history.map(h=>`<li>${esc(roles[h.role])} · <bdi dir="ltr">${time(h.activeMs)}</bdi> · ${esc(h.outcome==='caught'?t.caught:t.escaped)}</li>`).join('');
 }
 function render(){
  practice?.dispose();
  root.innerHTML=`<section class="pursuit-page"><header class="pursuit-heading"><div><span class="eyebrow">${esc(t.tag)}</span><h1 id="learning-title">${esc(roles.title)}</h1><p>${esc(t.intro)}</p></div><details class="pursuit-settings"><summary>${esc(t.settings)}</summary><div><label>${esc(t.role)}<select data-pursuit-role>${['police','thief'].map(role=>`<option value="${role}"${world.role===role?' selected':''}>${esc(roles[role])}</option>`).join('')}</select></label><label>${esc(t.difficulty)}<select data-pursuit-difficulty>${['calm','standard','expert'].map((id,i)=>`<option value="${id}"${world.difficulty===id?' selected':''}>${esc(t.difficulties[i])}</option>`).join('')}</select></label><p>${esc(t.resetNote)}</p><button type="button" data-pursuit="new">${esc(t.newRun)}</button><a href="${esc(saveUrl)}">${esc(t.badSave===notice?errors.save||t.noSave:t.history)}</a></div></details></header>
  <section class="pursuit-theatre"><div class="pursuit-hud"><div><span>${esc(t.elapsed)}</span><bdi role="timer" aria-live="off" dir="ltr" data-pursuit-time>${time(world.activeMs)}</bdi></div><div><span>${esc(t.round)}</span><bdi data-pursuit-round dir="ltr"></bdi></div><div class="pursuit-energy">${['police','thief'].map(role=>`<label><span>${esc(roles[role])} · ${esc(t.energy)}</span><meter min="0" max="100" value="100" data-pursuit-energy="${role}"></meter><bdi data-pursuit-energy-number="${role}" dir="ltr"></bdi></label>`).join('')}</div><button type="button" data-pursuit="focus">${esc(t.focus)}</button></div>
  <div class="pursuit-scene" tabindex="0" role="group" aria-label="${esc(t.controls)}"><canvas aria-hidden="true"></canvas><p data-pursuit-loading>${esc(t.loading)}</p></div>
  <div class="pursuit-controls"><div class="pursuit-actions"><button class="primary" type="button" data-pursuit="start" disabled>${esc(t.start)}</button><button type="button" data-pursuit="jump" disabled>${esc(t.jump)} <kbd>Space</kbd></button><button type="button" data-pursuit="sprint" disabled>${esc(t.sprint)} <kbd>Shift</kbd></button></div><div class="pursuit-route" role="group" aria-label="${esc(t.route)}"><small>${esc(t.route)}</small>${[0,1].map(n=>`<button type="button" data-pursuit-path="${n}" aria-pressed="${world.nextRoute===n}" title="${esc(n?t.alleyHint:t.wideHint)}">${esc(n?t.alley:t.wide)}</button>`).join('')}</div></div><p class="pursuit-status" role="status" aria-live="polite" data-pursuit-status>${esc(notice)}</p><p class="pursuit-keyboard">${esc(t.controls)}</p></section>
  <section class="pursuit-result" hidden><h2 data-pursuit-result></h2><p data-pursuit-outcome></p><p>${esc(t.resultNote)}</p><dl><div><dt>${esc(t.collisions)}</dt><dd data-pursuit-collisions></dd></div><div><dt>${esc(t.clears)}</dt><dd data-pursuit-clears></dd></div></dl></section>
  <details class="pursuit-strategy"><summary>${esc(t.strategy)}</summary><div data-pursuit-practice-root></div><p>${esc(t.strategyNote)}</p><p>${esc(t.signals)}</p><dl class="pursuit-inputs" aria-label="${esc(t.inputValues)}">${Object.keys(pursuitInputs(world)).map(name=>`<div><dt>${esc(practiceText[name+'Meaning'])} <code dir="ltr">${name}</code></dt><dd data-pursuit-input="${name}" dir="ltr"></dd></div>`).join('')}</dl><p>${esc(practiceText.obstacleNote)} ${esc(practiceText.gapNote)}</p><form data-pursuit-form><label for="pursuit-editor">${esc(t.editor)}</label><textarea id="pursuit-editor" dir="ltr" rows="6" maxlength="3000" autocomplete="off" autocapitalize="off" spellcheck="false">${esc(world.draft)}</textarea><div class="pursuit-code-actions"><button class="primary" type="submit">${esc(t.deploy)}</button><button type="button" data-pursuit="inspect">${esc(t.inspect)}</button><button type="button" data-pursuit="example">${esc(t.restoreExample)}</button></div></form><p role="status" aria-live="polite" data-pursuit-report>${esc(t.idlePlan)}</p><pre class="pursuit-code-trace" dir="ltr" hidden></pre></details>
  <details class="pursuit-help"><summary>${esc(t.help)}</summary><p>${esc(t.rules)}</p><p>${esc(t.minimum)}</p><p>${esc(t.wideHint)} · ${esc(t.alleyHint)}</p></details><details class="pursuit-history"><summary>${esc(t.history)}</summary><ol>${history.length?history.map(h=>`<li>${esc(roles[h.role])} · <bdi dir="ltr">${time(h.activeMs)}</bdi> · ${esc(h.outcome==='caught'?t.caught:t.escaped)}</li>`).join(''):`<li>${esc(t.noHistory)}</li>`}</ol></details><p data-pursuit-save role="status"></p></section>`;
  practice=mountPursuitPractice(el('[data-pursuit-practice-root]'),{text:practiceText,errors,model,getWorld:()=>world,pause,canStage:()=>!badSave&&!saveFailed,onStage:async previous=>{const target=world,source=world.draft;report=null;lastReport=world.lastReport;showReport();notice=practiceText.saving;updateHUD();const saved=await persistPursuitPractice(session,target,source,previous);model.practice.pending=false;if(!disposed){notice=saved?practiceText.staged:practiceText.saveError;updateHUD();if(saved){const editor=el('#pursuit-editor');editor.focus({preventScroll:true});editor.scrollIntoView({block:'center',behavior:'instant'});}}return saved;}});
  const mounted=mountPursuitScene(el('.pursuit-scene'),{getState:()=>world,text:t,roles,onError:()=>{if(disposed||scene!==mounted)return;notice=t.artError;ready=false;updateHUD();}});scene=mounted;
  el('.pursuit-settings a').textContent=saveLabel;
  mounted.ready.then(ok=>{if(disposed||scene!==mounted)return;ready=ok;el('[data-pursuit-loading]').hidden=ok;if(!ok)el('[data-pursuit-loading]').textContent=t.artError;updateHUD();});
  el('.pursuit-settings').addEventListener('toggle',()=>{if(el('.pursuit-settings').open)pause();});
  el('.pursuit-strategy').addEventListener('toggle',()=>{if(el('.pursuit-strategy').open)pause();});
  updateHUD();
 }
 function updateHUD(){
  if(disposed)return;practice?.refresh();const staging=!!model.practice?.pending;if(stageWasPending&&!staging){el('#pursuit-editor').value=world.draft;report=null;showReport();}stageWasPending=staging;for(const control of root.querySelectorAll('[data-pursuit-form] button,#pursuit-editor'))control.disabled=staging;button('new').disabled=staging;const a=world.actors[world.role];el('[data-pursuit-time]').textContent=time(world.activeMs);el('[data-pursuit-round]').textContent=a.road==='exit'?t.exit:`${a.section+1} / 20${a.road==='thief'&&world.role==='police'?' ↶':''}`;
  for(const role of ['police','thief']){el(`[data-pursuit-energy="${role}"]`).value=world.actors[role].energy;el(`[data-pursuit-energy-number="${role}"]`).textContent=String(Math.floor(world.actors[role].energy));}
  for(const [name,value]of Object.entries(pursuitInputs(world)))el(`[data-pursuit-input="${name}"]`).textContent=String(value);
  for(const route of root.querySelectorAll('[data-pursuit-path]')){route.setAttribute('aria-pressed',String(Number(route.dataset.pursuitPath)===world.nextRoute));route.disabled=world.status==='finished'||badSave;}
  button('start').disabled=!ready||badSave||world.status==='finished'||saveFailed||staging;
  button('start').textContent=world.status==='finished'?((world.outcome==='caught')===(world.role==='police')?t.won:t.lost):world.status==='running'?t.pause:world.draft!==world.strategy?t.deploy:world.status==='ready'?t.start:t.resume;
  button('jump').disabled=button('sprint').disabled=world.status!=='running';
  el('[data-pursuit-status]').textContent=notice;
  if(world.lastReport!==lastReport){lastReport=world.lastReport;if(lastReport){report=lastReport;showReport();}}
  if(world.status==='finished'){
   el('.pursuit-result').hidden=false;const win=world.outcome==='caught'?world.role==='police':world.role==='thief';el('[data-pursuit-result]').textContent=win?t.won:t.lost;el('[data-pursuit-outcome]').textContent=t[world.outcome];el('[data-pursuit-collisions]').textContent=String(a.collisions);el('[data-pursuit-clears]').textContent=String(a.clears);
  }
 }
 function showReport(){
  const target=el('[data-pursuit-report]'),trace=el('.pursuit-code-trace');trace.hidden=!report?.ok;
  if(!report){target.textContent=t.idlePlan;return;}
  if(!report.ok){const error=report.code==='name'?'nameError':report.code;target.textContent=`${t.error}: ${report.code==='signals'?t.signals:errors[error]||errors.limit}${report.position!==undefined?` · ${t.position} ${report.position+1}`:''}`;return;}
  target.textContent=`${t.plan}: ${report.logs.join(' → ')}`;
  const source=world.draft===world.strategy?world.strategy:world.draft,output=report.outputs[0];trace.innerHTML=output?`${esc(source.slice(0,output.start))}<mark>${esc(source.slice(output.start,output.end))}</mark>${esc(source.slice(output.end))}`:esc(source);
 }
 function resume(){
  if(!ready||badSave||saveFailed||model.practice?.pending||world.status==='finished')return;
  if(world.status==='running'){pause();return;}
  if(world.status==='ready'){
   const role=el('[data-pursuit-role]').value,difficulty=el('[data-pursuit-difficulty]').value;
   if(role!==world.role||difficulty!==world.difficulty){world=session.replace(role,difficulty,world.draft);createClock();lastReport=null;}
  }
  if(world.status==='ready'||world.draft!==world.strategy){report=deployPursuit(world,world.draft);lastReport=world.lastReport;showReport();if(!report.ok){notice=t.error;updateHUD();persist();return;}}
  el('.pursuit-strategy').open=false;el('.pursuit-settings').open=false;startPursuit(world);clock.reset();notice=t.running;el('.pursuit-scene').focus({preventScroll:true});updateHUD();persist();
 }
 function tick(now){
  if(disposed)return;const before=world.status;clock.frame(now,{visible:!document.hidden,focused:document.hasFocus()});scene?.draw();
  if(before==='running'&&world.status==='finished'){notice=t[world.outcome];recordFinish();updateHUD();}
  else if(before==='running'&&world.status==='paused'&&world.lastReport?.ok===false){notice=t.error;el('.pursuit-strategy').open=true;updateHUD();persist();}
  if(world.eventSerial!==seenEvent){seenEvent=world.eventSerial;const event=world.events.at(-1);if(event&&world.status==='running')notice=`${roles[event.role]} · ${t.events[event.kind]||t.running}`;}
  if(now-lastHUD>=100){lastHUD=now;updateHUD();}
  if(world.status==='running'&&now-lastSave>=5000){lastSave=now;persist();}
  raf=requestAnimationFrame(tick);
 }
 function click(event){
  const target=event.target.closest('button');if(!target)return;
  if(target.dataset.pursuitPath!==undefined){setPursuitRoute(world,Number(target.dataset.pursuitPath));updateHUD();persist();return;}
  const action=target.dataset.pursuit;
  if(action==='start'){resume();return;}
  if(action==='jump'){jump=true;el('.pursuit-scene').focus({preventScroll:true});return;}
  if(action==='focus'){el('.pursuit-theatre').classList.toggle('is-expanded');target.textContent=el('.pursuit-theatre').classList.contains('is-expanded')?t.closeFocus:t.focus;scene?.resize();return;}
  if(action==='inspect'){pause();report=inspectPursuit(world,world.draft);lastReport=world.lastReport;showReport();return;}
  if(action==='example'){if(model.practice?.pending)return;pause();world.draft='1.log()';el('#pursuit-editor').value=world.draft;report=null;showReport();persist();return;}
  if(action==='new'){
   if(model.practice?.pending)return;pause();if(!confirmNew&&(world.activeMs>0||badSave)&&world.status!=='finished'){confirmNew=true;target.textContent=t.confirmNew;return;}
   const role=el('[data-pursuit-role]').value,difficulty=el('[data-pursuit-difficulty]').value,draft=world.draft;
   world=session.replace(role,difficulty,draft);badSave=false;saveFailed=false;report=null;lastReport=null;confirmNew=false;seenEvent=0;notice=t.ready;scene?.dispose();createClock();render();button('start').focus({preventScroll:true});persist();
  }
 }
 function submit(event){if(!event.target.matches('[data-pursuit-form]'))return;event.preventDefault();if(model.practice?.pending)return;pause();report=deployPursuit(world,world.draft);lastReport=world.lastReport;showReport();if(report.ok)resume();else{notice=t.error;updateHUD();persist();}}
 function input(event){if(event.target.id!=='pursuit-editor'||model.practice?.pending)return;pause();world.draft=event.target.value;report=null;lastReport=world.lastReport;showReport();persist();updateHUD();}
 function keydown(event){if(event.key==='Escape'){if(el('.pursuit-theatre').classList.contains('is-expanded')){event.preventDefault();button('focus').click();}else if(!event.target.closest('input,textarea,select'))pause();return;}if(world.status==='running'&&event.key==='Shift'&&!event.target.closest('input,textarea,select')){keySprint=true;return;}if(event.target.closest('input,textarea,select,button,a,summary')||event.ctrlKey||event.metaKey||event.altKey)return;if(world.status!=='running')return;if(event.code==='Space'){event.preventDefault();if(!event.repeat)jump=true;}}
 function keyup(event){if(event.key==='Shift')keySprint=false;}
 function pointerdown(event){if(event.button!==0||!event.target.closest('[data-pursuit="sprint"]')||world.status!=='running')return;sprintPointer=event.pointerId;event.preventDefault();}
 function pointerup(event){if(event.pointerId===sprintPointer)sprintPointer=null;}
 function hidden(){if(document.hidden)pause('background');}
 function blur(){pause('background');}
 root.addEventListener('click',click);root.addEventListener('submit',submit);root.addEventListener('input',input);root.addEventListener('keydown',keydown);root.addEventListener('keyup',keyup);root.addEventListener('pointerdown',pointerdown);window.addEventListener('pointerup',pointerup);window.addEventListener('pointercancel',pointerup);window.addEventListener('keyup',keyup);document.addEventListener('visibilitychange',hidden);window.addEventListener('blur',blur);window.addEventListener('pagehide',blur);
 render();const unsubscribe=session.subscribe(()=>{if(disposed)return;saveFailed=session.saveFailed;badSave=session.badSave;if(saveFailed){clock.reset();keySprint=false;sprintPointer=null;jump=false;notice=t.noSave;}el('[data-pursuit-save]').textContent=saveFailed?t.noSave:'';updateHUD();});raf=requestAnimationFrame(tick);
 return {dispose(){pause();disposed=true;practice?.dispose();unsubscribe();cancelAnimationFrame(raf);scene?.dispose();root.removeEventListener('click',click);root.removeEventListener('submit',submit);root.removeEventListener('input',input);root.removeEventListener('keydown',keydown);root.removeEventListener('keyup',keyup);root.removeEventListener('pointerdown',pointerdown);window.removeEventListener('pointerup',pointerup);window.removeEventListener('pointercancel',pointerup);window.removeEventListener('keyup',keyup);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('blur',blur);window.removeEventListener('pagehide',blur);}};
}
