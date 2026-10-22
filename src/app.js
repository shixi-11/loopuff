import { course, locales } from './course.js';
import { run } from './runner.js';
import { assess } from './assessment.js';

const $ = id => document.getElementById(id);
const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function prose(text){
  const pattern=/let [A-Za-z_]\w* = \d+;|\([^\)\n]+\)(?:\.log\(\))?|\.log\(\)|\b(?:[A-Za-z_]\w*|\d+) \+ \d+\b|\b(?:let|log|n|TVM|Tolang|ALUX|gas)\b|\+/g;
  let cursor=0,result='';for(const match of String(text).matchAll(pattern)){result+=escape(text.slice(cursor,match.index))+`<bdi dir="ltr">${escape(match[0])}</bdi>`;cursor=match.index+match[0].length;}return result+escape(text.slice(cursor));
}
const storageKey='loopuff-v1', reduced=matchMedia('(prefers-reduced-motion: reduce)');
let saved={};try{saved=JSON.parse(localStorage.getItem(storageKey)||'{}');}catch{}
const validLocale=id=>locales.some(([key])=>key===id);
let lang=new URL(location.href).searchParams.get('lang')||saved.lang||(navigator.language.startsWith('zh')?'zh':'en');
if(!validLocale(lang))lang='en';
let messages, languageRequest=0, languageController, guideIndex=0, mapOpen=false, notice='', lastResult=null, feedbackState=null;
let state={phase:'welcome',lesson:0,fragment:0,typed:'',draft:'',score:0,errors:0,keys:0,completed:[],...saved.state};
if(!['welcome','brief','typing','predict','output','explain','remix','independent','complete','guide','pause'].includes(state.phase)) state.phase='welcome';
if(!Number.isInteger(state.lesson)||state.lesson<0||state.lesson>=course.length)state.lesson=0;
state.completed=Array.isArray(state.completed)?state.completed.filter(id=>course.some(l=>l.id===id)):[];
const ui=key=>messages.ui[key], lesson=()=>course[state.lesson], copy=()=>messages.lessons[state.lesson];
const fragments=()=>lesson().fragments;
function save(){try{localStorage.setItem(storageKey,JSON.stringify({lang,state}));$('save-status').textContent=ui('save');}catch{$('save-status').textContent=ui('nosave');}}
function languageSelect(){return `<label class="language-control"><span class="sr-only">${escape(ui('language'))}</span><select data-language aria-label="${escape(ui('language'))}">${locales.map(([id,label])=>`<option value="${id}" ${id===lang?'selected':''}>${label}</option>`).join('')}</select></label>`;}
async function changeLanguage(next){
  if(!validLocale(next))return;
  const request=++languageRequest;
  languageController?.abort();languageController=new AbortController();
  document.body.setAttribute('aria-busy','true');
  try{
    const response=await fetch(new URL(`../locales/${next}.json`,import.meta.url),{signal:languageController.signal});
    if(!response.ok)throw Error('locale');
    const catalog=await response.json();
    if(request!==languageRequest)return;
    messages=catalog;lang=next;
    notice=feedbackState?(feedbackState.lesson?copy()[feedbackState.key]:ui(feedbackState.key))+feedbackState.suffix:'';
    const url=new URL(location.href);url.searchParams.set('lang',lang);history.replaceState(null,'',url);
    document.documentElement.lang=lang==='zh'?'zh-CN':lang==='zh-Hant'?'zh-TW':lang;
    document.documentElement.dir=lang==='ar'?'rtl':'ltr';
    document.title=`${ui('name')} · ${ui('tagline')}`;
    render();save();
    $('toast').hidden=true;
  }catch(error){
    if(request!==languageRequest||error.name==='AbortError')return;
    if(messages){$('language-select').value=lang;for(const select of document.querySelectorAll('[data-language]'))select.value=lang;}
    $('toast').hidden=false;$('toast').textContent=messages?ui('error'):'Unable to load language. Reload to try again.';
  }
  finally{if(request===languageRequest)document.body.removeAttribute('aria-busy');}
}
function applyStatic(){
  $('brand-name').textContent=ui('name');document.querySelector('.brand').setAttribute('aria-label',`${ui('name')} · ${ui('home')}`);
  document.querySelector('.edition').textContent=ui('tagline');
  $('language-label').textContent=ui('language');$('language-select').setAttribute('aria-label',ui('language'));
  $('language-select').innerHTML=locales.map(([id,label])=>`<option value="${id}">${label}</option>`).join('');$('language-select').value=lang;
  $('map-button').innerHTML=`✧ ${escape(ui('map'))} <b id="map-count">${state.completed.length} / ${course.length}</b>`;
  $('pause-button').textContent=`Ⅱ ${ui('pause')}`;$('pause-button').setAttribute('aria-label',ui('pause'));document.querySelector('nav').setAttribute('aria-label',ui('map'));
  $('universe').setAttribute('aria-label',ui('map'));document.querySelector('.coordinate').textContent='LOOPUFF / 01';
  document.querySelector('.welcome .eyebrow').textContent=ui('pilot');
  document.querySelector('.welcome h1').innerHTML=ui('hero').split(/\\n|\n/).map(escape).join('<br>');
  document.querySelector('.welcome-copy').textContent=ui('lead');
  $('start').textContent=ui(state.completed.length?'resume':'start');$('how-button').textContent=ui('guide');
  document.querySelector('.first-command>span').textContent=ui('firstSignal');
  $('welcome-foot').innerHTML=`<span>${escape(ui('welcomeFoot'))}</span><span>${escape(ui('learningLoop'))}</span>`;
  document.querySelector('.page-foot>span:first-child').textContent=ui('footer');
  $('save-status').textContent=ui('save');
  document.querySelector('.flight-stats small').textContent=ui('score');
  document.querySelector('.coach-label').textContent=ui('read');$('code-coach').setAttribute('aria-label',ui('read'));
  document.querySelector('.rail-label').textContent=ui('assembled');
  document.querySelector('.input-label').textContent=ui('typeLabel');
  $('typing-field').placeholder=ui('typePlaceholder');$('typing-field').setAttribute('aria-label',ui('typePlaceholder'));
  document.querySelector('.next-key small').textContent=ui('nextKey');$('cockpit').setAttribute('aria-label',ui('assembled'));
  $('combo-text').textContent=ui('takeTime');
}
function begin(index){state={...state,phase:'brief',lesson:index,fragment:0,typed:'',draft:'',score:0,errors:0,keys:0};notice='';feedbackState=null;lastResult=null;render();save();}
function move(phase){state.phase=phase;notice='';feedbackState=null;lastResult=null;render();save();}
function actions(buttons){return `<div class="dialog-actions">${buttons.map(([action,label,secondary])=>`<button class="${secondary?'text-button':'primary'}" data-action="${action}">${escape(label)}</button>`).join('')}</div>`;}
function codeBlock(source){return `<pre class="exercise-code" dir="ltr">${escape(source)}</pre>`;}
function choices(items,action){return `<div class="choices">${items.map((text,index)=>`<button class="choice" data-${action}="${index}"><span>${String(index+1).padStart(2,'0')}</span>${prose(text||ui('noOutput'))}</button>`).join('')}</div>`;}
function render(){
  applyStatic();const phase=state.phase, typing=phase==='typing';
  $('universe').dataset.phase=phase;$('welcome').hidden=phase!=='welcome';$('welcome-foot').hidden=phase!=='welcome';
  for(const id of ['flight-hud','code-coach','target','cockpit'])$(id).hidden=!typing;
  $('pause-button').hidden=phase==='welcome'||phase==='pause';
  if(typing){renderTyping();$('flow-dialog').close();}else if(phase==='welcome')$('flow-dialog').close();else renderDialog();
  if(mapOpen)renderMap();
  requestAnimationFrame(refreshGeometry);
}
function renderTyping(){
  const fragment=fragments()[state.fragment]||'',typed=state.typed;
  $('mission-number').textContent=`${ui('mission')} ${String(state.lesson+1).padStart(2,'0')}`;
  $('mission-title').textContent=copy().title;$('mission-hint').textContent=copy().goal;
  const meaning=copy().coach[state.fragment];$('meaning-title').textContent=meaning[0];$('meaning-text').innerHTML=prose(meaning[1]);$('meaning-connection').innerHTML=prose(meaning[2]);
  $('fragment-label').textContent=ui('fragment');$('fragment-count').textContent=`${state.fragment+1} / ${fragments().length}`;
  $('target-word').innerHTML=[...fragment].map((c,i)=>`<span class="${i<typed.length&&typed[i]===c?'hit':i===typed.length?'active-letter':''}">${escape(c==='\n'?'↵':c)}</span>`).join('');
  $('typing-field').value=typed;$('typing-field').classList.toggle('wrong',!fragment.startsWith(typed));
  $('typing-help').textContent=ui(fragment.startsWith(typed)?'typeHelp':'wrong');
  $('assembled').textContent=fragments().slice(0,state.fragment).join('')||'…';
  $('fragment-progress').textContent=`${state.fragment} / ${fragments().length}`;
  const next=fragment[typed.length];$('next-key').textContent=next===' '?'␣':next==='\n'?'↵':next||'✓';
  $('score').textContent=String(state.score).padStart(4,'0');
}
function onTyping(event){
  if(state.phase!=='typing'||event.isComposing)return;
  const input=$('typing-field'),text=input.value,target=fragments()[state.fragment];
  if(text.length>state.typed.length){state.keys+=text.length-state.typed.length;if(!target.startsWith(text))state.errors++;}
  state.typed=text;
  if(text===target){state.score+=100;shoot();burst(W*.5,targetY,16);state.fragment++;state.typed='';
    if(state.fragment===fragments().length){move('predict');return;}
  }
  const position=input.selectionStart;renderTyping();input.setSelectionRange(Math.min(position,input.value.length),Math.min(position,input.value.length));save();
}
function renderDialog(){
  const c=copy(),phase=state.phase;let title='',body='';
  if(phase==='brief'){title=c.title;body=`<p class="dialog-note">${prose(c.intro)}</p>${codeBlock(lesson().source)}<p>${prose(c.goal)}</p>${actions([['type',ui('launch')]])}`;}
  if(phase==='predict'){title=ui('predict');body=`<p class="dialog-note">${escape(ui('predictionPrompt'))}</p>${codeBlock(lesson().source)}${choices(lesson().prediction,'prediction')}`;}
  if(phase==='output'){
    const result=run(lesson().source);title=ui('output');
    body=`<div class="signal" dir="ltr">${escape(result.logs.join('\n'))}</div><p class="dialog-note">${prose(c.result)}</p><p class="scope-note">${escape(ui('modelSteps'))}: ${result.steps}. ${escape(ui('modelNote'))}</p>${actions([['explain',ui('why')]])}`;
  }
  if(phase==='explain'){title=ui('explain');body=`<p class="dialog-note">${prose(c.question)}</p>${choices(c.answers,'answer')}`;}
  if(phase==='remix'){
    title=ui('practice');body=`<p class="dialog-note">${prose(c.remix)}</p>${codeBlock(lesson().remix.template)}<form id="program-form"><label class="editor-label" for="program-editor">${escape(ui('valueLabel'))}</label><input id="program-editor" class="practice-editor value-editor" inputmode="numeric" autocomplete="off" value="${escape(state.draft)}" dir="ltr"><div class="dialog-actions"><button class="primary" type="submit">${escape(ui('submit'))}</button></div></form>${actions([['hint',ui('hint'),true]])}`;
  }
  if(phase==='independent'){
    title=ui('independent');body=`<p class="dialog-note">${prose(c.independent)}</p><form id="program-form"><label class="editor-label" for="program-editor">${escape(ui('codeLabel'))}</label><textarea id="program-editor" class="practice-editor" rows="4" autocomplete="off" autocapitalize="off" spellcheck="false" dir="ltr">${escape(state.draft)}</textarea><div class="dialog-actions"><button class="primary" type="submit">${escape(ui('submit'))}</button></div></form><p class="scope-note">${escape(ui('scope'))}</p>${actions([['hint',ui('hint'),true]])}`;
  }
  if(phase==='complete'){
    title=ui('complete');body=`<div class="signal">✧ ✧ ✧</div><p class="dialog-note">${prose(c.learned)}</p><div class="score-summary"><div><small>${escape(ui('score'))}</small><strong>${state.score}</strong></div><div><small>${escape(ui('accuracy'))}</small><strong>${state.keys?Math.round(Math.max(0,1-state.errors/state.keys)*100):100}%</strong></div></div><p class="scope-note">${escape(ui('masteryNote'))}</p>${actions([[state.lesson<course.length-1?'next':'home',ui(state.lesson<course.length-1?'next':'home')],['replay',ui('replay'),true]])}`;
  }
  if(phase==='guide'){
    const card=messages.guide[guideIndex];title=card.title;
    body=`<p class="dialog-note">${prose(card.text)}</p>${codeBlock(card.code)}<p class="dialog-note">${prose(card.takeaway)}</p><p class="scope-note">${escape(ui('scope'))}</p>${actions([['guide-next',ui(guideIndex===messages.guide.length-1?'foundationFinish':'foundationNext')],['home',ui('home'),true]])}`;
  }
  if(phase==='pause'){title=ui('pause');body=`<p class="dialog-note">${escape(ui('paused'))}</p>${actions([['resume',ui('resumePlay')],['restart',ui('restart'),true],['home',ui('home'),true]])}`;}
  $('flow-dialog').dataset.stage=phase;
  $('dialog-content').innerHTML=`<div class="dialog-top"><span class="eyebrow">${ui('name')} / ${String(state.lesson+1).padStart(2,'0')}</span>${languageSelect()}</div><h2 id="dialog-title">${escape(title)}</h2>${body}<p class="feedback" id="feedback" role="status" aria-live="polite">${prose(notice)}</p><div id="practice-output" class="practice-output" ${lastResult?'':'hidden'}>${lastResult?escape(ui('output'))+codeBlock(lastResult.logs.join('\n')||ui('noOutput')):''}</div>`;
  if(!$('flow-dialog').open)$('flow-dialog').showModal();
  $('flow-dialog').scrollTop=0;
}
function feedback(key,fromLesson=false,suffix=''){
  feedbackState={key,lesson:fromLesson,suffix};notice=(fromLesson?copy()[key]:ui(key))+suffix;
  const el=$('feedback');if(el)el.innerHTML=prose(notice);
  const output=$('practice-output');if(output){output.hidden=!lastResult;output.innerHTML=lastResult?escape(ui('output'))+codeBlock(lastResult.logs.join('\n')||ui('noOutput')):'';}
}
function submitProgram(){
  try{
    const source=state.phase==='remix'?lesson().remix.template.replace('___',state.draft.trim()):state.draft;
    if(state.phase==='remix'&&!/^\d+$/.test(state.draft.trim())){feedback('numberRequired');return;}
    const goal=state.phase==='remix'?{logs:lesson().remix.logs,require:[]}:lesson().independent;
    const check=assess(source,goal);lastResult=check.result;
    if(!check.ok){feedback(check.code);return;}
    if(state.phase==='remix'){state.draft='';move('independent');return;}
    if(!state.completed.includes(lesson().id))state.completed.push(lesson().id);
    beacon=1;burst(W*.5,H*.4,28);move('complete');
  }catch(error){lastResult=null;feedback(error.code==='syntax'?'syntax':error.code==='name'?'nameError':'limit',false,error.code==='syntax'?` ${error.position+1}.`:'');}
}
function renderMap(){
  $('map-title').textContent=ui('routeTitle');$('map-close').setAttribute('aria-label',ui('close'));
  $('map-dialog').querySelector('.eyebrow').textContent=ui('map');$('map-dialog').querySelector('.dialog-note').textContent=ui('routeIntro');
  $('map-locale').innerHTML=languageSelect();
  $('route-list').innerHTML=course.map((l,i)=>`<button class="route-item" data-lesson="${i}" ${i>0&&!state.completed.includes(course[i-1].id)?'disabled':''}><b>${String(i+1).padStart(2,'0')}</b><span>${escape(messages.lessons[i].title)}<small>${escape(ui(state.completed.includes(l.id)?'done':i===0||state.completed.includes(course[i-1].id)?'open':'locked'))}</small></span><span>↗</span></button>`).join('')+`<p class="scope-note">${escape(ui('chapterNote'))}</p>`;
}
function pause(){if(state.phase==='welcome'||state.phase==='pause')return;state.previousPhase=state.phase;move('pause');}
document.addEventListener('change',event=>{if(event.target.matches('[data-language],#language-select'))changeLanguage(event.target.value);});
document.addEventListener('input',event=>{if(event.target.id==='program-editor'){state.draft=event.target.value;save();}});
document.addEventListener('submit',event=>{if(event.target.id==='program-form'){event.preventDefault();submitProgram();}});
document.addEventListener('click',event=>{
  const target=event.target.closest('button');if(!target)return;
  if(target.dataset.prediction!==undefined){if(Number(target.dataset.prediction)===lesson().predictionAnswer)move('output');else feedback('predictionHint');return;}
  if(target.dataset.answer!==undefined){if(Number(target.dataset.answer)===0){state.draft='';move('remix');}else feedback('answerHint',true);return;}
  if(target.dataset.lesson!==undefined){mapOpen=false;$('map-dialog').close();begin(Number(target.dataset.lesson));return;}
  const action=target.dataset.action;
  if(action==='type'){move('typing');$('typing-field').focus();}
  if(action==='explain')move('explain');
  if(action==='hint')feedback(state.phase==='remix'?'remixHint':'independentHint',true);
  if(action==='next')begin(state.lesson+1);
  if(action==='replay'||action==='restart')begin(state.lesson);
  if(action==='home'){move('welcome');}
  if(action==='resume')move(state.previousPhase||'typing');
  if(action==='guide-next'){if(guideIndex===messages.guide.length-1)begin(0);else{guideIndex++;renderDialog();}}
});
$('start').onclick=()=>begin(Math.min(state.completed.length,course.length-1));
$('how-button').onclick=()=>{guideIndex=0;move('guide');};
$('pause-button').onclick=pause;
$('typing-field').addEventListener('input',onTyping);$('typing-field').addEventListener('compositionend',onTyping);
$('map-button').onclick=()=>{if(state.phase==='typing')pause();mapOpen=true;renderMap();$('map-dialog').showModal();};
$('map-close').onclick=()=>{mapOpen=false;$('map-dialog').close();};
$('map-dialog').addEventListener('close',()=>{mapOpen=false;});
$('flow-dialog').addEventListener('cancel',event=>{event.preventDefault();if(state.phase==='pause')move(state.previousPhase||'typing');else pause();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.phase==='typing')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.phase==='typing')pause();});
document.querySelector('.brand').onclick=event=>{event.preventDefault();move('welcome');};

// Geometry is measured after layout changes, not on each animation frame.
let flightTop=380,flightBottom=500,targetY=420,shipAnchor=600;
function refreshGeometry(){if(state.phase!=='typing')return;const world=$('universe').getBoundingClientRect(),coach=$('code-coach').getBoundingClientRect(),cockpit=$('cockpit').getBoundingClientRect();flightTop=coach.bottom-world.top+55;flightBottom=cockpit.top-world.top-95;targetY=(flightTop+Math.max(flightTop,flightBottom))/2;shipAnchor=cockpit.top-world.top-36;$('target').style.top=targetY+'px';}

// The original scene is intentionally independent of course text and locale.
// Canvas world: cached planet/orbits, moving ship, beams and collectible debris.
const canvas=$('space'),ctx=canvas.getContext('2d'),back=document.createElement('canvas'),bg=back.getContext('2d');
let W=1000,H=800,DPR=1,last=performance.now(),clock=0,beacon=0,effects=[];
let seed=41;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const stars=Array.from({length:145},()=>({x:rnd(),y:rnd(),r:.45+rnd()*1.2,p:rnd()*6.28}));
function resize(){const r=$('universe').getBoundingClientRect();W=r.width;H=r.height;DPR=Math.min(devicePixelRatio||1,1.6);canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);back.width=canvas.width;back.height=canvas.height;ctx.setTransform(DPR,0,0,DPR,0,0);bg.setTransform(DPR,0,0,DPR,0,0);background();refreshGeometry();}
function background(){
 const g=bg.createLinearGradient(0,0,W,H);g.addColorStop(0,'#173131');g.addColorStop(.6,'#14292b');g.addColorStop(1,'#203a33');bg.fillStyle=g;bg.fillRect(0,0,W,H);
 const mobile=W<600,px=W*(mobile?.88:.79),py=H*(mobile?.38:.32),r=Math.min(W*.23,H*.235);
 bg.save();bg.translate(px,py);bg.rotate(-.4);bg.strokeStyle='#d9c5a549';bg.lineWidth=1;bg.beginPath();bg.ellipse(0,0,r*1.48,r*.32,0,0,Math.PI*2);bg.stroke();bg.restore();
 const halo=bg.createRadialGradient(px,py,r*.8,px,py,r*1.65);halo.addColorStop(0,'#d8aa6121');halo.addColorStop(1,'#d8aa6100');bg.fillStyle=halo;bg.fillRect(px-r*1.7,py-r*1.7,r*3.4,r*3.4);
 bg.save();bg.beginPath();bg.arc(px,py,r,0,Math.PI*2);bg.clip();
 const p=bg.createRadialGradient(px-r*.45,py-r*.5,r*.05,px+r*.35,py+r*.25,r*1.45);p.addColorStop(0,'#e5b582');p.addColorStop(.48,'#bd8159');p.addColorStop(.8,'#79533f');p.addColorStop(1,'#302f2b');bg.fillStyle=p;bg.fillRect(px-r,py-r,r*2,r*2);
 for(let i=0;i<23;i++){const y=py-r+i*r*.095;bg.strokeStyle=i%3?'#ebc59016':'#563d3424';bg.lineWidth=3+(i%4)*6;bg.beginPath();bg.moveTo(px-r*1.3,y);bg.bezierCurveTo(px-r*.5,y-r*.15,px+r*.2,y+r*.3,px+r*1.25,y-r*.07);bg.stroke();}
 const shade=bg.createLinearGradient(px-r,py-r,px+r,py+r);shade.addColorStop(0,'#f4d6a311');shade.addColorStop(.7,'#122c2a00');shade.addColorStop(1,'#10292b99');bg.fillStyle=shade;bg.fillRect(px-r,py-r,r*2,r*2);bg.restore();
 bg.save();bg.translate(px,py);bg.rotate(-.4);bg.strokeStyle='#ecd3a6a1';bg.lineWidth=1.3;bg.beginPath();bg.ellipse(0,0,r*1.48,r*.32,0,0,Math.PI);bg.stroke();bg.restore();
 bg.strokeStyle='#afc7a52e';bg.setLineDash([3,9]);bg.beginPath();bg.moveTo(W*.21,H*.78);bg.bezierCurveTo(W*.28,H*.56,W*.68,H*.86,W*.82,H*.57);bg.stroke();bg.setLineDash([]);
 for(let n=0;n<4;n++){const x=W*(.56+n*.08),y=H*(.78-n*.045);bg.strokeStyle='#b6cda64d';bg.beginPath();bg.arc(x,y,2.5,0,Math.PI*2);bg.stroke();}
 if(mobile){bg.fillStyle='#14292b65';bg.fillRect(0,0,W,H);}
}
function shipX(){return state.phase==='welcome'?W*.73:W*.5;}
function shipY(){return state.phase==='welcome'?H*.79:shipAnchor;}
function shoot(){effects.push({kind:'beam',x:shipX(),y:shipY()-30,tx:W*.5,ty:targetY,life:.17,max:.17});}
function burst(x,y,count){if(reduced.matches)count=Math.min(count,7);for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,speed=20+Math.random()*100;effects.push({kind:'spark',x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:.45+Math.random()*.4,max:.85});}}
function drawShip(t){
 const x=shipX(),y=shipY()+(reduced.matches?0:Math.sin(t*1.8)*4);
 ctx.save();ctx.translate(x,y);if(state.phase==='welcome')ctx.rotate(.2);
 const glow=ctx.createRadialGradient(0,22,2,0,28,49);glow.addColorStop(0,'#e7b77155');glow.addColorStop(1,'#e7b77100');ctx.fillStyle=glow;ctx.fillRect(-50,-5,100,90);
 ctx.fillStyle='#edbb78';ctx.beginPath();ctx.moveTo(-8,22);ctx.lineTo(0,47+(reduced.matches?0:Math.sin(t*22)*6));ctx.lineTo(8,22);ctx.closePath();ctx.fill();
 ctx.fillStyle='#bdcdb7';ctx.beginPath();ctx.moveTo(0,-43);ctx.lineTo(38,21);ctx.lineTo(12,15);ctx.lineTo(0,26);ctx.lineTo(-12,15);ctx.lineTo(-38,21);ctx.closePath();ctx.fill();
 ctx.fillStyle='#ede7d2';ctx.beginPath();ctx.moveTo(0,-43);ctx.lineTo(12,17);ctx.lineTo(0,25);ctx.lineTo(-12,17);ctx.closePath();ctx.fill();
 ctx.fillStyle='#345d5b';ctx.beginPath();ctx.ellipse(0,-9,6,14,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#92b7a0';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-22,12);ctx.lineTo(-12,-7);ctx.moveTo(22,12);ctx.lineTo(12,-7);ctx.stroke();ctx.restore();
}
function frame(now){
 const dt=Math.min((now-last)/1000,.05);last=now;clock+=dt;
 ctx.clearRect(0,0,W,H);ctx.drawImage(back,0,0,back.width,back.height,0,0,W,H);
 for(const s of stars){ctx.globalAlpha=.28+(reduced.matches?.2:(Math.sin(clock*.65+s.p)+1)*.22);ctx.fillStyle='#e7e2c4';ctx.beginPath();ctx.arc(s.x*W,s.y*H,s.r,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;

 drawShip(clock);
 for(const e of effects){e.life-=dt;if(e.kind==='beam'){ctx.strokeStyle='#c8e8ae';ctx.lineWidth=2;ctx.globalAlpha=Math.max(0,e.life/e.max);ctx.beginPath();ctx.moveTo(e.x-6,e.y);ctx.lineTo(e.tx,e.ty+25);ctx.moveTo(e.x+6,e.y);ctx.lineTo(e.tx,e.ty+25);ctx.stroke();}else{e.x+=e.vx*dt;e.y+=e.vy*dt;ctx.globalAlpha=Math.max(0,e.life/e.max);ctx.fillStyle=e.vx>0?'#e9b275':'#c8e8ae';ctx.fillRect(e.x,e.y,2.5,2.5);}}ctx.globalAlpha=1;effects=effects.filter(e=>e.life>0);
 if(beacon>0){beacon=Math.max(0,beacon-dt*.2);ctx.strokeStyle='#c8e8ae';ctx.globalAlpha=beacon*.6;ctx.lineWidth=2;ctx.beginPath();ctx.arc(W*.78,H*.3,15+(1-beacon)*80,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
 requestAnimationFrame(frame);
}
new ResizeObserver(resize).observe($('universe'));resize();requestAnimationFrame(frame);


await changeLanguage(lang);
