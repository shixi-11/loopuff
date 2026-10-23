import { course, locales } from './course.js';
import { run } from './runner.js';
import { assess, grade } from './assessment.js';
import { mountJumpLab } from './jump.js';
import { drawPlane } from './plane.js';
import { mountVault } from './vault-ui.js';
import { selectedLocale, languageUrl, parseRoute, routeUrl } from './routing.js';

const $ = id => document.getElementById(id);
const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function prose(text){
  const pattern=/let [A-Za-z_]\w* = \d+;|\([^\)\n]+\)(?:\.log\(\))?|\.log\(\)|\b(?:[A-Za-z_]\w*|\d+) \+ \d+\b|\b(?:let|log|n|TVM|Tolang|ALUX|gas)\b|\+/g;
  let cursor=0,result='';for(const match of String(text).matchAll(pattern)){result+=escape(text.slice(cursor,match.index))+`<bdi dir="ltr">${escape(match[0])}</bdi>`;cursor=match.index+match[0].length;}return result+escape(text.slice(cursor));
}
const storageKey='loopuff-v1', reduced=matchMedia('(prefers-reduced-motion: reduce)');
let saved={};try{saved=JSON.parse(localStorage.getItem(storageKey)||'{}');}catch{}
const validLocale=id=>locales.some(([key])=>key===id);
let lang=selectedLocale(location.href,saved.lang,navigator.languages||[navigator.language]);
if(!validLocale(lang))lang='en';
let jumpLab=null,vaultGame=null;
let messages, languageRequest=0, languageController, guideIndex=0, mapOpen=false, notice='', lastResult=null, feedbackState=null;
const initialCatalog=document.getElementById('initial-catalog');
const catalogs=new Map(initialCatalog?[[initialCatalog.dataset.locale,JSON.parse(initialCatalog.textContent)]]:[]);
let state={phase:'welcome',lesson:0,fragment:0,typed:'',draft:'',assessedSource:null,grades:{},score:0,errors:0,keys:0,completed:[],...saved.state};
if(!state.grades||typeof state.grades!=='object'||Array.isArray(state.grades))state.grades={};
if(!['welcome','levels','brief','typing','predict','output','explain','remix','independent','result','complete','guide','pause','play','vault'].includes(state.phase)) state.phase='welcome';
if(!Number.isInteger(state.lesson)||state.lesson<0||state.lesson>=course.length)state.lesson=0;
state.completed=Array.isArray(state.completed)?state.completed.filter(id=>course.some(l=>l.id===id)):[];
function readRoute(){
  const route=parseRoute(location.pathname),previousLesson=state.lesson;
  if(route?.lessonId){state.lesson=course.findIndex(item=>item.id===route.lessonId);if(previousLesson!==state.lesson){state.draft='';state.assessedSource=null;}}
  if(route?.view==='play'||route?.view==='vault')state.phase=route.view;
  else if(route?.view==='result')state.phase='result';
  else if(route?.view==='levels')state.phase='levels';
  else if(route?.view==='guide'){if(!['guide','welcome','pause'].includes(state.phase))state.resumePhase=state.phase;state.phase='guide';}
  else if(route?.view==='lesson'){
    if(previousLesson!==state.lesson){state.phase='brief';state.draft='';state.assessedSource=null;}
    else if(state.phase==='result')state.phase='independent';
    else if(state.phase==='pause')state.phase=state.previousPhase||'brief';
    else if(['welcome','levels','guide','play','vault'].includes(state.phase))state.phase=['brief','typing','predict','output','explain','remix','independent','complete'].includes(state.resumePhase)?state.resumePhase:'brief';
  }else{
    if(!['welcome','pause','guide'].includes(state.phase))state.resumePhase=state.phase;
    state.phase='welcome';
  }
}
readRoute();
const ui=key=>messages.ui[key], lesson=()=>course[state.lesson], copy=()=>messages.lessons[state.lesson];
const fragments=()=>lesson().fragments;
function save(){try{localStorage.setItem(storageKey,JSON.stringify({lang,state}));$('save-status').textContent=ui('save');}catch{$('save-status').textContent=ui('nosave');}}
function languageSelect(){return `<label class="language-control"><span class="sr-only">${escape(ui('language'))}</span><select data-language aria-label="${escape(ui('language'))}">${locales.map(([id,label])=>`<option value="${id}" ${id===lang?'selected':''}>${label}</option>`).join('')}</select></label>`;}
async function changeLanguage(next){
  if(!validLocale(next))return;
  const request=++languageRequest;
  languageController?.abort();languageController=new AbortController();
  const controller=languageController;
  const timeout=setTimeout(()=>controller.abort(),10000);
  document.body.setAttribute('aria-busy','true');
  try{
    let catalog=catalogs.get(next);
    if(!catalog){
      const response=await fetch(new URL(`../locales/${next}.json`,import.meta.url),{signal:controller.signal});
      if(!response.ok)throw Error('locale');
      catalog=await response.json();catalogs.set(next,catalog);
    }
    if(request!==languageRequest)return;
    messages=catalog;lang=next;
    notice=feedbackState?(feedbackState.lesson?copy()[feedbackState.key]:ui(feedbackState.key))+feedbackState.suffix:'';
    const url=languageUrl(location.href,lang);history.replaceState(null,'',url);
    let canonical=document.querySelector('link[rel="canonical"]');
    if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.append(canonical);}
    canonical.href=routeUrl('https://shixilin.com/games/loopuff/',lang,parseRoute(location.pathname)?.view||'home',lesson().id).href;
    document.documentElement.lang=lang==='zh'?'zh-CN':lang==='zh-Hant'?'zh-TW':lang;
    document.documentElement.dir=lang==='ar'?'rtl':'ltr';
    document.title=`${ui('name')} · ${ui('tagline')}`;
    render();save();
    $('toast').hidden=true;
  }catch(error){
    if(request!==languageRequest)return;
    if(messages){$('language-select').value=lang;for(const select of document.querySelectorAll('[data-language]'))select.value=lang;}
    $('toast').hidden=false;$('toast').textContent=messages?ui('error'):'Unable to load language. Reload to try again.';
  }
  finally{clearTimeout(timeout);if(request===languageRequest)document.body.removeAttribute('aria-busy');}
}
function applyStatic(){
  $('brand-name').textContent=ui('name');document.querySelector('.brand').setAttribute('aria-label',`${ui('name')} · ${ui('home')}`);
  document.querySelector('.brand').href=routeUrl(location.href,lang,'home').pathname;
  document.querySelector('.edition').textContent=ui('tagline');
  $('language-label').textContent=ui('language');$('language-select').setAttribute('aria-label',ui('language'));
  $('language-select').innerHTML=locales.map(([id,label])=>`<option value="${id}">${label}</option>`).join('');$('language-select').value=lang;
  $('map-button').innerHTML=`✧ <span class="map-long">${escape(ui('map'))}</span><span class="map-short">${escape(ui('mapShort'))}</span> <b id="map-count">${state.completed.length} / ${course.length}</b>`;
  $('map-button').setAttribute('aria-label',`${ui('map')} ${state.completed.length} / ${course.length}`);
  $('pause-button').textContent=`Ⅱ ${ui('pause')}`;$('pause-button').setAttribute('aria-label',ui('pause'));document.querySelector('.header-controls').setAttribute('aria-label',ui('map'));
  const navigation=$('page-navigation');
  navigation.hidden=false;navigation.setAttribute('aria-label',ui('navigation'));
  navigation.innerHTML=`<a data-action="home" href="${routeUrl(location.href,lang,'home').pathname}" ${state.phase==='welcome'?'aria-current="page"':''}>${escape(ui('navHome'))}</a><a data-action="open-levels" href="${routeUrl(location.href,lang,'levels').pathname}" ${!['welcome','guide','play','vault'].includes(state.phase)?'aria-current="true"':''}>${escape(ui('navCourse'))}</a><a data-action="open-play" href="${routeUrl(location.href,lang,'play').pathname}" ${['play','vault'].includes(state.phase)?'aria-current="page"':''}>${escape(messages.vault.arcade)}</a><a data-action="open-guide" href="${routeUrl(location.href,lang,'guide').pathname}" ${state.phase==='guide'?'aria-current="page"':''}>${escape(ui('navGuide'))}</a>`;
  $('universe').setAttribute('aria-label',ui('map'));document.querySelector('.coordinate').textContent='LOOPUFF / 01';
  document.querySelector('.welcome .eyebrow').textContent=ui('pilot');
  document.querySelector('.welcome h1').innerHTML=ui('hero').split(/\\n|\n/).map(line=>{const accent=ui('heroAccent'),at=line.indexOf(accent);return at<0?escape(line):escape(line.slice(0,at))+`<span class="hero-accent">${escape(accent)}</span>`+escape(line.slice(at+accent.length));}).join('<br>');
  document.querySelector('.welcome-copy').textContent=ui('lead');
  $('start').textContent=ui(state.completed.length||state.resumePhase?'resume':'start');$('how-button').textContent=ui('guide');
  $('play-button').textContent=messages.vault.browse;
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
function syncRoute(){
  if(state.phase==='pause')return;
  const view=state.phase==='welcome'?'home':['levels','guide','result','play','vault'].includes(state.phase)?state.phase:'lesson';
  const url=routeUrl(location.href,lang,view,lesson().id);url.hash='';
  if(location.pathname!==url.pathname)history.pushState(null,'',url);
}
function begin(index){state={...state,phase:'brief',lesson:index,fragment:0,typed:'',draft:'',assessedSource:null,score:0,errors:0,keys:0};notice='';feedbackState=null;lastResult=null;syncRoute();render();save();window.scrollTo(0,0);}
function move(phase){if(phase==='welcome'&&['brief','typing','predict','output','explain','remix','independent','result','complete'].includes(state.phase))state.resumePhase=state.phase;state.phase=phase;notice='';feedbackState=null;lastResult=null;syncRoute();render();save();window.scrollTo(0,0);if(!$('learning-page').hidden)$('learning-page').focus({preventScroll:true});}
function actions(buttons){return `<div class="dialog-actions">${buttons.map(([action,label,secondary])=>`<button class="${secondary?'text-button':'primary'}" data-action="${action}">${escape(label)}</button>`).join('')}</div>`;}
function codeBlock(source){return `<pre class="exercise-code" dir="ltr">${escape(source)}</pre>`;}
function choices(items,action){return `<div class="choices">${items.map((text,index)=>`<button class="choice" data-${action}="${index}"><span>${String(index+1).padStart(2,'0')}</span>${prose(text||ui('noOutput'))}</button>`).join('')}</div>`;}
function render(){
  jumpLab?.dispose();jumpLab=null;
  vaultGame?.dispose();vaultGame=null;
  applyStatic();const phase=state.phase, typing=phase==='typing';
  const page=!['welcome','typing','pause'].includes(phase);
  document.body.dataset.view=page?'learning':'game';
  $('universe').hidden=page;$('learning-page').hidden=!page;
  if(!page&&document.readyState==='complete')upgradeWorld();
  $('universe').dataset.phase=phase;$('welcome').hidden=phase!=='welcome';$('welcome-foot').hidden=phase!=='welcome';
  for(const id of ['flight-hud','code-coach','target','cockpit'])$(id).hidden=!typing;
  $('pause-button').hidden=!typing;
  if(phase!=='pause'){$('flow-dialog').close();$('dialog-content').textContent='';}
  if(typing)renderTyping();else if(phase!=='welcome')renderDialog();
  const view=parseRoute(location.pathname)?.view||'home';
  document.title=`${ui('name')} · ${view==='vault'?messages.vault.title:view==='play'?messages.vault.arcade:view==='result'?messages.assessment.title:view==='levels'?ui('navCourse'):view==='guide'?ui('guide'):view==='lesson'?copy().title:ui('tagline')}`;
  document.querySelector('link[rel="canonical"]').href=routeUrl('https://shixilin.com/games/loopuff/',lang,view,lesson().id).href;
  let robots=document.querySelector('meta[name="robots"]');
  if(view==='result'){if(!robots){robots=document.createElement('meta');robots.name='robots';document.head.append(robots);}robots.content='noindex,follow';}else robots?.remove();
  attachJumpScene();
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
function assessmentPanel(){
  const a=messages.assessment;
  if(state.assessedSource!==state.draft||state.assessedSource===null)return `<div class="empty-report"><h1 id="learning-title">${escape(a.noReport)}</h1><p>${escape(a.noReportHint)}</p>${actions([['edit-assessment',a.edit]])}</div>`;
  const report=grade(state.draft,lesson().independent);
  const errorKey=report.code==='name'?'nameError':report.code;
  const explanation=(report.ok?a.success:ui(errorKey)||ui('limit'))+(report.code==='syntax'?` ${report.position+1}.`:'');
  const checks=report.checks.map(check=>`<li class="assessment-check" data-status="${check.status}"><div><span>${escape(a.labels[check.id])}</span><bdi dir="ltr">${check.points} / ${check.max}</bdi></div><small>${escape(a[check.status])}</small>${check.requirements?`<ul class="concept-checks">${check.requirements.map(item=>`<li><span aria-hidden="true">${check.status==='blocked'?'○':item.passed?'✓':'○'}</span> ${escape(a.concepts[item.concept])}</li>`).join('')}</ul>`:''}</li>`).join('');
  return `<section class="result-report" data-score="${report.score}" data-passed="${report.ok}"><header class="result-hero"><div><span class="eyebrow">${escape(ui('mission'))} ${String(state.lesson+1).padStart(2,'0')} · ${escape(copy().title)}</span><h1 id="learning-title">${escape(a.title)}</h1><p>${escape(report.ok?a.success:a.retry)}</p></div><div class="score-orbit" style="--score:${report.score}%"><div><strong><bdi dir="ltr">${report.score}</bdi></strong><span>${escape(a.score)} <bdi dir="ltr">/ 100</bdi></span></div></div></header><div class="result-toolbar">${actions(report.ok?[['finish-assessment',a.continue],['edit-assessment',a.edit,true]]:[['edit-assessment',a.edit]])}<p class="scope-note">${escape(a.note)}</p></div><section class="result-breakdown"><h2>${escape(a.breakdown)}</h2><ul class="assessment-checks">${checks}</ul>${report.ok?'':`<p class="assessment-explanation" role="status">${prose(explanation)}</p>`}</section><div class="result-work"><section><h2>${escape(a.yourCode)}</h2>${codeBlock(state.assessedSource)}</section><section><h2>${escape(ui('output'))}</h2><div class="assessment-outputs"><div><small>${escape(a.expected)}</small>${codeBlock(lesson().independent.logs.join('\n'))}</div><div><small>${escape(a.actual)}</small>${codeBlock(report.result?report.result.logs.join('\n')||ui('noOutput'):a.notRun)}</div></div></section></div></section>`;
}
function renderDialog(){
  const c=copy(),phase=state.phase;let title='',body='';
  if(phase==='play'||phase==='vault'){
    $('learning-page').dataset.stage=phase;
    const v=messages.vault;
    const trail=`<nav class="page-trail" aria-label="${escape(ui('navigation'))}"><a data-action="home" href="${routeUrl(location.href,lang,'home').pathname}">${escape(ui('navHome'))}</a><span aria-hidden="true">/</span>${phase==='vault'?`<a data-action="open-play" href="${routeUrl(location.href,lang,'play').pathname}">${escape(v.arcade)}</a><span aria-hidden="true">/</span><span aria-current="page">${escape(v.title)}</span>`:`<span aria-current="page">${escape(v.arcade)}</span>`}</nav>`;
    $('learning-content').innerHTML=trail+(phase==='vault'?'<div id="vault-game"></div>':`<section class="arcade-page"><span class="eyebrow">${escape(ui('name'))}</span><h1 id="learning-title">${escape(v.arcadeTitle)}</h1><p class="levels-intro">${escape(v.arcadeIntro)}</p><div class="arcade-games"><a class="arcade-game vault-entry" data-action="open-vault" href="${routeUrl(location.href,lang,'vault').pathname}"><div class="arcade-vault-art" aria-hidden="true"><span>✦</span></div><div><span class="eyebrow">${escape(v.puzzleTag)}</span><h2>${escape(v.title)}</h2><p>${escape(v.intro)}</p><strong>${escape(v.enter)} ↗</strong></div></a><button class="arcade-game jump-entry" data-lesson="3"><div class="arcade-jump-art" aria-hidden="true">↗</div><div><span class="eyebrow">${escape(v.jumpTag)}</span><h2>${escape(messages.jump.title)}</h2><p>${escape(messages.lessons[3].goal)}</p><strong>${escape(v.enter)} ↗</strong></div></button></div></section>`);
    if(phase==='vault')vaultGame=mountVault($('vault-game'),{text:v,errors:messages.ui,reduced});
    return;
  }
  if(phase==='levels'){
    $('learning-page').dataset.stage=phase;
    $('learning-content').innerHTML=`<section class="levels-page"><span class="eyebrow">${escape(ui('name'))}</span><h1 id="learning-title">${escape(ui('routeTitle'))}</h1><p class="levels-intro">${escape(ui('routeIntro'))}</p><div class="level-grid">${course.map((l,i)=>`<button class="level-card" data-lesson="${i}"><span class="level-number">${String(i+1).padStart(2,'0')}</span><span class="level-copy"><strong>${escape(messages.lessons[i].title)}</strong><span>${escape(messages.lessons[i].goal)}</span><small>${escape(ui(state.completed.includes(l.id)?'done':'open'))}</small></span><span aria-hidden="true">↗</span></button>`).join('')}</div><p class="scope-note">${escape(ui('chapterNote'))}</p></section>`;return;
  }
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
    const a=messages.assessment;
    title=ui('independent');body=`<div class="challenge-layout"><section class="challenge-brief"><h2>${escape(a.task)}</h2><p class="dialog-note">${prose(c.independent)}</p><p class="scope-note">${escape(a.intro)}</p>${actions([['hint',ui('hint'),true]])}<p class="scope-note">${escape(ui('scope'))}</p></section><form id="program-form"><label class="editor-label" for="program-editor">${escape(ui('codeLabel'))}</label><textarea id="program-editor" class="practice-editor" rows="8" autocomplete="off" autocapitalize="off" spellcheck="false" dir="ltr">${escape(state.draft)}</textarea><div class="dialog-actions"><button class="primary" type="submit">${escape(a.submit)}</button>${state.assessedSource!==null&&state.assessedSource===state.draft?`<button class="text-button" data-action="view-result" type="button">${escape(a.viewResult)}</button>`:''}</div><p id="assessment-status" class="scope-note" aria-live="polite"></p></form></div>`;
  }
  if(phase==='complete'){
    title=ui('complete');body=`<div class="signal">✧ ✧ ✧</div><p class="dialog-note">${prose(c.learned)}</p><p class="completed-grade">${escape(messages.assessment.score)} <bdi dir="ltr">${state.grades[lesson().id]?.score??100} / 100</bdi></p><div class="score-summary"><div><small>${escape(ui('score'))}</small><strong>${state.score}</strong></div><div><small>${escape(ui('accuracy'))}</small><strong>${state.keys?Math.round(Math.max(0,1-state.errors/state.keys)*100):100}%</strong></div></div><p class="scope-note">${escape(ui('masteryNote'))}</p>${actions([[state.lesson<course.length-1?'next':'home',ui(state.lesson<course.length-1?'next':'home')],['replay',ui('replay'),true]])}`;
  }
  if(phase==='guide'){
    const card=messages.guide[guideIndex];title=card.title;
    body=`<p class="dialog-note">${prose(card.text)}</p>${codeBlock(card.code)}<p class="dialog-note">${prose(card.takeaway)}</p><p class="scope-note">${escape(ui('scope'))}</p>${actions([['guide-next',ui(guideIndex===messages.guide.length-1?'foundationFinish':'foundationNext')],['home',ui('home'),true]])}`;
  }
  if(phase==='pause'){title=ui('pause');body=`<p class="dialog-note">${escape(ui('paused'))}</p>${actions([['resume',ui('resumePlay')],['restart',ui('restart'),true],['home',ui('home'),true]])}`;}
  if(phase==='pause'){
    $('flow-dialog').dataset.stage=phase;$('dialog-content').innerHTML=`<h2 id="dialog-title">${escape(title)}</h2>${body}`;
    if(!$('flow-dialog').open)$('flow-dialog').showModal();return;
  }
  $('learning-page').dataset.stage=phase;
  const trail=`<nav class="page-trail" aria-label="${escape(ui('map'))}"><a data-action="home" href="${routeUrl(location.href,lang,'home').pathname}">${escape(ui('home'))}</a><span aria-hidden="true">/</span>${phase==='result'?`<a data-action="edit-assessment" href="${routeUrl(location.href,lang,'lesson',lesson().id).pathname}">${escape(c.title)}</a><span aria-hidden="true">/</span><span aria-current="page">${escape(messages.assessment.title)}</span>`:`<span aria-current="page">${escape(phase==='guide'?ui('guide'):c.title)}</span>`}</nav>`;
  $('learning-content').innerHTML=trail+(phase==='result'?assessmentPanel():`<div class="lesson-page-body"><span class="eyebrow">${escape(ui('name'))} / ${String(state.lesson+1).padStart(2,'0')}</span><h1 id="learning-title">${escape(title)}</h1>${body}<p class="feedback" id="feedback" role="status" aria-live="polite">${prose(notice)}</p><div id="practice-output" class="practice-output" ${lastResult?'':'hidden'}>${lastResult?escape(ui('output'))+codeBlock(lastResult.logs.join('\n')||ui('noOutput')):''}</div></div>`);
}
function jumpScene(target){
  const j=messages.jump;
  return `<section class="jump-section" aria-labelledby="jump-title"><header><div><span class="eyebrow">${escape(j.eyebrow)}</span><h2 id="jump-title">${escape(j.title)}</h2></div><span class="jump-target">${escape(j.target.replace('{n}',target))}</span></header><p>${escape(j.rule)}</p><div class="jump-lab" id="jump-lab" dir="ltr"><canvas aria-hidden="true"></canvas><p role="status" aria-live="polite" dir="${lang==='ar'?'rtl':'ltr'}"></p></div></section>`;
}
function attachJumpScene(){
  if(!lesson().world||!['brief','output','remix','independent','result'].includes(state.phase))return;
  const target=Number(state.phase==='remix'?lesson().remix.logs[0]:['independent','result'].includes(state.phase)?lesson().independent.logs[0]:lesson().logs[0]);
  const content=$('learning-content'),body=content.querySelector('.lesson-page-body');
  if(state.phase==='independent'){
    body.classList.add('jump-page-body','jump-independent');
    const brief=content.querySelector('.challenge-brief'),form=$('program-form');
    for(const node of [...brief.querySelectorAll('.scope-note,.dialog-actions')])form.append(node);
    brief.insertAdjacentHTML('beforeend',jumpScene(target));
  }
  else if(state.phase==='remix'){
    body.classList.add('jump-page-body');
    const workbench=document.createElement('div'),controls=document.createElement('div');workbench.className='jump-workbench';controls.className='jump-controls';
    for(const node of [...body.children].slice(2))controls.append(node);
    workbench.append(controls);workbench.insertAdjacentHTML('beforeend',jumpScene(target));body.append(workbench);
  }else{
    const anchor=content.querySelector('.result-breakdown');
    if(anchor)anchor.insertAdjacentHTML('beforebegin',jumpScene(target));else body?.insertAdjacentHTML('beforeend',jumpScene(target));
  }
  const root=$('jump-lab');if(!root)return;
  jumpLab=mountJumpLab(root,{target,text:messages.jump,reduced});
  if(state.phase==='output')jumpLab.play(run(lesson().source).logs);
  if(state.phase==='result'&&state.assessedSource===state.draft){const report=grade(state.draft,lesson().independent);if(report.result)jumpLab.play(report.result.logs);else jumpLab.error();}
  if(['independent','remix'].includes(state.phase)){
    const button=document.createElement('button');button.type='button';button.className='text-button';button.dataset.action='try-jump';button.textContent=messages.jump.try;
    $('program-form').querySelector('.dialog-actions').prepend(button);
  }
}
function tryJump(){
  try{const source=state.phase==='remix'?lesson().remix.template.replace('___',state.draft.trim()):state.draft;const result=run(source);jumpLab?.play(result.logs);}
  catch{jumpLab?.error();}
}
function feedback(key,fromLesson=false,suffix=''){
  feedbackState={key,lesson:fromLesson,suffix};notice=(fromLesson?copy()[key]:ui(key))+suffix;
  const el=$('feedback');if(el)el.innerHTML=prose(notice);
  const output=$('practice-output');if(output){output.hidden=!lastResult;output.innerHTML=lastResult?escape(ui('output'))+codeBlock(lastResult.logs.join('\n')||ui('noOutput')):'';}
}
function submitProgram(){
  if(state.phase==='independent'){
    const report=grade(state.draft,lesson().independent),previous=state.grades[lesson().id];
    state.assessedSource=state.draft;
    state.grades[lesson().id]={score:report.score,best:Math.max(previous?.best||0,report.score),attempts:(previous?.attempts||0)+1};
    move('result');return;
  }
  try{
    const source=lesson().remix.template.replace('___',state.draft.trim());
    if(!/^\d+$/.test(state.draft.trim())){feedback('numberRequired');return;}
    const goal={logs:lesson().remix.logs,require:[]};
    const check=assess(source,goal);lastResult=check.result;
    if(!check.ok){feedback(check.code);return;}
    state.draft='';state.assessedSource=null;move('independent');
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
document.addEventListener('input',event=>{if(event.target.id==='program-editor'){
  state.draft=event.target.value;
  jumpLab?.reset();
  if(state.phase==='independent'&&state.assessedSource!==null){state.assessedSource=null;$('assessment-status').textContent=messages.assessment.changed;document.querySelector('[data-action="view-result"]')?.remove();}
  save();
}});
document.addEventListener('submit',event=>{if(event.target.id==='program-form'){event.preventDefault();submitProgram();}});
document.addEventListener('click',event=>{
  const target=event.target.closest('button,a[data-action]');if(!target)return;
  if(target.tagName==='A'){if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();}
  if(target.dataset.prediction!==undefined){if(Number(target.dataset.prediction)===lesson().predictionAnswer)move('output');else feedback('predictionHint');return;}
  if(target.dataset.answer!==undefined){if(Number(target.dataset.answer)===0){state.draft='';move('remix');}else feedback('answerHint',true);return;}
  if(target.dataset.lesson!==undefined){mapOpen=false;$('map-dialog').close();begin(Number(target.dataset.lesson));return;}
  const action=target.dataset.action;
  if(action==='try-jump'){tryJump();return;}
  if(action==='open-play'){move('play');return;}
  if(action==='open-vault'){move('vault');return;}
  if(action==='open-levels'){move('levels');return;}
  if(action==='open-guide'){if(!['welcome','guide','pause'].includes(state.phase))state.resumePhase=state.phase;guideIndex=0;move('guide');return;}
  if(action==='resume-course'){if(state.phase==='guide')move(state.resumePhase==='result'?'independent':state.resumePhase||'brief');else if(state.phase==='result')move('independent');return;}
  if(action==='edit-assessment'){move('independent');$('program-editor')?.focus();return;}
  if(action==='view-result'&&state.assessedSource!==null&&state.assessedSource===state.draft){move('result');return;}
  if(action==='finish-assessment'&&state.phase==='result'&&state.assessedSource===state.draft&&grade(state.draft,lesson().independent).ok){
    if(!state.completed.includes(lesson().id))state.completed.push(lesson().id);
    beacon=1;burst(W*.5,H*.4,28);move('complete');return;
  }
  if(action==='type'){state.fragment=0;state.typed='';state.score=0;state.keys=0;state.errors=0;move('typing');$('typing-field').focus();}
  if(action==='explain')move('explain');
  if(action==='hint')feedback(state.phase==='remix'?'remixHint':'independentHint',true);
  if(action==='next')begin(state.lesson+1);
  if(action==='replay'||action==='restart')begin(state.lesson);
  if(action==='home'){move('welcome');}
  if(action==='resume')move(state.previousPhase||'typing');
  if(action==='guide-next'){if(guideIndex===messages.guide.length-1)begin(0);else{guideIndex++;renderDialog();}}
});
$('start').onclick=()=>{if(['brief','typing','predict','output','explain','remix','independent','result','complete'].includes(state.resumePhase))move(state.resumePhase);else begin(Math.min(state.completed.length,course.length-1));};
$('how-button').onclick=()=>{guideIndex=0;move('guide');};
$('play-button').onclick=()=>move('play');
$('pause-button').onclick=pause;
$('typing-field').addEventListener('input',onTyping);$('typing-field').addEventListener('compositionend',onTyping);
$('map-button').onclick=()=>move('levels');
$('map-close').onclick=()=>{mapOpen=false;$('map-dialog').close();};
$('map-dialog').addEventListener('close',()=>{mapOpen=false;});
$('flow-dialog').addEventListener('cancel',event=>{event.preventDefault();if(state.phase==='pause')move(state.previousPhase||'typing');else pause();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.phase==='typing')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.phase==='typing')pause();});
document.querySelector('.brand').onclick=event=>{event.preventDefault();move('welcome');};
window.addEventListener('popstate',()=>{readRoute();notice='';feedbackState=null;lastResult=null;const locale=parseRoute(location.pathname)?.locale;if(locale&&locale!==lang)changeLanguage(locale);else{render();save();}window.scrollTo(0,0);});

// Geometry is measured after layout changes, not on each animation frame.
let flightTop=380,flightBottom=500,targetY=420,shipAnchor=600;
function refreshGeometry(){if(state.phase!=='typing')return;const world=$('universe').getBoundingClientRect(),coach=$('code-coach').getBoundingClientRect(),cockpit=$('cockpit').getBoundingClientRect();flightTop=coach.bottom-world.top+55;flightBottom=cockpit.top-world.top-95;targetY=(flightTop+Math.max(flightTop,flightBottom))/2;shipAnchor=cockpit.top-world.top-36;$('target').style.top=targetY+'px';}

// The original scene is intentionally independent of course text and locale.
// Canvas world: cached planet/orbits, moving ship, beams and collectible debris.
const canvas=$('space'),ctx=canvas.getContext('2d'),back=document.createElement('canvas'),bg=back.getContext('2d');
let W=1000,H=800,DPR=1,last=performance.now(),clock=0,beacon=0,effects=[];
let seed=41;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const stars=Array.from({length:145},()=>({x:rnd(),y:rnd(),r:.45+rnd()*1.2,p:rnd()*6.28}));
function resize(){const r=$('universe').getBoundingClientRect();if(!r.width||!r.height)return;W=r.width;H=r.height;DPR=Math.min(devicePixelRatio||1,1.6);canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);back.width=canvas.width;back.height=canvas.height;ctx.setTransform(DPR,0,0,DPR,0,0);bg.setTransform(DPR,0,0,DPR,0,0);background();refreshGeometry();}
let fullWorldRequested=false;
let worldArt=new Image();worldArt.decoding='async';worldArt.onload=()=>background();worldArt.src=new URL('../assets/world-preview.webp',import.meta.url).href;
// Same-composition preview first; a slow detailed image cannot hold the page load event.
function upgradeWorld(){
 if(fullWorldRequested||$('universe').hidden)return;
 fullWorldRequested=true;
 const full=new Image();full.decoding='async';full.fetchPriority='low';
 full.onload=()=>{worldArt=full;background();};full.src=new URL('../assets/world-flight-90.webp',import.meta.url).href;
}
if(document.readyState==='complete')upgradeWorld();else window.addEventListener('load',upgradeWorld,{once:true});
function background(){
 if(worldArt.complete&&worldArt.naturalWidth){const scale=Math.max(W/worldArt.naturalWidth,H/worldArt.naturalHeight);bg.drawImage(worldArt,(W-worldArt.naturalWidth*scale)/2,(H-worldArt.naturalHeight*scale)/2,worldArt.naturalWidth*scale,worldArt.naturalHeight*scale);const shade=bg.createLinearGradient(0,0,W,0);shade.addColorStop(0,'#123a3b99');shade.addColorStop(.65,'#143b3d55');shade.addColorStop(1,'#123a3b0d');bg.fillStyle=shade;bg.fillRect(0,0,W,H);return;}
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
function shipX(){return state.phase==='welcome'?W*(W<1100?.84:.76):W*.5;}
function shipY(){return state.phase==='welcome'?H*.79:shipAnchor;}
function shoot(){effects.push({kind:'beam',x:shipX(),y:shipY()-30,tx:W*.5,ty:targetY,life:.17,max:.17});}
function burst(x,y,count){if(reduced.matches)count=Math.min(count,7);for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,speed=20+Math.random()*100;effects.push({kind:'spark',x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:.45+Math.random()*.4,max:.85});}}
function drawShip(t){
 const calm=reduced.matches,home=state.phase==='welcome';
 const x=shipX(),y=shipY()+(calm?0:Math.sin(t*1.8)*4);
 const bank=home ? .18 : 0;
 const size=home?Math.min(200,W*.27):115;
 drawPlane(ctx,x,y,size,calm?0:t,bank-(home?.13:0)+(calm?0:Math.sin(t*.85)*.045));
}
function frame(now){
 const dt=Math.min((now-last)/1000,.05);last=now;clock+=dt;
 if($('universe').hidden){requestAnimationFrame(frame);return;}
 ctx.clearRect(0,0,W,H);ctx.drawImage(back,0,0,back.width,back.height,0,0,W,H);
 for(const s of stars){ctx.globalAlpha=.28+(reduced.matches?.2:(Math.sin(clock*.65+s.p)+1)*.22);ctx.fillStyle='#e7e2c4';ctx.beginPath();ctx.arc(s.x*W,s.y*H,s.r,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;

 drawShip(clock);
 for(const e of effects){e.life-=dt;if(e.kind==='beam'){ctx.strokeStyle='#c8e8ae';ctx.lineWidth=2;ctx.globalAlpha=Math.max(0,e.life/e.max);ctx.beginPath();ctx.moveTo(e.x-6,e.y);ctx.lineTo(e.tx,e.ty+25);ctx.moveTo(e.x+6,e.y);ctx.lineTo(e.tx,e.ty+25);ctx.stroke();}else{e.x+=e.vx*dt;e.y+=e.vy*dt;ctx.globalAlpha=Math.max(0,e.life/e.max);ctx.fillStyle=e.vx>0?'#e9b275':'#c8e8ae';ctx.fillRect(e.x,e.y,2.5,2.5);}}ctx.globalAlpha=1;effects=effects.filter(e=>e.life>0);
 if(beacon>0){beacon=Math.max(0,beacon-dt*.2);ctx.strokeStyle='#c8e8ae';ctx.globalAlpha=beacon*.6;ctx.lineWidth=2;ctx.beginPath();ctx.arc(W*.78,H*.3,15+(1-beacon)*80,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
 requestAnimationFrame(frame);
}
new ResizeObserver(resize).observe($('universe'));resize();requestAnimationFrame(frame);


await changeLanguage(lang);
