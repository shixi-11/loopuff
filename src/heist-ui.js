import {startHeist,pauseHeist,advanceHeist,deployHeist,editHeist,inspectHeist,heistInputs,heistWorld,heistPhase,heistRules} from './heist.js';
import {heistExample} from './heist-strategies.js';
import {createHeistSession} from './heist-session.js';
import {mountHeistScene} from './heist-scene.js';
import {createPursuitClock} from './pursuit-clock.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=ms=>`${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;
export function mountHeist(root,{text:t,errors,model,saveUrl,saveLabel}){
 const session=model.session??=createHeistSession();let s=session.world,scene,clock,disposed=false,ready=false,raf=0,lastHUD=0,lastSave=0,report=null,confirmNew=false,confirmExample=false;
 let notice=session.badSave?t.badSave:s.status==='finished'?t[s.outcome]:session.restored||s.activeMs?t.restored:t.ready;
 const el=q=>root.querySelector(q),button=id=>el(`[data-heist="${id}"]`);
 const persist=()=>session.persist();
 function pause(reason='paused'){if(s.status!=='running')return;pauseHeist(s);clock.reset();notice=t[reason]||t.paused;update();persist();}
 function newClock(){clock=createPursuitClock({state:s,advance:ms=>advanceHeist(s,ms),pause});}
 function history(){el('[data-heist-history]').innerHTML=session.history.length?session.history.slice().reverse().map(row=>`<li><span>${esc(t[row.outcome])}</span><bdi dir="ltr">${time(row.activeMs)} · #${row.seed}</bdi></li>`).join(''):`<li>${esc(t.noHistory)}</li>`;}
 function showReport(){
  const out=el('[data-heist-report]'),call=el('[data-heist-call]');call.hidden=!report?.ok;
  if(!report){out.textContent=t.idle;return;}
  if(!report.ok){const code=report.code==='name'?'nameError':report.code;out.textContent=`${t.error}: ${report.code==='signals'?t.signals:report.code==='waiting'?t.waiting:errors[code]||errors.limit}${report.host?' · '+t.hostError:report.position!==undefined?' · '+t.position+' '+(report.position+1):''}`;return;}
  out.textContent=`${t.result}: ${report.command} · ${t.actions[report.command-1]}`;call.textContent=`${report.call}\n→ ${report.command}`;
 }
 function update(){
  if(disposed)return;el('[data-heist-time]').textContent=time(s.activeMs);el('[data-heist-budget]').hidden=s.mode!=='timed';el('[data-heist-left]').textContent=time(Math.max(0,heistWorld(s.seed).timeLimitMs-s.activeMs));
  el('[data-heist-phase]').textContent=s.status==='finished'?t[s.outcome]:t.phases[heistPhase(s)];el('[data-heist-action]').textContent=t.actions[s.command-1];el('[data-heist-vision]').textContent=s.hidden?t.hidden:s.visible?t.visible:t.clear;
  for(const name of ['energy','alarm']){el(`[data-heist-meter="${name}"]`).value=s[name]/1000;el(`[data-heist-number="${name}"]`).textContent=String(Math.floor(s[name]/1000));}
  for(const [name,value]of Object.entries(heistInputs(s)))el(`[data-heist-input="${name}"]`).textContent=String(value);
  el('[data-heist-position]').textContent=`${(s.x/1000).toFixed(1)} m`;el('[data-heist-decisions]').textContent=String(s.decisions);
  button('start').disabled=!ready||session.badSave||session.saveFailed||s.status==='finished';button('start').textContent=s.status==='finished'?t.finished:s.status==='running'?t.pause:s.decisions&&s.draft===s.strategy?t.resume:t.start;
  button('deploy').disabled=!ready||session.badSave||session.saveFailed||s.status==='finished';button('inspect').disabled=session.badSave;el('[data-heist-status]').textContent=s.status==='finished'?t[s.outcome]:notice;
  el('[data-heist-save]').textContent=session.badSave?t.badSave:session.saveFailed?t.saveFailed:'';
  el('[data-heist-draft]').textContent=s.draft===s.strategy?'':t.notDeployed;
  el('[data-heist-use]').hidden=s.useMs===0;el('[data-heist-use]').value=s.useMs;el('[data-heist-use]').max=heistRules.operationMs[heistPhase(s)]??1;
 }
 function resume(){
  if(!ready||session.badSave||session.saveFailed||s.status==='finished')return;if(s.status==='running'){pause();return;}
  if(document.hidden||!document.hasFocus()){notice=t.background;update();return;}
  const result=startHeist(s);if(!result.ok){report=result;showReport();notice=t.error;update();persist();return;}
  if(!result.resumed){report=result;showReport();}clock.reset();notice=t.running;el('.heist-scene').focus({preventScroll:true});update();persist();
 }
 root.innerHTML=`<section class="heist-page"><header class="heist-heading"><div><span class="eyebrow">${esc(t.tag)}</span><h1 id="learning-title">${esc(t.title)}</h1><p>${esc(t.intro)}</p></div><details class="heist-settings"><summary>${esc(t.settings)}</summary><div><label>${esc(t.mode)}<select data-heist-mode><option value="practice"${s.mode==='practice'?' selected':''}>${esc(t.practice)}</option><option value="timed"${s.mode==='timed'?' selected':''}>${esc(t.timed)}</option></select></label><label>${esc(t.seed)}<input data-heist-seed type="text" inputmode="numeric" value="${s.seed}" maxlength="10" dir="ltr"></label><p>${esc(t.seedNote)}</p><button type="button" data-heist="new">${esc(t.newRun)}</button><a href="${esc(saveUrl)}">${esc(saveLabel)}</a></div></details></header>
 <div class="heist-workspace"><section class="heist-theatre"><div class="heist-hud"><div><span>${esc(t.elapsed)}</span><bdi role="timer" aria-live="off" data-heist-time dir="ltr"></bdi></div><div data-heist-budget><span>${esc(t.budget)}</span><bdi data-heist-left dir="ltr"></bdi></div><div class="heist-objective"><span>${esc(t.phase)}</span><strong data-heist-phase></strong></div><button class="primary" type="button" data-heist="start" disabled>${esc(t.start)}</button><button data-heist="focus" type="button">${esc(t.focus)}</button></div><div class="heist-scene" role="group" aria-label="${esc(t.map)}" tabindex="0"><canvas aria-hidden="true"></canvas><p data-heist-loading>${esc(t.loading)}</p></div><div class="heist-resources">${['energy','alarm'].map(name=>`<label><span>${esc(t[name])}</span><meter data-heist-meter="${name}" min="0" max="100"></meter><bdi dir="ltr" data-heist-number="${name}"></bdi></label>`).join('')}<span data-heist-vision></span></div><div class="heist-controls"><span data-heist-action></span><progress data-heist-use aria-label="${esc(t.use)}" max="3000" value="0" hidden></progress></div><p data-heist-status role="status" aria-live="polite"></p></section>
 <section class="heist-code"><h2>${esc(t.editor)}</h2><p>${esc(t.contract)}</p><ol class="heist-action-key" aria-label="${esc(t.help)}">${t.actions.map((label,i)=>`<li><bdi dir="ltr">${i+1}</bdi><span>${esc(label)}</span></li>`).join('')}</ol><form data-heist-form><label class="sr-only" for="heist-editor">${esc(t.editor)}</label><textarea id="heist-editor" dir="ltr" rows="11" maxlength="3000" autocomplete="off" autocapitalize="off" spellcheck="false">${esc(s.draft)}</textarea><div class="heist-code-actions"><button type="submit" class="primary" data-heist="deploy">${esc(t.deploy)}</button><button type="button" data-heist="inspect">${esc(t.inspect)}</button></div></form><small data-heist-draft></small><p role="status" data-heist-report></p><pre data-heist-call dir="ltr" hidden></pre><details class="heist-inputs"><summary>${esc(t.input)}</summary><dl>${Object.keys(heistInputs(s)).map(name=>`<div><dt><code>${name}</code></dt><dd data-heist-input="${name}" dir="ltr"></dd></div>`).join('')}</dl><p>${esc(t.inputNote)}</p></details><details class="heist-hint"><summary>${esc(t.hint)}</summary><p>${esc(t.hintText)}</p><button type="button" data-heist="example">${esc(t.example)}</button></details></section></div>
 <details class="heist-help"><summary>${esc(t.help)}</summary><p>${esc(t.rules)}</p><ol>${t.actions.map((a,i)=>`<li><code>${i+1}</code> ${esc(a)}</li>`).join('')}</ol></details><details class="heist-history"><summary>${esc(t.history)}</summary><p>${esc(t.recordNote)}</p><dl><div><dt>${esc(t.positionNow)}</dt><dd data-heist-position dir="ltr"></dd></div><div><dt>${esc(t.decisionCount)}</dt><dd data-heist-decisions dir="ltr"></dd></div></dl><ol data-heist-history></ol></details><p data-heist-save role="status"></p><a href="${esc(saveUrl)}">${esc(saveLabel)}</a></section>`;
 newClock();history();showReport();update();scene=mountHeistScene(el('.heist-scene'),{getState:()=>s,text:t,onError:()=>{ready=false;pause();notice=t.artError;update();}});
 scene.ready.then(ok=>{if(disposed)return;ready=ok;el('[data-heist-loading]').hidden=ok;if(!ok)el('[data-heist-loading]').textContent=t.artError;update();});
 function click(event){const target=event.target.closest('button[data-heist]');if(!target)return;const action=target.dataset.heist;
  if(action==='start')resume();
  if(action==='inspect'){pause();report=inspectHeist(s,s.draft);showReport();}
  if(action==='focus'){const expanded=el('.heist-theatre').classList.toggle('is-expanded');target.textContent=expanded?t.closeFocus:t.focus;scene.resize();}
  if(action==='example'){pause();if(!confirmExample&&s.draft!==heistExample){confirmExample=true;target.textContent=t.confirmExample;return;}editHeist(s,heistExample);el('#heist-editor').value=s.draft;target.textContent=t.example;confirmExample=false;report=null;showReport();update();persist();}
  if(action==='new'){
   pause();const seedText=el('[data-heist-seed]').value;if(!/^\d{1,10}$/.test(seedText)||Number(seedText)>0xffffffff){notice=t.invalidSeed;update();return;}
   if(!confirmNew&&(s.activeMs>0||session.badSave)&&s.status!=='finished'){confirmNew=true;target.textContent=t.confirmNew;return;}
   s=session.replace(Number(seedText),el('[data-heist-mode]').value,s.draft);newClock();report=null;confirmNew=false;target.textContent=t.newRun;el('.heist-settings').open=false;notice=t.ready;history();showReport();update();scene.draw();button('start').focus({preventScroll:true});persist();
  }
 }
 function submit(event){if(!event.target.matches('[data-heist-form]'))return;event.preventDefault();pause();report=deployHeist(s,s.draft);showReport();if(report.ok)resume();else{notice=t.error;update();persist();}}
 function input(event){if(event.target.id==='heist-editor'){editHeist(s,event.target.value);clock.reset();notice=t.paused;report=null;confirmExample=false;button('example').textContent=t.example;showReport();update();persist();}else if(event.target.matches('[data-heist-mode],[data-heist-seed]')){pause();confirmNew=false;button('new').textContent=t.newRun;}}
 function visibility(){if(document.hidden)pause('background');}function blur(){pause('background');}
 function key(event){if(event.key==='Escape'){if(el('.heist-theatre').classList.contains('is-expanded')){button('focus').click();button('focus').focus();}else pause();}}
 function settings(){if(el('.heist-settings').open)pause();}
 function tick(now){if(disposed)return;const before=s.status;clock.frame(now,{visible:!document.hidden,focused:document.hasFocus()});scene.draw();
  if(before==='running'&&s.status==='finished'){notice=t[s.outcome];persist();history();update();}
  if(before==='running'&&s.status==='paused'&&s.lastReport?.ok===false){report=s.lastReport;showReport();notice=t.error;update();persist();}
  if(now-lastHUD>=100){lastHUD=now;update();}if(s.status==='running'&&now-lastSave>=5000){lastSave=now;persist();}raf=requestAnimationFrame(tick);
 }
 root.addEventListener('click',click);root.addEventListener('submit',submit);root.addEventListener('input',input);root.addEventListener('keydown',key);el('.heist-settings').addEventListener('toggle',settings);document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',blur);window.addEventListener('pagehide',blur);
 const unsubscribe=session.subscribe(()=>{if(disposed)return;s=session.world;if(session.saveFailed){clock.reset();notice=t.saveFailed;}history();update();});raf=requestAnimationFrame(tick);
 return {dispose(){pause();disposed=true;unsubscribe();cancelAnimationFrame(raf);scene.dispose();root.removeEventListener('click',click);root.removeEventListener('submit',submit);root.removeEventListener('input',input);root.removeEventListener('keydown',key);el('.heist-settings').removeEventListener('toggle',settings);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',blur);window.removeEventListener('pagehide',blur);}};
}
