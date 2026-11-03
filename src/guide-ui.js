import {beginnerConcept,guideFirstStep} from './beginner.js';
import {guideStations,executeGuide,comparisonPrograms,comparisonSources} from './guide.js';
import {course} from './course.js';
import {readPrediction,comparePrediction} from './guide-prediction.js';
import {aircraftUrl} from './plane.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountGuide(root,{text,rewriteText,legacy,errors,ui,model,compare=false,urls,reduced,beginner,onChange=()=>{}}){
 let timer=null,disposed=false;
 model.selected=guideStations.some(s=>s.id===model.selected)?model.selected:'signal';model.drafts??={};model.reports??={};model.predictions??={};
 const station=()=>guideStations.find(s=>s.id===model.selected),copy=()=>text.stations[guideStations.indexOf(station())];
 const source=()=>model.drafts[model.selected]??station().source;
 const currentReport=()=>{const report=model.reports[model.selected];return report?.source===source()?report:null;};
 const prediction=()=>model.predictions[model.selected]??{raw:'',silent:false};
 const stop=()=>{clearTimeout(timer);timer=null;};
 function render(){
  stop();const s=station(),c=copy(),report=currentReport(),count=report?.ok?report.result.logs.length:0;
  model.cursor=Math.max(0,Math.min(model.cursor||0,Math.max(0,count-1)));
  root.innerHTML=`<nav class="page-trail" aria-label="${esc(ui.navigation)}"><a href="${urls.home}">${esc(ui.navHome)}</a><span aria-hidden="true">/</span>${compare?`<a href="${urls.guide}">${esc(ui.navGuide)}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(text.compareTitle)}</span>`:`<span aria-current="page">${esc(ui.navGuide)}</span>`}</nav><section class="guide-studio${compare?' guide-compare':''}"><header class="guide-heading"><div><span class="eyebrow">${esc(compare?text.compareTag:text.tag)}</span><h1 id="learning-title">${esc(compare?text.compareTitle:beginner.foundation)}</h1><p>${esc(compare?text.compareIntro:beginner.intro)}</p>${!compare&&s.id==='signal'?`<button type="button" class="primary guide-begin" data-guide="begin">${esc(beginner.mapGo)}</button>`:''}</div><a class="guide-crosslink" href="${compare?urls.guide:urls.compare}">${esc(compare?text.beginner:text.experienced)} <span aria-hidden="true">↗</span></a></header>${compare?`<div class="guide-tools"><a class="guide-map-link" data-action="open-check" href="${esc(urls.check)}">${esc(urls.checkLabel)} <span aria-hidden="true">↗</span></a><a class="guide-map-link" data-action="open-map" href="${esc(urls.map)}">${esc(urls.mapLabel)} <span aria-hidden="true">↗</span></a></div>`:''}${!compare?`<details class="guide-catalog"><summary>${esc(beginner.more)}</summary>`:''}<nav class="guide-concepts" aria-label="${esc(text.map)}">${guideStations.map((item,i)=>`<button type="button" data-concept="${item.id}" aria-pressed="${s.id===item.id}"><span aria-hidden="true">${String(i+1).padStart(2,'0')}</span>${esc(compare?text.stations[i].title:beginnerConcept(beginner,item.id).term)}</button>`).join('')}</nav>${!compare?'</details>':''}<div class="guide-workbench"><section class="guide-observation" aria-labelledby="guide-world-title"><header><span class="eyebrow">${esc(text.scene)}</span><h2 id="guide-world-title">${esc(compare?c.title:beginnerConcept(beginner,s.id).term)}</h2><p>${esc(compare?c.prompt:beginnerConcept(beginner,s.id).meaning)}</p></header><div class="guide-world" dir="ltr"><div class="guide-orbit" aria-hidden="true"></div><img src="${aircraftUrl}" alt="" class="guide-aircraft"><div class="guide-beacons" aria-label="${esc(text.output)}"></div><span class="guide-world-caption">${esc(text.sceneRule)}</span></div><div class="guide-log-controls"><h3>${esc(text.output)}</h3><div><button type="button" data-guide="prev" aria-label="${esc(text.previous)}">←</button><bdi id="guide-frame" dir="ltr"></bdi><button type="button" data-guide="next" aria-label="${esc(text.next)}">→</button><button type="button" data-guide="replay">${esc(text.replay)}</button></div></div><ol class="guide-log" dir="ltr"></ol><p class="guide-state" role="status" aria-live="polite"></p></section><section class="guide-code"><form id="guide-form"><div class="guide-code-heading"><label for="guide-editor">${esc(text.editor)}</label><button type="button" class="text-button" data-guide="reset">${esc(text.reset)}</button></div>${!compare?'<p class="guide-first-step" data-guide-first-step></p>':''}<textarea id="guide-editor" dir="ltr" rows="${Math.max(5,Math.min(11,source().split('\n').length+1))}" spellcheck="false" autocapitalize="off" autocomplete="off" maxlength="4096">${esc(source())}</textarea><div class="guide-run-row"><button type="submit" class="primary">${esc(text.run)} <span aria-hidden="true">▶</span></button></div>${!compare?`<button type="button" class="text-button guide-forward" hidden data-guide-forward></button><details class="guide-orientation"${s.id==='signal'?' open':''}><summary>${esc(beginner.reading)}</summary><pre dir="ltr">${esc(s.source)}</pre><p>${esc(beginnerConcept(beginner,s.id).read)}</p></details>`:''}<details class="guide-prediction"><summary>${esc(text.prediction.label)}</summary><label for="guide-prediction">${esc(text.prediction.label)}</label><p id="guide-prediction-help">${esc(text.prediction.help)}</p><textarea id="guide-prediction" dir="ltr" rows="3" spellcheck="false" autocapitalize="off" autocomplete="off" maxlength="4096" aria-describedby="guide-prediction-help"${prediction().silent?' disabled':''}>${esc(prediction().raw)}</textarea><label class="guide-silent"><input type="checkbox" id="guide-silent"${prediction().silent?' checked':''}>${esc(text.prediction.silent)}</label><div class="guide-prediction-result" role="status" aria-live="polite"></div></details></form><p class="guide-try">${esc(c.try)}</p><details class="guide-execution"><summary>${esc(text.sourceStep)}</summary><pre dir="ltr" class="guide-source"></pre></details>${!compare&&rewriteText?`<a class="guide-practice" data-practice="rewrite" href="${urls.lesson(s.id)}?practice=rewrite">${esc(rewriteText.guide)} ↗</a>`:''}<a class="guide-practice" href="${urls.lesson(s.id)}">${esc(text.practice)} <span aria-hidden="true">↗</span></a></section></div>${compare?comparison():`<div class="guide-next"><p>${esc(c.meaning)}</p><a href="${urls.compare}">${esc(text.compareTitle)} <span aria-hidden="true">↗</span></a></div><div class="guide-tools"><a class="guide-map-link" data-action="open-check" href="${esc(urls.check)}">${esc(urls.checkLabel)} <span aria-hidden="true">↗</span></a><a class="guide-map-link" data-action="open-map" href="${esc(urls.map)}">${esc(urls.mapLabel)} <span aria-hidden="true">↗</span></a></div><details class="guide-background"><summary>${esc(text.background)}</summary>${legacy.map(card=>`<article><h2>${esc(card.title)}</h2><p>${esc(card.text)}</p><pre dir="ltr">${esc(card.code)}</pre><p>${esc(card.takeaway)}</p></article>`).join('')}<p>${esc(ui.scope)}</p></details>`}</section>`;
  if(compare){const current=root.querySelector('.page-trail [aria-current]');current.previousElementSibling.remove();current.remove();}
  for(const link of root.querySelectorAll('a[href]')){
   const href=link.getAttribute('href');
   if(href===urls.home)link.dataset.action='home';
   else if(href===urls.guide)link.dataset.action='open-guide';
   else if(href===urls.compare)link.dataset.action='open-compare';
   else if(href===urls.dispatch)link.dataset.action='open-dispatch';
   else if(href===urls.lesson(s.id)||href===urls.lesson(s.id)+'?practice=rewrite'){link.dataset.lesson=course.findIndex(item=>item.id===s.id);link.dataset.practice||='true';}
  }
  root.querySelector('.guide-state').id='guide-status';root.querySelector('#guide-editor').setAttribute('aria-describedby','guide-status');
  paint();
  const nav=root.querySelector('.guide-concepts'),box=nav.getBoundingClientRect();
  if(nav.scrollWidth>nav.clientWidth&&box.top>=0&&box.bottom<=innerHeight)nav.querySelector('[aria-pressed=true]').scrollIntoView({block:'nearest',inline:'center'});
 }
 function comparison(){
  const programs=comparisonPrograms[station().id];
  return `<section class="language-comparison" aria-labelledby="comparison-title"><header><h2 id="comparison-title">${esc(text.sameIdea)}</h2><p>${esc(copy().meaning)}</p><p class="scope-note">${esc(text.comparisonScope)}</p></header>${programs?`<p class="comparison-output">${esc(text.output)}: <bdi dir="ltr">${esc(station().logs.join(' → '))}</bdi></p><div class="language-columns"><article><h3>Tolang</h3><pre dir="ltr">${esc(station().source)}</pre><a href="${urls.lesson(station().id)}">${esc(text.practice)} ↗</a></article>${Object.entries(programs).map(([language,code])=>`<article><h3>${{python:'Python',javascript:'JavaScript',rust:'Rust'}[language]}</h3><pre dir="ltr">${esc(code)}</pre><a href="${comparisonSources[language]}" target="_blank" rel="noopener">${esc(text.reference)} ↗</a></article>`).join('')}</div>`:`<p class="guide-message-note">${esc(text.messageDifference)}</p>`}<aside class="guide-difference"><h3>${esc(text.difference)}</h3><p>${esc(copy().difference)}</p></aside><a class="guide-practice" href="${urls.dispatch}">${esc(text.transfer)} ↗</a></section>`;
 }
 function paint(){
  const report=currentReport(),ok=report?.ok,logs=ok?report.result.logs:[],cursor=model.cursor||0;
  const state=root.querySelector('.guide-state');
  if(!compare){
   root.querySelector('[data-guide-first-step]').textContent=guideFirstStep(beginner,station(),report);
   const next=guideStations[guideStations.indexOf(station())+1],forward=root.querySelector('[data-guide-forward]');
   forward.hidden=!next||!ok||!!report.result.waiting||!logs.length;
   if(next){forward.dataset.concept=next.id;forward.textContent=beginnerConcept(beginner,next.id).term+(document.documentElement?.dir==='rtl'?' ←':' →');}
   root.querySelector('.guide-try').hidden=station().id==='signal';
  }
  const errorKey=report?.code==='name'?'nameError':report?.code;
  const waiting=ok&&report.result.waiting>0;
  state.textContent=!report?text.ready:!ok?`${text.error}: ${errors[errorKey]||errors.syntax}${report.code==='syntax'?` ${report.position+1}.`:''}`:logs.length?`${text.frame} ${cursor+1} / ${logs.length} · ${logs[cursor]}${waiting?` · ${errors.waiting}`:''}`:waiting?errors.waiting:text.noOutput;
  const beacons=root.querySelector('.guide-beacons');
  beacons.innerHTML=logs.slice(Math.max(0,cursor-3),Math.max(0,cursor-3)+4).map((value,i)=>{const index=Math.max(0,cursor-3)+i;return `<div class="guide-beacon" data-active="${index===cursor}" data-past="${index<cursor}"><span>${esc(value)}</span><small>${String(index+1).padStart(2,'0')}</small></div>`;}).join('');
  root.querySelector('.guide-aircraft').classList.toggle('has-signal',logs.length>0);
  const list=root.querySelector('.guide-log'),entries=[...list.querySelectorAll('code')];
  if(entries.length!==logs.length||entries.some((node,i)=>node.textContent!==logs[i]))list.innerHTML=logs.map((value,i)=>`<li><button type="button" data-frame="${i}"><span>${String(i+1).padStart(2,'0')}</span><code>${esc(value)}</code></button></li>`).join('');
  for(const button of list.querySelectorAll('button')){if(Number(button.dataset.frame)===cursor)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');}
  root.querySelector('#guide-frame').textContent=logs.length?`${cursor+1} / ${logs.length}`:'0 / 0';
  for(const action of ['prev','next','replay'])root.querySelector(`[data-guide="${action}"]`).disabled=!logs.length||(action==='prev'&&cursor===0)||(action==='next'&&cursor===logs.length-1);
  const p=prediction(),predicted=readPrediction(p.raw,p.silent),comparison=comparePrediction(report?.prediction??null,report),feedback=root.querySelector('.guide-prediction-result');
  const changed=report&&JSON.stringify(predicted)!==JSON.stringify(report.prediction??null);
  const kind=changed?'changed':comparison?.kind;
  feedback.dataset.kind=kind||'ready';
  const message=kind==='matched'&&!comparison.count?text.prediction.silentMatched:text.prediction[kind]||text.prediction.ready;
  feedback.innerHTML=!kind?'':'<p>'+esc(message.replace('{number}',String((comparison?.index??0)+1)))+'</p>'+(kind==='different'?'<dl><div><dt>'+esc(text.prediction.expected)+'</dt><dd><bdi dir="ltr">'+esc(comparison.expected??text.prediction.absent)+'</bdi></dd></div><div><dt>'+esc(text.prediction.actual)+'</dt><dd><bdi dir="ltr">'+esc(comparison.actual??text.prediction.absent)+'</bdi></dd></div></dl>':'');
  const output=ok?report.result.outputs[cursor]:null,program=source();
  root.querySelector('.guide-source').innerHTML=output?`${esc(program.slice(0,output.start))}<mark>${esc(program.slice(output.start,output.end))}</mark>${esc(program.slice(output.end))}`:esc(program);
 }
 function play(){
  stop();model.cursor=0;paint();
  if(reduced.matches||document.hidden)return;
  function next(){const count=currentReport()?.result?.logs.length||0;if(disposed||document.hidden||model.cursor>=count-1)return;model.cursor++;paint();timer=setTimeout(next,850);}
  timer=setTimeout(next,850);
 }
 function click(event){
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.concept){model.selected=button.dataset.concept;model.cursor=0;onChange();render();root.querySelector('#guide-editor').focus();return;}
  if(button.dataset.frame!==undefined){stop();model.cursor=Number(button.dataset.frame);paint();return;}
  const action=button.dataset.guide;if(!action)return;
  if(action==='begin'){const editor=root.querySelector('#guide-editor');editor.focus({preventScroll:true});editor.scrollIntoView({block:'center',behavior:'instant'});return;}
  if(action==='reset'){delete model.drafts[model.selected];delete model.reports[model.selected];delete model.predictions[model.selected];model.cursor=0;onChange();render();root.querySelector('#guide-editor').focus();return;}
  if(action==='replay'){play();return;}
  stop();if(action==='prev')model.cursor--;if(action==='next')model.cursor++;paint();
 }
 function submit(event){if(event.target.id!=='guide-form')return;event.preventDefault();model.drafts[model.selected]=root.querySelector('#guide-editor').value;onChange();model.reports[model.selected]={...executeGuide(source()),prediction:readPrediction(prediction().raw,prediction().silent)};play();if(currentReport()?.prediction!==null)root.querySelector('.guide-prediction').open=true;if(matchMedia('(max-width:560px)').matches){const report=currentReport(),target=report.prediction!==null&&report.ok&&!report.result.waiting?'.guide-prediction-result':'.guide-observation';root.querySelector(target).scrollIntoView({block:'start',behavior:reduced.matches?'instant':'smooth'});}}
 function input(event){
  if(event.target.id==='guide-prediction'||event.target.id==='guide-silent'){
   const p=prediction();model.predictions[model.selected]={raw:event.target.id==='guide-prediction'?event.target.value:p.raw,silent:event.target.id==='guide-silent'?event.target.checked:p.silent};
   root.querySelector('#guide-prediction').disabled=prediction().silent;paint();return;
  }
  if(event.target.id!=='guide-editor')return;stop();model.drafts[model.selected]=event.target.value;delete model.reports[model.selected];model.cursor=0;onChange();paint();}
 function focus(event){if(event.target.closest('.guide-log'))stop();}
 function hidden(){if(document.hidden)stop();}
 root.addEventListener('click',click);root.addEventListener('submit',submit);root.addEventListener('input',input);root.addEventListener('focusin',focus);document.addEventListener('visibilitychange',hidden);render();
 return {dispose(){disposed=true;stop();root.removeEventListener('click',click);root.removeEventListener('submit',submit);root.removeEventListener('input',input);root.removeEventListener('focusin',focus);document.removeEventListener('visibilitychange',hidden);}};
}
