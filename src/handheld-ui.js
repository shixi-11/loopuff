import {cartridges,gameCommands,newHandheld,handheldInput,compileHandheld,applyHandheld} from './handheld.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=ms=>`${Math.floor(ms/60000).toString().padStart(2,'0')}:${Math.floor(ms/1000)%60<10?'0':''}${Math.floor(ms/1000)%60}`;
export function handheldTeaser(t,url){return `<a class="home-handheld-link" data-action="open-play" href="${esc(url)}"><div class="mini-handheld" aria-hidden="true"><div class="mini-screen"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><span>✚</span><b>● ●</b></div><div><span class="eyebrow">TOLANG / PLAY</span><h2>${esc(t.title)}</h2><p>${esc(t.intro)}</p><strong>${esc(t.open)} ↗</strong></div></a>`;}
export function mountHandheld(root,{text:t,errors,model={},onSelect=()=>{}}){
 model.session??=newHandheld(2741);model.consoleSource??='choose(1);\nstart();';model.strategies??={};
 const session=model.session;let disposed=false,raf=0,last=0,autoClock=0,heldClock=0,streamClock=0,pulseTime=0,pulse=null,pending=[],stream=[],automaticActions=[],held=new Set(),notice='',dirty=true;
 const el=selector=>root.querySelector(selector),cart=()=>cartridges[session.selected];
 root.innerHTML=`<section class="handheld-station" aria-labelledby="handheld-title"><header><span class="eyebrow">LOOPUFF / 01</span><h2 id="handheld-title">${esc(t.title)}</h2><p>${esc(t.intro)}</p></header><div class="handheld-workbench"><section class="handheld-device" aria-label="${esc(t.device)}"><div class="handheld-top"><span>LOOPUFF</span><i aria-hidden="true"></i><span>TOLANG</span></div><div class="handheld-bezel"><div class="handheld-screen-top"><span data-game-name></span><bdi data-game-time dir="ltr">00:00</bdi></div><canvas class="handheld-screen" width="320" height="240" tabindex="0" aria-label="${esc(t.screen)}"></canvas><div class="handheld-screen-bottom"><span data-game-state role="status"></span><span>${esc(t.score)} <bdi data-game-score dir="ltr">0</bdi></span></div></div><div class="handheld-buttons"><div class="handheld-dpad"><button type="button" data-pad="up" class="pad-up" aria-label="${esc(t.up)}">↑</button><button type="button" data-pad="left" class="pad-left" aria-label="${esc(t.left)}">←</button><span aria-hidden="true"></span><button type="button" data-pad="right" class="pad-right" aria-label="${esc(t.right)}">→</button><button type="button" data-pad="down" class="pad-down" aria-label="${esc(t.down)}">↓</button></div><div class="handheld-ab"><button type="button" data-pad="a">A</button><button type="button" data-pad="b">B</button></div></div><p class="handheld-button-help" data-game-help></p><div class="handheld-system"><button type="button" data-machine="start">${esc(t.start)}</button><button type="button" data-machine="pause">${esc(t.pause)}</button><button type="button" data-machine="finish">${esc(t.finish)}</button></div></section><section class="handheld-code"><label for="handheld-game">${esc(t.select)}</label><select id="handheld-game">${t.games.map((game,index)=>`<option value="${index}"${index===session.selected?' selected':''}>0${index+1} / ${esc(game)}</option>`).join('')}</select><p>${esc(t.first)}</p><form id="handheld-form"><label for="handheld-editor">${esc(t.console)}</label><textarea id="handheld-editor" rows="5" maxlength="4096" dir="ltr" spellcheck="false" autocomplete="off" autocapitalize="off">${esc(model.consoleSource)}</textarea><button type="submit" class="primary">${esc(t.run)} ▶</button></form><p class="handheld-notice" data-handheld-notice role="status" aria-live="polite"></p><details class="handheld-command-guide" open><summary>${esc(t.commands)}</summary><p>${esc(t.commandNote)}</p><dl><div><dt><code dir="ltr">choose(1)</code></dt><dd>${esc(t.chooseNote)}</dd></div><div><dt><code dir="ltr">start() / pause() / finish()</code></dt><dd>${esc(t.lifecycleNote)}</dd></div><div><dt><code dir="ltr" data-motion-commands></code></dt><dd>${esc(t.motionNote)}</dd></div></dl></details><details class="handheld-autopilot"><summary>${esc(t.autopilot)}</summary><p>${esc(t.autoNote)}</p><label for="handheld-strategy">${esc(t.strategy)}</label><textarea id="handheld-strategy" rows="5" maxlength="4096" dir="ltr" spellcheck="false" autocomplete="off" autocapitalize="off"></textarea><div><button type="button" class="primary" data-machine="auto">${esc(t.autoApply)}</button><button type="button" data-machine="manual">${esc(t.manual)}</button></div><h3>${esc(t.observations)}</h3><pre data-game-input dir="ltr"></pre></details></section></div></section>`;
 const canvas=el('canvas'),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
 function paint(){
  if(disposed)return;el('[data-game-name]').textContent=t.games[session.selected];el('[data-game-time]').textContent=clock(session.activeMs);el('[data-game-score]').textContent=session.world.score;
  el('[data-game-state]').textContent=t[session.world.over?(session.world.won?'won':'over'):session.status]+(session.automatic?' · '+t.autopilot:'');
  el('[data-handheld-notice]').textContent=notice;
  el('[data-game-input]').textContent=Object.entries(handheldInput(session)).map(([key,value])=>`${key} = ${value}`).join('\n');
  cart().draw(ctx,session.world,320,240);dirty=false;
 }
 function selection(){
  held.clear();pending=[];automaticActions=[];pulse=null;pulseTime=0;el('#handheld-game').value=String(session.selected);el('#handheld-strategy').value=model.strategies[cart().id]??cart().strategy;
  el('[data-game-help]').textContent=t.help[session.selected];
  el('.handheld-code>p').hidden=session.selected!==0;
  el('[data-game-input]').setAttribute('aria-label',t.inputNotes[session.selected]);
  if(!el('[data-game-input-note]'))el('[data-game-input]').insertAdjacentHTML('beforebegin','<p data-game-input-note></p>');
  el('[data-game-input-note]').textContent=t.inputNotes[session.selected];
  el('[data-motion-commands]').textContent=session.selected===0?'left(); right(); rotate(); down(); drop()':'left(); right(); up(); down(); fire()';dirty=true;
 }
 function commands(values){if(values.some(value=>value>=1001)){release();automaticActions=[];session.automatic=false;}const old=session.selected,actions=applyHandheld(session,values);if(old!==session.selected||values.some(v=>v>=1001&&v<=1003)){selection();onSelect(session.selected);}dirty=true;return actions;}
 function error(error){stream=[];automaticActions=[];session.automatic=false;if(session.status==='running')session.status='paused';notice=t.invalid+(errors[error.code]?' '+errors[error.code]:'');dirty=true;}
 function submit(event){if(event.target.id!=='handheld-form')return;event.preventDefault();try{const report=compileHandheld(model.consoleSource,session);takeManual();release();stream=report.commands;streamClock=.12;notice=report.commands.length?t.applied:t.none;}catch(e){error(e);}paint();}
 function input(event){if(event.target.id==='handheld-editor'){model.consoleSource=event.target.value;notice=t.changed;}if(event.target.id==='handheld-strategy'){model.strategies[cart().id]=event.target.value;session.automatic=false;notice=t.changed;}dirty=true;}
 function change(event){if(event.target.id==='handheld-game'){const selected=Number(event.target.value);if(model.consoleSource===`choose(${session.selected+1});\nstart();`){model.consoleSource=`choose(${selected+1});\nstart();`;el('#handheld-editor').value=model.consoleSource;}stream=[];commands([1001+selected]);notice=t.ready;paint();}}
 function click(event){
  const pad=event.target.closest('[data-pad]');if(pad&&event.detail===0){takeManual();pending.push(cart().actions[physical(pad.dataset.pad)]);dirty=true;return;}
  const action=event.target.closest('[data-machine]')?.dataset.machine;if(!action)return;
  if(['start','pause','finish'].includes(action)){stream=[];commands([gameCommands[action]]);notice='';}
  if(action==='manual'){takeManual();release();notice=t.manual;}
  if(action==='auto'){try{const source=el('#handheld-strategy').value;compileHandheld(source,session,{strategy:true});model.strategies[cart().id]=source;stream=[];commands([2001]);session.automatic=true;autoClock=.25;notice=t.autoNote;}catch(e){error(e);}}
  paint();
 }
 const physical=pad=>pad==='a'?(session.selected===0?6:5):pad==='b'?(session.selected===0?7:5):gameCommands[pad];
 function pointer(event){const button=event.target.closest('[data-pad]');if(!button)return;event.preventDefault();takeManual();const command=physical(button.dataset.pad);held.add(command);pending.push(cart().actions[command]);heldClock=0;button.setPointerCapture?.(event.pointerId);}
 function release(){held.clear();pending=[];pulse=null;pulseTime=0;}
 function lift(){held.clear();}
 function takeManual(){stream=[];session.automatic=false;automaticActions=[];pulse=null;pulseTime=0;}
 const keyMap={ArrowLeft:1,ArrowRight:2,ArrowUp:3,ArrowDown:4,' ':null,z:null,Z:null,x:null,X:null};
 function key(event){if(!Object.hasOwn(keyMap,event.key))return;const action=keyMap[event.key]??physical(event.key==='x'||event.key==='X'?'b':'a');if(event.type==='keyup'){held.delete(action);return;}if(!root.contains(document.activeElement)||['TEXTAREA','INPUT','SELECT'].includes(event.target.tagName))return;event.preventDefault();if(!held.has(action)){takeManual();held.add(action);pending.push(cart().actions[action]);heldClock=0;}}
 function interrupt(){takeManual();release();if(session.status==='running')session.status='paused';last=0;dirty=true;}
 function hidden(){if(document.hidden)interrupt();}
 function tick(now){
  if(disposed)return;const dt=last?Math.min((now-last)/1000,.05):0;last=now;
  if(!document.hidden&&stream.length){streamClock+=dt;if(streamClock>=.12){streamClock=0;const actions=commands([stream.shift()]);if(session.selected===0)pending.push(...actions);else{pulse=actions.at(-1)??null;pulseTime=.12;}}}
  if(session.status==='running'&&!document.hidden){
   let actions=pending.splice(0);heldClock+=dt;
   if(pulseTime>0&&pulse!==null){actions.push(pulse);pulseTime-=dt;}
   if(heldClock>=.12||session.selected!==0){heldClock=0;for(const command of held)if(Object.hasOwn(cart().actions,command))actions.push(cart().actions[command]);}
   if(session.automatic){autoClock+=dt;if(autoClock>=.25){autoClock=0;try{const report=compileHandheld(model.strategies[cart().id]??cart().strategy,session,{strategy:true});automaticActions=report.commands.map(command=>cart().actions[command]);if(session.selected===0)actions.push(...automaticActions);}catch(e){error(e);}}if(session.selected!==0)actions.push(...automaticActions);}
   if(session.status==='running'){cart().step(session.world,dt,actions);session.activeMs+=dt*1000;if(session.world.over){session.status='ended';session.automatic=false;stream=[];}dirty=true;}
  }else pending=[];
  if(dirty)paint();raf=requestAnimationFrame(tick);
 }
 root.addEventListener('submit',submit);root.addEventListener('input',input);root.addEventListener('change',change);root.addEventListener('click',click);root.addEventListener('pointerdown',pointer);root.addEventListener('pointerup',lift);root.addEventListener('pointercancel',release);root.addEventListener('lostpointercapture',lift);document.addEventListener('keydown',key);document.addEventListener('keyup',key);document.addEventListener('visibilitychange',hidden);window.addEventListener('blur',interrupt);
 selection();paint();raf=requestAnimationFrame(tick);
 return {select(index){if(!Number.isInteger(index)||index<0||index>=3)return;if(index===session.selected){interrupt();selection();paint();}else change({target:{id:'handheld-game',value:String(index)}});},pause:interrupt,dispose(){disposed=true;cancelAnimationFrame(raf);interrupt();root.removeEventListener('submit',submit);root.removeEventListener('input',input);root.removeEventListener('change',change);root.removeEventListener('click',click);root.removeEventListener('pointerdown',pointer);root.removeEventListener('pointerup',lift);root.removeEventListener('pointercancel',release);root.removeEventListener('lostpointercapture',lift);document.removeEventListener('keydown',key);document.removeEventListener('keyup',key);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('blur',interrupt);}};
}
