import { course, locales } from './course.js';
import { run } from './runner.js';
import { assessTask as assess, gradeTask as grade } from './assessment.js';
import { mountJumpLab } from './jump.js';
import { drawPlane, aircraftUrl } from './plane.js';
import { mountHomePlane } from './home-plane.js';
import { mountVault, loadVault } from './vault-ui.js';
import { mountChase, loadChase } from './chase-ui.js';
import { mountPursuit } from './pursuit-ui.js';
import { mountHeist } from './heist-ui.js';
import { mountDispatch, loadDispatch } from './dispatch-ui.js';
import {dispatchIds} from './dispatch.js';
import {lessonApplication,requestedDispatchMission,dispatchMissionUrl,diagnosticAreaUrl} from './learning-transfer.js';
import {applicationPanel} from './learning-transfer-ui.js';
import { rememberLesson, lessonWork, explorationProgress, readSession } from './progress.js';
import { arcadeArt } from './arcade-art.js';
import { createAccountClient, mountAccount } from './account.js';
import { progressStorage } from './save-data.js';
import { mountSaves } from './saves-ui.js';
import { mountGuide } from './guide-ui.js';
import { mountLessonScene } from './lesson-scene-ui.js';
import {mountRewrite} from './rewrite-ui.js';
import {beginRewrite,lessonDiagnostic} from './rewrite.js';
import {newDiagnostic,normalizeDiagnostic} from './diagnostic.js';
import { mountDiagnostic } from './diagnostic-ui.js';
import { mountLearningMap } from './learning-map-ui.js';
import { readGuideWork } from './guide.js';
import { selectedLocale, languageUrl, parseRoute, routeUrl } from './routing.js';

const $ = id => document.getElementById(id);
const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function prose(text){
  const pattern=/let [A-Za-z_]\w* = \d+;|\b[A-Za-z_]\w*\([^()\n]*\)|\([^\)\n]+\)(?:\.log\(\))?|\.log\(\)|\b(?:[A-Za-z_]\w*|\d+) \+ \d+\b|return\s*!|\bsync fn\b|\b(?:let|log|n|TVM|Tolang|ALUX|gas|return|fn|if|then|else|for|while|in|true|false|and|or|cargo|reserve|threshold|docks|offset|west|east|fuel)\b|\+/g;
  let cursor=0,result='';for(const match of String(text).matchAll(pattern)){result+=escape(text.slice(cursor,match.index))+`<bdi dir="ltr">${escape(match[0])}</bdi>`;cursor=match.index+match[0].length;}return result+escape(text.slice(cursor));
}
const storageKey='loopuff-v1', reduced=matchMedia('(prefers-reduced-motion: reduce)');
// Finish any interrupted restore before legacy loaders read their separate keys.
try{if((await progressStorage().recover()).status==='recovered')location.reload();}catch{}
let saved={};try{saved=readSession(localStorage.getItem(storageKey));}catch{}
const validLocale=id=>locales.some(([key])=>key===id);
let lang=selectedLocale(location.href,saved.lang,navigator.languages||[navigator.language]);
if(!validLocale(lang))lang='en';
let programScene=null,jumpLab=null,vaultGame=null,chaseGame=null,pursuitGame=null,heistGame=null,dispatchGame=null,accountPage=null,savesPage=null,guidePage=null;
const savesModel={},diagnosticModel={};
const guideModel={selected:saved.state?.guideSelected,drafts:readGuideWork(saved.state?.guideWork)};
const pursuitModel={},heistModel={};
let guideView='guide',diagnosticReturn=false,dispatchMission=null;
let chaseLab=new URL(location.href).searchParams.get('mode')==='lab';
const account=createAccountClient({url:location.href,onChange:()=>{if(messages){updateAccountEntry();accountPage?.refresh();savesPage?.refresh();}}});
let messages, languageRequest=0, languageController, notice='', lastResult=null, feedbackState=null;
const initialCatalog=document.getElementById('initial-catalog');
const catalogs=new Map(initialCatalog?[[initialCatalog.dataset.locale,JSON.parse(initialCatalog.textContent)]]:[]);
let state={phase:'welcome',lesson:0,fragment:0,typed:'',draft:'',assessedSource:null,grades:{},score:0,errors:0,keys:0,completed:[],...saved.state};
if(!state.grades||typeof state.grades!=='object'||Array.isArray(state.grades))state.grades={};
if(!['welcome','levels','brief','typing','predict','output','explain','remix','rewrite','independent','result','complete','guide','pause','play','vault','chase','dispatch','heist','account','saves'].includes(state.phase)) state.phase='welcome';
if(!Number.isInteger(state.lesson)||state.lesson<0||state.lesson>=course.length)state.lesson=0;
state.completed=[...new Set(Array.isArray(state.completed)?state.completed.filter(id=>course.some(l=>l.id===id)):[])];
rememberLesson(state,course[state.lesson].id);
// Migrate the previous single-lesson save even when it was left on a menu.
if(!lessonWork(state,course[state.lesson].id))rememberLesson(state,course[state.lesson].id,state.resumePhase);
function readRoute(){
  const route=parseRoute(location.pathname),previousLesson=state.lesson;
  dispatchMission=route?.view==='dispatch'?requestedDispatchMission(location.href):null;
  diagnosticReturn=['lesson','result'].includes(route?.view)&&new URL(location.href).searchParams.get('return')==='diagnostic';
  if(route?.view==='chase')chaseLab=new URL(location.href).searchParams.get('mode')==='lab';
  if(route?.lessonId){
    const index=course.findIndex(item=>item.id===route.lessonId);
    if(previousLesson!==index){rememberLesson(state,course[previousLesson].id);state.lesson=index;Object.assign(state,lessonWork(state,course[index].id)||{phase:'brief',fragment:0,typed:'',draft:'',rewriteDraft:undefined,assessedSource:null,score:0,errors:0,keys:0});}
  }
  if(['play','vault','chase','dispatch','heist','account','saves'].includes(route?.view))state.phase=route.view;
  else if(route?.view==='result')state.phase='result';
  else if(route?.view==='levels'){state.phase='play';const target=routeUrl(location.href,lang,'play');target.hash='missions';history.replaceState(null,'',target);}
  else if(['guide','compare','map','check'].includes(route?.view)){if(!['guide','welcome','pause'].includes(state.phase))state.resumePhase=state.phase;state.phase='guide';guideView=route.view;}
  else if(route?.view==='lesson'){
    if(previousLesson!==state.lesson){if(state.phase==='result')state.phase='independent';}
    else if(state.phase==='result')state.phase='independent';
    else if(state.phase==='pause')state.phase=state.previousPhase||'brief';
    else if(['welcome','levels','guide','play','vault','chase','dispatch','heist','account','saves'].includes(state.phase))Object.assign(state,lessonWork(state,course[state.lesson].id)||{phase:'brief'});
  }else{
    if(!['welcome','pause','guide'].includes(state.phase))state.resumePhase=state.phase;
    state.phase='welcome';
  }
  if(route?.view==='lesson'){
    const practice=new URL(location.href).searchParams.get('practice');
    if(practice==='independent')state.phase='independent';
    if(practice==='rewrite'||state.phase==='rewrite')beginRewrite(state,course[state.lesson].id);
  }
  if(route?.view==='check')selectDiagnostic(new URL(location.href).searchParams.get('area'));
}
readRoute();
const ui=key=>messages.ui[key], lesson=()=>course[state.lesson], copy=()=>messages.lessons[state.lesson];
const fragments=()=>lesson().fragments;
async function save(){rememberLesson(state,lesson().id);try{const raw=JSON.stringify({lang,state});await progressStorage().write(()=>localStorage.setItem(storageKey,raw));$('save-status').textContent=ui('save');await savesPage?.localSaved();return true;}catch{$('save-status').textContent=ui('nosave');return false;}}
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
function updateAccountEntry(){const link=$('account-entry');if(!link)return;link.textContent=messages.account[account.user?'signed':'entry'];link.href=routeUrl(location.href,lang,'account').pathname;link.setAttribute('aria-current',state.phase==='account'?'page':'false');}
function applyStatic(){
  updateAccountEntry();
  $('brand-name').textContent=ui('name');document.querySelector('.brand').setAttribute('aria-label',`${ui('name')} · ${ui('home')}`);
  document.querySelector('.brand').href=routeUrl(location.href,lang,'home').pathname;
  document.querySelector('.edition').textContent=ui('tagline');
  $('language-label').textContent=ui('language');$('language-select').setAttribute('aria-label',ui('language'));
  $('language-select').innerHTML=locales.map(([id,label])=>`<option value="${id}">${label}</option>`).join('');$('language-select').value=lang;
  $('home-plane').setAttribute('aria-label',ui('movePlane'));$('home-plane').title=ui('movePlane');
  $('pause-button').innerHTML=`<span aria-hidden="true">Ⅱ</span> <span class="pause-word">${escape(ui('pause'))}</span>`;$('pause-button').setAttribute('aria-label',ui('pause'));document.querySelector('.header-controls').setAttribute('aria-label',ui('navigation'));
  const navigation=$('page-navigation');
  navigation.hidden=false;navigation.setAttribute('aria-label',ui('navigation'));
  navigation.innerHTML=`<a data-action="home" href="${routeUrl(location.href,lang,'home').pathname}" ${state.phase==='welcome'?'aria-current="page"':''}>${escape(ui('navHome'))}</a><a data-action="open-play" href="${routeUrl(location.href,lang,'play').pathname}" ${!['welcome','guide','account','saves'].includes(state.phase)?'aria-current="page"':''}>${escape(messages.vault.arcade)}</a><a data-action="open-guide" aria-label="${escape(ui('navGuide'))}" href="${routeUrl(location.href,lang,'guide').pathname}" ${state.phase==='guide'?'aria-current="page"':''}><span class="nav-label-full">${escape(ui('navGuide'))}</span><span class="nav-label-short">${escape(ui('navGuideShort'))}</span></a>`;
  $('universe').setAttribute('aria-label',ui('map'));document.querySelector('.coordinate').textContent='LOOPUFF / 01';
  document.querySelector('.welcome .eyebrow').textContent=ui('pilot');
  document.querySelector('.welcome h1').innerHTML=ui('hero').split(/\\n|\n/).map(line=>{const accent=ui('heroAccent'),at=line.indexOf(accent);return at<0?escape(line):escape(line.slice(0,at))+`<span class="hero-accent">${escape(accent)}</span>`+escape(line.slice(at+accent.length));}).join('<br>');
  document.querySelector('.welcome-copy').textContent=ui('lead');
  $('start').textContent=ui(state.completed.length||state.resumePhase?'resume':'start');$('how-button').textContent=messages.beginner.mapGo;
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
  const view=state.phase==='welcome'?'home':state.phase==='guide'?guideView:['levels','result','play','vault','chase','dispatch','heist','account','saves'].includes(state.phase)?state.phase:'lesson';
  const url=routeUrl(location.href,lang,view,lesson().id);url.hash='';
  if(view==='chase'&&chaseLab)url.searchParams.set('mode','lab');else url.searchParams.delete('mode');
  if(view==='lesson'&&['rewrite','independent'].includes(state.phase))url.searchParams.set('practice',state.phase);else url.searchParams.delete('practice');
  url.searchParams.delete('area');
  if(view==='dispatch'&&dispatchMission)url.searchParams.set('mission',dispatchMission);else url.searchParams.delete('mission');
  if(diagnosticReturn&&['lesson','result'].includes(view))url.searchParams.set('return','diagnostic');else url.searchParams.delete('return');
  if(location.pathname!==url.pathname||location.search!==url.search)history.pushState(null,'',url);
}
function begin(index){rememberLesson(state,lesson().id);state={...state,phase:'brief',lesson:index,fragment:0,typed:'',draft:'',rewriteDraft:undefined,assessedSource:null,score:0,errors:0,keys:0};notice='';feedbackState=null;lastResult=null;syncRoute();render();save();window.scrollTo(0,0);}
function enterLesson(index){
  rememberLesson(state,lesson().id);const work=lessonWork(state,course[index].id);
  if(!work){begin(index);return;}
  Object.assign(state,work,{lesson:index});notice='';feedbackState=null;lastResult=null;
  syncRoute();render();save();window.scrollTo(0,0);
}
function openRewrite(source){
  rememberLesson(state,lesson().id);beginRewrite(state,lesson().id,source);notice='';feedbackState=null;lastResult=null;syncRoute();render();save();window.scrollTo(0,0);$('rewrite-editor')?.focus({preventScroll:true});
}
function selectDiagnostic(area){
  if(!Object.values(lessonDiagnostic).includes(area))return;
  try{const value=state.diagnostic===undefined?newDiagnostic(crypto.getRandomValues(new Uint32Array(1))[0]):normalizeDiagnostic(state.diagnostic);state.diagnostic={...value,selected:area};}catch{}
}
function move(phase){rememberLesson(state,lesson().id);if(phase==='welcome'&&['brief','typing','predict','output','explain','remix','rewrite','independent','result','complete'].includes(state.phase))state.resumePhase=state.phase;state.phase=phase;notice='';feedbackState=null;lastResult=null;syncRoute();render();save();window.scrollTo(0,0);if(!$('learning-page').hidden)$('learning-page').focus({preventScroll:true});}
function actions(buttons){return `<div class="dialog-actions">${buttons.map(([action,label,secondary])=>`<button class="${secondary?'text-button':'primary'}" data-action="${action}">${escape(label)}</button>`).join('')}</div>`;}
function codeBlock(source){return `<pre class="exercise-code" dir="ltr">${escape(source)}</pre>`;}
function arcadeMissions(){
 const next=course.findIndex(l=>!state.completed.includes(l.id)),active=course[next]?.track||'beginner';
 const tracks=[['beginner','trackBeginner',messages.vault.title,'vault'],['tolang','trackTolang',messages.dispatch.title,'dispatch'],['advanced','trackAdvanced',messages.dispatch.missions[3].title,'dispatch']];
 return `<section id="missions" class="arcade-missions" aria-label="${escape(ui('routeTitle'))}"><header><h2>${escape(ui('routeTitle'))}</h2><p>${escape(ui('routeIntro'))}</p></header>${tracks.map(([track,label,station,view])=>{
  const items=course.map((l,i)=>({l,i})).filter(({l})=>(l.track||'beginner')===track),completed=items.filter(({l})=>state.completed.includes(l.id)).length;
  return `<details class="arcade-track"${track===active?' open':''}><summary><span><small>${escape(station)}</small><strong>${escape(ui(label))}</strong></span><bdi dir="ltr">${completed} / ${items.length}</bdi></summary><ol>${items.map(({l,i})=>`<li data-state="${state.completed.includes(l.id)?'done':i===next?'next':'available'}"><a href="${routeUrl(location.href,lang,'lesson',l.id).pathname}" data-lesson="${i}"><span class="mission-number" aria-hidden="true">${state.completed.includes(l.id)?'✓':String(i+1).padStart(2,'0')}</span><span><strong>${escape(messages.lessons[i].title)}</strong><span>${escape(messages.lessons[i].goal)}</span></span><small>${escape(ui(state.completed.includes(l.id)?'done':lessonWork(state,l.id)?'resume':i===next?'next':'open'))}</small></a></li>`).join('')}</ol><a class="mission-destination" data-action="open-${view}" href="${routeUrl(location.href,lang,view).pathname}">${escape(station)} <span aria-hidden="true">↗</span></a></details>`;
 }).join('')}</section>`;
}
function choices(items,action){return `<div class="choices">${items.map((text,index)=>`<button class="choice" data-${action}="${index}"><span>${String(index+1).padStart(2,'0')}</span>${prose(text||ui('noOutput'))}</button>`).join('')}</div>`;}
function render(){
  programScene?.dispose();programScene=null;
  jumpLab?.dispose();jumpLab=null;
  vaultGame?.dispose();vaultGame=null;
  chaseGame?.dispose();chaseGame=null;
  pursuitGame?.dispose();pursuitGame=null;
  heistGame?.dispose();heistGame=null;
  accountPage?.dispose();accountPage=null;
  savesPage?.dispose();savesPage=null;
  dispatchGame?.dispose();dispatchGame=null;
  guidePage?.dispose();guidePage=null;
  applyStatic();const phase=state.phase, typing=phase==='typing';
  const page=!['welcome','typing','pause'].includes(phase);
  document.body.dataset.view=page?'learning':'game';
  document.body.dataset.phase=phase;
  $('universe').hidden=page;$('learning-page').hidden=!page;
  $('universe').dataset.phase=phase;$('welcome').hidden=phase!=='welcome';$('welcome-foot').hidden=phase!=='welcome';
  $('home-plane').hidden=phase!=='welcome';
  for(const id of ['flight-hud','code-coach','target','cockpit'])$(id).hidden=!typing;
  $('pause-button').hidden=!typing;
  if(phase!=='pause'){$('flow-dialog').close();$('dialog-content').textContent='';}
  if(typing)renderTyping();else if(phase!=='welcome')renderDialog();
  if(['levels','play'].includes(phase))document.querySelector('.journey-panel')?.insertAdjacentHTML('beforeend',`<a class="journey-backup" data-action="open-saves" href="${routeUrl(location.href,lang,'saves').pathname}">${escape(messages.saves.title)} <span aria-hidden="true">↗</span></a>`);
  const view=parseRoute(location.pathname)?.view||'home';
  document.title=`${ui('name')} · ${view==='check'?messages.diagnostic.title:view==='map'?messages.learningMap.title:view==='compare'?messages.guideStudio.compareTitle:view==='saves'?messages.saves.title:view==='heist'?messages.heist.title:view==='dispatch'?messages.dispatch.title:view==='chase'?messages.chase.title:view==='account'?messages.account.entry:view==='vault'?messages.vault.title:view==='play'?messages.vault.arcade:view==='result'?messages.assessment.title:view==='levels'?ui('navCourse'):view==='guide'?ui('guide'):view==='lesson'?copy().title:ui('tagline')}`;
  document.querySelector('link[rel="canonical"]').href=routeUrl('https://shixilin.com/games/loopuff/',lang,view,lesson().id).href;
  let robots=document.querySelector('meta[name="robots"]');
  if(view==='result'){if(!robots){robots=document.createElement('meta');robots.name='robots';document.head.append(robots);}robots.content='noindex,follow';}else robots?.remove();
  attachLessonScene();attachJumpScene();
  if(diagnosticReturn&&['lesson','result'].includes(view))$('learning-content').insertAdjacentHTML('afterbegin',`<p class="diagnostic-return"><a data-action="open-check" href="${routeUrl(location.href,lang,'check').pathname}"><span aria-hidden="true">←</span> ${escape(messages.diagnosticFeedback.returnToDiagnostic)}</a></p>`);
  requestAnimationFrame(()=>{refreshGeometry();if(state.phase==='typing')background();homePlane.refresh();});
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
  const errorKey=report.result?.waiting&&!report.ok?'waiting':report.code==='name'?'nameError':report.code;
  const explanation=(report.ok?a.success:ui(errorKey)||ui('limit'))+(report.code==='syntax'?` ${report.position+1}.`:'');
  const checks=report.checks.map(check=>`<li class="assessment-check" data-status="${check.status}"><div><span>${escape(a.labels[check.id])}</span><bdi dir="ltr">${check.points} / ${check.max}</bdi></div><small>${escape(a[check.status])}</small>${check.requirements?`<ul class="concept-checks">${check.requirements.map(item=>`<li><span aria-hidden="true">${check.status==='blocked'?'○':item.passed?'✓':'○'}</span> <span class="sr-only">${escape(check.status==='blocked'?a.blocked:item.passed?a.pass:a.fail)}: </span>${escape(a.concepts[item.concept])}</li>`).join('')}</ul>`:''}</li>`).join('');
  return `<section class="result-report" data-score="${report.score}" data-passed="${report.ok}"><header class="result-hero"><div><span class="eyebrow">${escape(ui('mission'))} ${String(state.lesson+1).padStart(2,'0')} · ${escape(copy().title)}</span><h1 id="learning-title">${escape(a.title)}</h1><p>${escape(report.ok?a.success:a.retry)}</p></div><div class="score-orbit" style="--score:${report.score}%"><div><strong><bdi dir="ltr">${report.score}</bdi></strong><span>${escape(a.score)} <bdi dir="ltr">/ 100</bdi></span></div></div></header><div class="result-toolbar">${actions(report.ok?[['finish-assessment',a.continue],['edit-assessment',a.edit,true]]:[['edit-assessment',a.edit]])}<p class="scope-note">${escape(a.note)}</p></div><section class="result-breakdown"><h2>${escape(a.breakdown)}</h2><ul class="assessment-checks">${checks}</ul>${report.ok?'':`<p class="assessment-explanation" role="status">${prose(explanation)}</p>`}</section><div class="result-work"><section><h2>${escape(a.yourCode)}</h2>${codeBlock(state.assessedSource)}</section><section><h2>${escape(ui('output'))}</h2><div class="assessment-outputs"><div><small>${escape(a.expected)}</small>${codeBlock(lesson().independent.logs.join('\n'))}</div><div><small>${escape(a.actual)}</small>${codeBlock(report.result?report.result.logs.join('\n')||ui('noOutput'):a.notRun)}</div></div></section></div></section>`;
}
function journeyPanel(){
  const t=messages.journey,p=explorationProgress(state,loadVault(),course.map(l=>l.id));
  const next=p.next>=0?p.next:p.stamps<3?'vault':0;
  const destination=next==='vault'?routeUrl(location.href,lang,'vault'):routeUrl(location.href,lang,'lesson',course[next].id);
  const target=next==='vault'?messages.vault.title:messages.lessons[next].title;
  const action=next==='vault'?'data-action="open-vault"':`data-lesson="${next}"`;
  return `<section class="journey-panel journey-compact" aria-label="${escape(t.title)}"><div class="journey-next"><a ${action} href="${destination.pathname}"><span>${escape(t.next)}</span><strong>${escape(target)} <span aria-hidden="true">↗</span></strong></a></div><details class="journey-records"><summary>${escape(t.title)} <bdi dir="ltr">${p.completed} / ${course.length}</bdi></summary><dl class="journey-totals"><div><dt>${escape(t.points)}</dt><dd><bdi dir="ltr">${p.points}</bdi><span aria-hidden="true">✦</span></dd></div><div><dt>${escape(t.lessons)}</dt><dd><bdi dir="ltr">${p.completed} / ${course.length}</bdi></dd></div><div><dt>${escape(messages.vault.collection)}</dt><dd><bdi dir="ltr">${p.stamps} / 3</bdi></dd></div></dl><p>${escape(t.rule)}</p><small>${escape(t.local)}</small></details></section>`;
}
function renderDialog(){
  if(state.phase==='guide'){
    $('learning-page').dataset.stage='guide';$('learning-content').innerHTML='<div id="guide-studio"></div>';
    if(guideView==='check'){guidePage=mountDiagnostic($('guide-studio'),{text:messages.diagnostic,feedbackText:messages.diagnosticFeedback,applicationText:messages.learningTransfer,applicationTitles:messages.dispatch.missions.map(m=>m.title),onSelect:area=>{const url=diagnosticAreaUrl(location.href,lang,area);if(location.href!==url.href)history.replaceState(null,'',url);},ui:messages.ui,errors:messages.ui,concepts:messages.assessment.concepts,statuses:messages.assessment,lessons:Object.fromEntries(course.map((l,i)=>[l.id,messages.lessons[i]])),initial:state.diagnostic,model:diagnosticModel,reduced,urls:{home:routeUrl(location.href,lang,'home').pathname,guide:routeUrl(location.href,lang,'guide').pathname,map:routeUrl(location.href,lang,'map').pathname,saves:routeUrl(location.href,lang,'saves').pathname,lesson:id=>routeUrl(location.href,lang,'lesson',id).pathname,application:mission=>dispatchMissionUrl(location.href,lang,mission).href},onChange:value=>{state.diagnostic=value;return save();}});return;}
    if(guideView==='map'){guidePage=mountLearningMap($('guide-studio'),{beginner:messages.beginner,text:messages.learningMap,lessons:messages.lessons,ui:messages.ui,errors:messages.ui,completed:state.completed,model:guideModel,urls:{home:routeUrl(location.href,lang,'home').pathname,guide:routeUrl(location.href,lang,'guide').pathname,compare:routeUrl(location.href,lang,'compare').pathname,lesson:id=>routeUrl(location.href,lang,'lesson',id).pathname}});return;}
    guidePage=mountGuide($('guide-studio'),{experimentText:messages.causalExperiments,beginner:messages.beginner,text:messages.guideStudio,rewriteText:messages.rewrite,legacy:messages.guide,errors:messages.ui,ui:messages.ui,model:guideModel,compare:guideView==='compare',reduced,onChange:()=>{state.guideWork={...guideModel.drafts};state.guideSelected=guideModel.selected;save();},urls:{home:routeUrl(location.href,lang,'home').pathname,guide:routeUrl(location.href,lang,'guide').pathname,compare:routeUrl(location.href,lang,'compare').pathname,map:routeUrl(location.href,lang,'map').pathname,mapLabel:messages.learningMap.title,check:routeUrl(location.href,lang,'check').pathname,checkLabel:messages.saves.diagnosticTitle,dispatch:routeUrl(location.href,lang,'dispatch').pathname,lesson:id=>routeUrl(location.href,lang,'lesson',id).pathname}});
    return;
  }
  const c=copy(),phase=state.phase;let title='',body='';
  if(phase==='rewrite'){
   $('learning-page').dataset.stage=phase;$('learning-content').innerHTML=`<nav class="page-trail"><a data-action="open-play" href="${routeUrl(location.href,lang,'play').pathname}">${escape(messages.vault.arcade)}</a><span aria-hidden="true">/</span><span>${escape(c.title)}</span></nav><div id="rewrite-page"></div>`;
   guidePage=mountRewrite($('rewrite-page'),{id:lesson().id,text:messages.rewrite,ui:messages.ui,sceneText:messages.lessonScene,assessmentText:messages.assessment,hintText:messages.diagnosticFeedback,jumpText:messages.jump,reduced,getSource:()=>state.rewriteDraft,onChange:value=>{state.rewriteDraft=value;return save();},onIndependent:()=>{move('independent');$('program-editor')?.focus();}});return;
  }
  if(phase==='heist'){
   $('learning-page').dataset.stage=phase;
   $('learning-content').innerHTML=`<nav class="page-trail" aria-label="${escape(ui('navigation'))}"><a data-action="open-play" href="${routeUrl(location.href,lang,'play').pathname}">${escape(messages.vault.arcade)}</a><span aria-hidden="true">/</span><span aria-current="page">${escape(messages.heist.title)}</span></nav><div id="heist-game"></div>`;
   heistGame=mountHeist($('heist-game'),{text:messages.heist,errors:messages.ui,model:heistModel,saveUrl:routeUrl(location.href,lang,'saves').pathname,saveLabel:messages.saves.title});return;
  }
  if(phase==='chase'){
    $('learning-page').dataset.stage=phase;
    $('learning-content').innerHTML=`<nav class="page-trail" aria-label="${escape(ui('navigation'))}"><a data-action="home" href="${routeUrl(location.href,lang,'home').pathname}">${escape(ui('navHome'))}</a><span aria-hidden="true">/</span><a data-action="open-play" href="${routeUrl(location.href,lang,'play').pathname}">${escape(messages.vault.arcade)}</a><span aria-hidden="true">/</span><span aria-current="page">${escape(messages.chase.title)}</span></nav><div id="chase-game"></div>`;
    $('chase-game').insertAdjacentHTML('beforebegin',`<div class="chase-modes" role="group" aria-label="${escape(messages.chase.title)}"><button type="button" data-action="chase-continuous" aria-pressed="${!chaseLab}">${escape(messages.pursuit.continuous)}</button><button type="button" data-action="chase-lab" aria-pressed="${chaseLab}">${escape(messages.pursuit.lab)}</button></div>`);
    if(chaseLab)chaseGame=mountChase($('chase-game'),{text:messages.chase,errors:messages.ui,reduced});
    else pursuitGame=mountPursuit($('chase-game'),{text:messages.pursuit,practiceText:messages.pursuitPractice,roles:messages.chase,errors:messages.ui,reduced,saveUrl:routeUrl(location.href,lang,'saves').pathname,saveLabel:messages.saves.title,model:pursuitModel});return;
  }
  if(phase==='account'){$('learning-content').innerHTML='<div id="account-page"></div>';accountPage=mountAccount($('account-page'),{client:account,text:messages.account,locale:lang,saveNote:ui('save'),homeUrl:routeUrl(location.href,lang,'home').pathname,savesUrl:routeUrl(location.href,lang,'saves').pathname,saveLabel:messages.saves.title});return;}
  if(phase==='saves'){
   $('learning-page').dataset.stage=phase;$('learning-content').innerHTML='<div id="saves-page"></div>';
   savesPage=mountSaves($('saves-page'),{text:messages.saves,topics:{course:ui('navCourse'),guide:ui('navGuide'),vault:messages.vault.title,chase:messages.chase.title,dispatch:messages.dispatch.title,pursuit:messages.pursuit.title,heist:messages.heist.title,police:messages.chase.police,thief:messages.chase.thief,dispatchTasks:messages.dispatch.missions.map(m=>m.title)},pursuitText:messages.pursuit,heistText:messages.heist,diagnosticText:messages.diagnostic,rewriteText:messages.rewrite,lessons:messages.lessons,phases:{brief:ui('mission'),typing:ui('assembled'),predict:ui('predict'),output:ui('output'),explain:ui('explain'),remix:ui('practice'),rewrite:messages.rewrite.title,independent:ui('independent'),result:messages.assessment.title,complete:ui('complete')},account,locale:lang,name:ui('name'),urls:{account:routeUrl(location.href,lang,'account').pathname},model:savesModel});return;
  }
  if(phase==='dispatch'){
    $('learning-page').dataset.stage=phase;
    $('learning-content').innerHTML='<div id="dispatch-game"></div>';
    dispatchGame=mountDispatch($('dispatch-game'),{text:messages.dispatch,initialMission:dispatchMission,onSelect:mission=>{dispatchMission=mission;const url=dispatchMissionUrl(location.href,lang,mission);if(location.href!==url.href)history.replaceState(null,'',url);},errors:messages.ui,concepts:messages.assessment.concepts,statuses:{pass:messages.assessment.pass,fail:messages.assessment.fail},reduced,format:prose,urls:{home:routeUrl(location.href,lang,'home').pathname,play:routeUrl(location.href,lang,'play').pathname,homeLabel:ui('navHome'),playLabel:messages.vault.arcade,lessons:['branch','repeat','function','coordination'].map(id=>routeUrl(location.href,lang,'lesson',id).pathname)}});
    return;
  }
  if(phase==='play'||phase==='vault'){

    $('learning-page').dataset.stage=phase;
    const v=messages.vault;
    const trail=`<nav class="page-trail" aria-label="${escape(ui('navigation'))}"><a data-action="home" href="${routeUrl(location.href,lang,'home').pathname}">${escape(ui('navHome'))}</a><span aria-hidden="true">/</span>${phase==='vault'?`<a data-action="open-play" href="${routeUrl(location.href,lang,'play').pathname}">${escape(v.arcade)}</a><span aria-hidden="true">/</span><span aria-current="page">${escape(v.title)}</span>`:`<span aria-current="page">${escape(v.arcade)}</span>`}</nav>`;
    $('learning-content').innerHTML=trail+(phase==='vault'?'<div id="vault-game"></div>':`<section class="arcade-page"><span class="eyebrow">${escape(ui('name'))}</span><h1 id="learning-title">${escape(v.arcadeTitle)}</h1><p class="levels-intro">${escape(v.arcadeIntro)}</p>${journeyPanel()}<div class="arcade-games"><a class="arcade-game vault-entry" data-action="open-vault" href="${routeUrl(location.href,lang,'vault').pathname}"><div class="arcade-vault-art" aria-hidden="true">${arcadeArt('vault')}</div><div><span class="eyebrow">${escape(v.puzzleTag)}</span><h2>${escape(v.title)}</h2><p>${escape(v.intro)}</p><span class="game-record">${escape(v.collection)} <bdi dir="ltr">${loadVault().stamps.length} / 3</bdi></span><strong>${escape((loadVault().stage||loadVault().submitted?ui('resume'):v.enter).replace(/\s*↗$/,''))} ↗</strong></div></a><a class="arcade-game jump-entry" href="${routeUrl(location.href,lang,'lesson',course[3].id).pathname}" data-lesson="3"><div class="arcade-jump-art" aria-hidden="true">${arcadeArt('jump')}</div><div><span class="eyebrow">${escape(v.jumpTag)}</span><h2>${escape(messages.jump.title)}</h2><p>${escape(messages.lessons[3].goal)}</p><span class="game-record">${escape(state.completed.includes(course[3].id)?ui('done'):lessonWork(state,course[3].id)?ui('resume'):ui('open'))}</span><strong>${escape((lessonWork(state,course[3].id)?ui('resume'):v.enter).replace(/\s*↗$/,''))} ↗</strong></div></a></div></section>`);
    if(phase==='vault')vaultGame=mountVault($('vault-game'),{beginner:messages.beginner,text:v,errors:messages.ui,reduced});
    else {const chase=loadChase();document.querySelector('.arcade-games').insertAdjacentHTML('beforeend',`<a class="arcade-game chase-entry" data-action="open-chase" href="${routeUrl(location.href,lang,'chase').pathname}"><div class="chase-card-art" aria-hidden="true"><img src="${new URL('../assets/chase-police-idle.webp',import.meta.url).href}" alt=""><img src="${new URL('../assets/chase-thief-idle.webp',import.meta.url).href}" alt=""></div><div><span class="eyebrow">${escape(messages.chase.tag)}</span><h2>${escape(messages.chase.title)}</h2><p>${escape(messages.pursuit.intro)}</p><span class="game-record">${escape(messages.pursuit.lab)}: ${escape(messages.chase.police)} <bdi dir="ltr">${chase.work.police.cleared.length} / 3</bdi> · ${escape(messages.chase.thief)} <bdi dir="ltr">${chase.work.thief.cleared.length} / 3</bdi></span><strong>${escape(v.enter.replace(/\s*↗$/,''))} ↗</strong></div></a>`);}
    if(phase==='play'){
      const dispatch=loadDispatch(),d=messages.dispatch;
      document.querySelector('.arcade-games').insertAdjacentHTML('beforeend',`<a class="arcade-game dispatch-entry" data-action="open-dispatch" href="${routeUrl(location.href,lang,'dispatch').pathname}"><div class="dispatch-card-art" aria-hidden="true"><img src="${aircraftUrl}" alt=""></div><div><span class="eyebrow">${escape(d.tag)}</span><h2>${escape(d.title)}</h2><p>${escape(d.entry)}</p><span class="game-record">${escape(d.badges)} <bdi dir="ltr">${dispatch.stamps.length} / 4</bdi></span><strong>${escape(v.enter.replace(/\s*↗$/,''))} ↗</strong></div></a>`);
      document.querySelector('.arcade-page').insertAdjacentHTML('beforeend',arcadeMissions());
      document.querySelector('.arcade-games').insertAdjacentHTML('beforeend',`<a class="arcade-game heist-entry" data-action="open-heist" href="${routeUrl(location.href,lang,'heist').pathname}"><div class="heist-card-art" aria-hidden="true"><span>01 → 02 → 03 → 04</span><svg viewBox="0 0 240 180"><path d="M25 67 120 21 215 67M38 80h164M40 151h160M30 165h180M56 80v71m43-71v71m43-71v71m43-71v71" fill="none" stroke="currentColor" stroke-width="9"/></svg></div><div><span class="eyebrow">${escape(messages.heist.tag)}</span><h2>${escape(messages.heist.title)}</h2><p>${escape(messages.heist.intro)}</p><strong>${escape(messages.heist.enter)} ↗</strong></div></a>`);
    }
    return;
  }
  if(phase==='brief'){title=c.title;body=`<p class="dialog-note">${prose(c.intro)}</p>${codeBlock(lesson().source)}<p>${prose(c.goal)}</p>${actions([[lesson().mode==='lab'?'observe-program':'type',ui(lesson().mode==='lab'?'observeProgram':'launch')]])}`;}
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
    title=ui('independent');body=`<div class="challenge-layout"><section class="challenge-brief"><h2>${escape(a.task)}</h2><p class="dialog-note">${prose(c.independent)}</p><p class="scope-note">${escape(a.intro)}</p>${actions([['hint',ui('hint'),true],['rewrite-program',messages.rewrite.back,true]])}<p class="scope-note">${escape(ui('scope'))}</p></section><form id="program-form"><label class="editor-label" for="program-editor">${escape(ui('codeLabel'))}</label><textarea id="program-editor" class="practice-editor" rows="8" autocomplete="off" autocapitalize="off" spellcheck="false" dir="ltr">${escape(state.draft)}</textarea><div class="dialog-actions"><button class="primary" type="submit">${escape(a.submit)}</button>${state.assessedSource!==null&&state.assessedSource===state.draft?`<button class="text-button" data-action="view-result" type="button">${escape(a.viewResult)}</button>`:''}</div><p id="assessment-status" class="scope-note" aria-live="polite"></p></form></div>`;
  }
  if(phase==='complete'){
    const application=lessonApplication(lesson().id);
    title=ui('complete');
    const summary=`<div class="signal">✧ ✧ ✧</div><p class="dialog-note">${prose(c.learned)}</p><p class="completed-grade">${escape(messages.assessment.score)} <bdi dir="ltr">${state.grades[lesson().id]?.score??100} / 100</bdi></p>${lesson().mode==='lab'?'':`<div class="score-summary"><div><small>${escape(ui('score'))}</small><strong>${state.score}</strong></div><div><small>${escape(ui('accuracy'))}</small><strong>${state.keys?Math.round(Math.max(0,1-state.errors/state.keys)*100):100}%</strong></div></div>`}<p class="scope-note">${escape(lesson().mode==='lab'?messages.assessment.note:ui('masteryNote'))}</p>`;
    const controls=actions([[state.lesson<course.length-1?'next':'home',ui(state.lesson<course.length-1?'next':'home')],...(lesson().mode==='lab'&&!application?[['open-dispatch',messages.dispatch.title,true]]:[]),['open-chase',ui('practiceInChase'),true],['replay',ui('replay'),true],['lesson-diagnostic',messages.rewrite.transfer,true]]);
    body=application?`<div class="completion-grid"><div class="completion-summary">${summary}${controls}</div>${applicationPanel(application,{text:messages.learningTransfer,titles:messages.dispatch.missions.map(m=>m.title),context:'lesson',href:dispatchMissionUrl(location.href,lang,application).href})}</div>`:summary+controls;
  }
  if(phase==='pause'){title=ui('pause');body=`<p class="dialog-note">${escape(ui('paused'))}</p>${actions([['resume',ui('resumePlay')],['restart',ui('restart'),true],['home',ui('home'),true]])}`;}
  if(phase==='pause'){
    $('flow-dialog').dataset.stage=phase;$('dialog-content').innerHTML=`<h2 id="dialog-title">${escape(title)}</h2>${body}`;
    if(!$('flow-dialog').open)$('flow-dialog').showModal();return;
  }
  $('learning-page').dataset.stage=phase;
  const trail=`<nav class="page-trail" aria-label="${escape(ui('map'))}"><a data-action="home" href="${routeUrl(location.href,lang,'home').pathname}">${escape(ui('home'))}</a><span aria-hidden="true">/</span>${phase==='result'?`<a data-action="edit-assessment" href="${routeUrl(location.href,lang,'lesson',lesson().id).pathname}">${escape(c.title)}</a><span aria-hidden="true">/</span><span aria-current="page">${escape(messages.assessment.title)}</span>`:`<span aria-current="page">${escape(phase==='guide'?ui('guide'):c.title)}</span>`}</nav>`;
  $('learning-content').innerHTML=trail+(phase==='result'?assessmentPanel():`<div class="lesson-page-body${phase==='complete'&&lessonApplication(lesson().id)?' has-application':''}"><span class="eyebrow">${escape(ui('name'))} / ${String(state.lesson+1).padStart(2,'0')}</span><h1 id="learning-title">${escape(title)}</h1>${body}<p class="feedback" id="feedback" role="status" aria-live="polite">${prose(notice)}</p><div id="practice-output" class="practice-output" ${lastResult?'':'hidden'}>${lastResult?escape(ui('output'))+codeBlock(lastResult.logs.join('\n')||ui('noOutput')):''}</div></div>`);
}
function observedSource(){return state.phase==='remix'?lesson().remix.template.replace('___',state.draft.trim()):state.phase==='result'?state.assessedSource:state.phase==='independent'?state.draft:lesson().source;}
function attachLessonScene(){
  const phase=state.phase;if(lesson().world||!['brief','output','explain','remix','independent','result'].includes(phase))return;
  if(phase==='result'&&(state.assessedSource===null||state.assessedSource!==state.draft))return;
  const expected=phase==='remix'?lesson().remix.logs:['independent','result'].includes(phase)?lesson().independent.logs:lesson().logs;
  const root=document.createElement('div');root.className='lesson-observation';root.id='lesson-observation';
  const body=$('learning-content').querySelector('.lesson-page-body');
  if(phase==='independent'){
    body.classList.add('observed-independent');const brief=body.querySelector('.challenge-brief'),form=$('program-form');
    body.querySelector('h1').textContent=copy().title;body.querySelector('.eyebrow').textContent=ui('independent');
    body.querySelector('.challenge-layout').before(brief.querySelector('.dialog-note'));brief.querySelector('h2').classList.add('sr-only');brief.prepend(root);
    const notes=document.createElement('details');notes.className='lesson-background';const summary=document.createElement('summary');summary.textContent=messages.guideStudio.background;notes.append(summary);
    for(const node of [...brief.querySelectorAll('.scope-note')])notes.append(node);form.append(notes);
    const note=document.createElement('p');note.className='scope-note';note.textContent=messages.lessonScene.practice;form.append(note);
  }else if(phase==='remix'){
    const workspace=document.createElement('div'),controls=document.createElement('div');workspace.className='scene-workbench';const intro=body.querySelector('.dialog-note');intro.remove();
    for(const node of [...body.children].slice(2))controls.append(node);workspace.append(controls,root);body.append(intro,workspace);
  }else if(phase==='result')$('learning-content').querySelector('.result-breakdown').before(root);
  else{body.querySelector('.dialog-note').after(root);if(phase==='output')body.querySelector('.signal')?.remove();}
  programScene=mountLessonScene(root,{text:messages.lessonScene,errors:messages.ui,expected,getSource:observedSource,locked:phase==='brief',reduced});
  if(['output','explain','result'].includes(phase))programScene.run({end:phase!=='output',autoplay:phase==='output'});
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
    state.draft='';state.assessedSource=null;openRewrite(source);
  }catch(error){lastResult=null;feedback(error.code==='syntax'?'syntax':error.code==='name'?'nameError':'limit',false,error.code==='syntax'?` ${error.position+1}.`:'');}
}
function pause(){if(state.phase==='welcome'||state.phase==='pause')return;state.previousPhase=state.phase;move('pause');}
document.addEventListener('change',event=>{if(event.target.matches('[data-language],#language-select'))changeLanguage(event.target.value);});
document.addEventListener('input',event=>{if(event.target.id==='program-editor'){
  state.draft=event.target.value;
  jumpLab?.reset();programScene?.reset();
  if(state.phase==='independent'&&state.assessedSource!==null){state.assessedSource=null;$('assessment-status').textContent=messages.assessment.changed;document.querySelector('[data-action="view-result"]')?.remove();}
  save();
}});
document.addEventListener('submit',event=>{if(event.target.id==='program-form'){event.preventDefault();submitProgram();}});
document.addEventListener('click',event=>{
  const target=event.target.closest('button,a[data-action],a[data-lesson]');if(!target)return;
  if(target.tagName==='A'){if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();}
  if(target.dataset.prediction!==undefined){if(Number(target.dataset.prediction)===lesson().predictionAnswer)move('output');else feedback('predictionHint');return;}
  if(target.dataset.answer!==undefined){if(Number(target.dataset.answer)===(lesson().explanationAnswer??0)){state.draft='';move('remix');}else feedback('answerHint',true);return;}
  if(target.dataset.lesson!==undefined){diagnosticReturn=target.dataset.diagnosticReturn==='true';const guideSource=guideModel.drafts[course[Number(target.dataset.lesson)].id];enterLesson(Number(target.dataset.lesson));if(target.dataset.practice==='rewrite')openRewrite(guideSource);else if(target.dataset.practice==='true')move('independent');return;}
  const action=target.dataset.action;
  if(action==='observe-program'){move('predict');return;}
  if(action==='try-jump'){tryJump();return;}
  if(action==='open-account'){move('account');return;}
  if(action==='open-saves'){move('saves');return;}
  if(action==='open-play'){move('play');return;}
  if(action==='open-dispatch'){dispatchMission=dispatchIds.includes(target.dataset.mission)?target.dataset.mission:state.phase==='complete'?lessonApplication(lesson().id):null;move('dispatch');return;}
  if(action==='open-heist'){move('heist');return;}
  if(action==='open-vault'){move('vault');return;}
  if(action==='open-chase'){chaseLab=false;move('chase');return;}
  if(action==='chase-continuous'||action==='chase-lab'){chaseLab=action==='chase-lab';move('chase');return;}
  if(action==='open-levels'){move('play');return;}
  if(action==='open-guide'||action==='open-compare'||action==='open-map'||action==='open-check'){if(!['welcome','guide','pause'].includes(state.phase))state.resumePhase=state.phase;guideView=action==='open-check'?'check':action==='open-map'?'map':action==='open-compare'?'compare':'guide';move('guide');return;}
  if(action==='resume-course'){if(state.phase==='guide')enterLesson(state.lesson);else if(state.phase==='result')move('independent');return;}
  if(action==='rewrite-program'){openRewrite();return;}
  if(action==='lesson-diagnostic'){selectDiagnostic(lessonDiagnostic[lesson().id]);guideView='check';move('guide');return;}
  if(action==='edit-assessment'){move('independent');$('program-editor')?.focus();return;}
  if(action==='view-result'&&state.assessedSource!==null&&state.assessedSource===state.draft){move('result');return;}
  if(action==='finish-assessment'&&state.phase==='result'&&state.assessedSource===state.draft&&grade(state.draft,lesson().independent).ok){
    if(!state.completed.includes(lesson().id))state.completed.push(lesson().id);
    beacon=1;burst(W*.5,H*.4,28);move('complete');return;
  }
  if(action==='type'){state.fragment=0;state.typed='';state.score=0;state.keys=0;state.errors=0;move('typing');$('typing-field').focus();}
  if(action==='explain')move('explain');
  if(action==='hint')feedback(state.phase==='remix'?'remixHint':'independentHint',true);
  if(action==='next')enterLesson(state.lesson+1);
  if(action==='replay'||action==='restart')begin(state.lesson);
  if(action==='home'){move('welcome');}
  if(action==='resume')move(state.previousPhase||'typing');
});
$('start').onclick=()=>{if(lessonWork(state,lesson().id))enterLesson(state.lesson);else enterLesson(Math.max(0,course.findIndex(l=>!state.completed.includes(l.id))));};
$('how-button').onclick=()=>{guideView='guide';move('guide');};
$('play-button').onclick=()=>move('play');
$('pause-button').onclick=pause;
$('typing-field').addEventListener('input',onTyping);$('typing-field').addEventListener('compositionend',onTyping);
$('flow-dialog').addEventListener('cancel',event=>{event.preventDefault();if(state.phase==='pause')move(state.previousPhase||'typing');else pause();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.phase==='typing')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.phase==='typing')pause();});
document.querySelector('.brand').onclick=event=>{event.preventDefault();move('welcome');};
window.addEventListener('popstate',()=>{readRoute();notice='';feedbackState=null;lastResult=null;const locale=parseRoute(location.pathname)?.locale;if(locale&&locale!==lang)changeLanguage(locale);else{render();save();}window.scrollTo(0,0);});

// Geometry is measured after layout changes, not on each animation frame.
let flightTop=380,flightBottom=500,targetY=420,shipAnchor=600;
function refreshGeometry(){
 if(state.phase!=='typing')return;
 const field=$('universe'),coach=$('code-coach'),target=$('target'),word=$('target-word');
 let world=field.getBoundingClientRect();
 const hud=$('flight-hud').getBoundingClientRect();
 coach.style.top=Math.ceil(hud.bottom-world.top+22)+'px';
 const note=coach.getBoundingClientRect(),card=word.getBoundingClientRect(),targetBox=target.getBoundingClientRect();
 let cockpit=$('cockpit').getBoundingClientRect();
 const noteBottom=note.bottom-world.top,wordOffset=card.top-targetBox.top,planeHalfHeight=115*1.15/2;
 const bottomInset=world.bottom-cockpit.bottom;
 // Make room for the actual translated note, code card and full aircraft.
 const required=Math.ceil(noteBottom+48+card.height+85+planeHalfHeight+8+cockpit.height+bottomInset);
 if(field.style.getPropertyValue('--flight-min-height')!==required+'px')field.style.setProperty('--flight-min-height',required+'px');
 world=field.getBoundingClientRect();cockpit=$('cockpit').getBoundingClientRect();
 shipAnchor=cockpit.top-world.top-85;
 flightTop=noteBottom+24;flightBottom=shipAnchor-planeHalfHeight-8-24-card.height;
 const cardTop=(flightTop+Math.max(flightTop,flightBottom))/2;
 targetY=cardTop-wordOffset+targetBox.height/2;
 target.style.top=targetY+'px';
}


// A cached 2D sky follows the rendered teaching panels in each locale.
// Aircraft, beams and collectible debris are drawn over that quiet backdrop.
const canvas=$('space'),ctx=canvas.getContext('2d'),back=document.createElement('canvas'),bg=back.getContext('2d');
const homePlane=mountHomePlane($('home-flight-field'),$('home-plane'),$('home-plane-slot'));
let W=1000,H=800,DPR=1,last=performance.now(),clock=0,beacon=0,effects=[];
let seed=41;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const stars=Array.from({length:36},()=>({x:rnd(),y:rnd(),r:.4+rnd()*.65,p:rnd()*6.28}));
function resize(){const r=$('universe').getBoundingClientRect();if(!r.width||!r.height)return;W=r.width;H=r.height;DPR=Math.min(devicePixelRatio||1,1.6);canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);back.width=canvas.width;back.height=canvas.height;ctx.setTransform(DPR,0,0,DPR,0,0);bg.setTransform(DPR,0,0,DPR,0,0);refreshGeometry();background();homePlane.refresh();}
// A quiet indigo sky; decorative bodies stay in the open flight lane.
function background(){
 const wash=bg.createLinearGradient(0,0,W,H);wash.addColorStop(0,'#0b1229');wash.addColorStop(.55,'#131d3b');wash.addColorStop(1,'#171b36');bg.fillStyle=wash;bg.fillRect(0,0,W,H);
 const world=$('universe').getBoundingClientRect(),coach=$('code-coach').getBoundingClientRect(),cockpit=$('cockpit').getBoundingClientRect();
 const top=Math.max(140,coach.bottom-world.top+18),bottom=Math.min(H-60,cockpit.top-world.top-18);
 const r=Math.min(76,W*.072,Math.max(0,bottom-top)*.25),px=W*.87,py=(top+bottom)/2;
 if(r>10){
  bg.save();bg.translate(px,py);bg.rotate(-.32);bg.strokeStyle='#6276a1';bg.lineWidth=1;bg.beginPath();bg.ellipse(0,0,r*1.48,r*.3,0,0,Math.PI*2);bg.stroke();bg.restore();
  bg.save();bg.beginPath();bg.arc(px,py,r,0,Math.PI*2);bg.clip();bg.fillStyle='#6674a1';bg.fillRect(px-r,py-r,r*2,r*2);
  bg.fillStyle='#384565';bg.beginPath();bg.ellipse(px+r*.72,py+r*.1,r*.58,r*1.14,-.2,0,Math.PI*2);bg.fill();
  bg.strokeStyle='#8292bd';bg.lineWidth=1;for(const offset of [-.3,.26]){bg.beginPath();bg.moveTo(px-r,py+r*offset);bg.bezierCurveTo(px-r*.2,py+r*(offset+.15),px+r*.4,py+r*(offset-.13),px+r,py+r*offset);bg.stroke();}bg.restore();
 }
 if(bottom>top){
  const y=top+(bottom-top)*.8;bg.strokeStyle='#425783';bg.lineWidth=1;bg.setLineDash([2,10]);bg.beginPath();bg.moveTo(W*.12,y);bg.bezierCurveTo(W*.3,y-28,W*.58,y+26,W*.78,y-14);bg.stroke();bg.setLineDash([]);
  for(let n=0;n<3;n++){bg.fillStyle='#abc3ec';bg.beginPath();bg.arc(W*(.17+n*.16),y+(n===1?-6:3),2,0,Math.PI*2);bg.fill();}
 }
}
function shipX(){return state.phase==='welcome'?(homePlane.position?.x??W*.76):W*.5;}
function shipY(){return state.phase==='welcome'?(homePlane.position?.y??H*.79):shipAnchor;}
function shoot(){effects.push({kind:'beam',x:shipX(),y:shipY()-30,tx:W*.5,ty:targetY,life:.17,max:.17});}
function burst(x,y,count){if(reduced.matches)count=Math.min(count,7);for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,speed=20+Math.random()*100;effects.push({kind:'spark',x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:.45+Math.random()*.4,max:.85});}}
function drawShip(t){
 const calm=reduced.matches,home=state.phase==='welcome';
 const x=shipX(),y=shipY()+(calm||homePlane.dragging?0:Math.sin(t*1.8)*4);
 const bank=home ? .18 : 0;
 const size=home?(W<=560?116:140):115;
 drawPlane(ctx,x,y,size,calm?0:t,bank-(home?.13:0)+(calm?0:Math.sin(t*.85)*.045));
}
function frame(now){
 const dt=Math.min((now-last)/1000,.05);last=now;clock+=dt;
 if($('universe').hidden||state.phase==='welcome'){requestAnimationFrame(frame);return;}
 ctx.clearRect(0,0,W,H);ctx.drawImage(back,0,0,back.width,back.height,0,0,W,H);
 for(const s of stars){ctx.globalAlpha=reduced.matches?.5:.35+(Math.sin(clock*.45+s.p)+1)*.12;ctx.fillStyle='#b4c9f1';ctx.beginPath();ctx.arc(s.x*W,s.y*H,s.r,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;

 drawShip(clock);
 for(const e of effects){e.life-=dt;if(e.kind==='beam'){ctx.strokeStyle='#a0bfff';ctx.lineWidth=2;ctx.globalAlpha=Math.max(0,e.life/e.max);ctx.beginPath();ctx.moveTo(e.x-6,e.y);ctx.lineTo(e.tx,e.ty+25);ctx.moveTo(e.x+6,e.y);ctx.lineTo(e.tx,e.ty+25);ctx.stroke();}else{e.x+=e.vx*dt;e.y+=e.vy*dt;ctx.globalAlpha=Math.max(0,e.life/e.max);ctx.fillStyle=e.vx>0?'#b4894b':'#a7b8f2';ctx.fillRect(e.x,e.y,2.5,2.5);}}ctx.globalAlpha=1;effects=effects.filter(e=>e.life>0);
 if(beacon>0){beacon=Math.max(0,beacon-dt*.2);ctx.strokeStyle='#a0bfff';ctx.globalAlpha=beacon*.6;ctx.lineWidth=2;ctx.beginPath();ctx.arc(W*.78,H*.3,15+(1-beacon)*80,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
 requestAnimationFrame(frame);
}
new ResizeObserver(resize).observe($('universe'));
const flightPanels=new ResizeObserver(()=>{if(state.phase==='typing'){refreshGeometry();background();}});
for(const id of ['code-coach','target-word','cockpit'])flightPanels.observe($(id));
resize();requestAnimationFrame(frame);


await changeLanguage(lang);
account.load();
