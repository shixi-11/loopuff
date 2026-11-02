import {course} from './course.js';
import {executeGuide} from './guide.js';
import {learningLanes,learningPrerequisites,learningContext,learningSyntax} from './learning-map.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountLearningMap(root,{text:t,lessons,ui,errors,completed,model,urls}){
 let disposed=false,frame=0,report=null;
 const title=id=>lessons[course.findIndex(item=>item.id===id)].title;
 const initial=location.hash.slice(1);
 let selected=Object.hasOwn(learningPrerequisites,initial)?initial:Object.hasOwn(learningPrerequisites,model.mapSelected)?model.mapSelected:'signal';
 model.mapSelected=selected;
 const context=()=>learningContext(selected,completed);
 function select(id,{focus=false}={}){
  selected=id;model.mapSelected=id;report=null;const url=new URL(location.href);url.hash=id;history.replaceState(null,'',url);paint();
  if(focus){const node=root.querySelector(`[data-map-node="${id}"]`);node.focus({preventScroll:true});node.scrollIntoView({block:'center',inline:'center'});}
 }
 function render(){
  root.innerHTML=`<nav class="page-trail" aria-label="${esc(ui.navigation)}"><a data-action="home" href="${esc(urls.home)}">${esc(ui.navHome)}</a><span aria-hidden="true">/</span><a data-action="open-guide" href="${esc(urls.guide)}">${esc(ui.navGuide)}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(t.title)}</span></nav><section class="learning-map"><header class="guide-heading"><div><span class="eyebrow">${esc(t.tag)}</span><h1 id="learning-title">${esc(t.title)}</h1><p>${esc(t.intro)}</p></div><a class="guide-crosslink" data-action="open-compare" href="${esc(urls.compare)}">${esc(t.compare)} ↗</a></header><p class="map-legend"><span><i class="map-dot is-complete" aria-hidden="true"></i>${esc(t.completed)}</span><span><i class="map-dot" aria-hidden="true"></i>${esc(t.available)}</span><span>${esc(t.arrows)}</span></p><p class="map-hint" id="map-scroll-hint">${esc(t.scroll)}</p><div class="map-scroll" tabindex="0" role="region" aria-label="${esc(t.title)}" aria-describedby="map-scroll-hint"><div class="map-board"><svg class="map-edges" aria-hidden="true"></svg>${learningLanes.map((ids,i)=>`<section class="map-lane"><h2>${esc(t.lanes[i])}</h2>${ids.map(id=>`<button type="button" class="map-node" data-map-node="${id}"><span class="map-node-number" dir="ltr">${String(course.findIndex(item=>item.id===id)+1).padStart(2,'0')}</span><strong>${esc(title(id))}</strong><code class="map-node-syntax" dir="ltr">${esc(learningSyntax[id])}</code><span class="map-node-state"></span></button>`).join('')}</section>`).join('')}</div></div><section class="map-detail" aria-labelledby="map-detail-title"><div class="map-detail-copy"><span class="eyebrow">${esc(t.selected)}</span><h2 id="map-detail-title"></h2><p data-map-goal></p><div><h3>${esc(t.before)}</h3><div class="map-relations" data-map-before></div></div><div><h3>${esc(t.after)}</h3><div class="map-relations" data-map-after></div></div><div class="map-actions"><a class="primary" data-map-practice></a><a class="text-button" data-map-start></a></div><p class="map-scope">${esc(t.progressNote)}</p></div><div class="map-example"><h3>${esc(t.example)}</h3><pre dir="ltr" data-map-source></pre><button class="text-button" type="button" data-map-run>${esc(t.run)}</button><div class="map-output" role="status" aria-live="polite" data-map-output></div></div></section></section>`;
  paint();
 }
 function paint(){
  if(disposed)return;const c=context(),lesson=course.find(item=>item.id===selected),details=lessons[course.indexOf(lesson)];
  for(const node of root.querySelectorAll('[data-map-node]')){
   const id=node.dataset.mapNode;node.setAttribute('aria-pressed',String(id===selected));node.dataset.before=String(c.ancestors.includes(id));node.dataset.completed=String(completed.includes(id));
   node.querySelector('.map-node-state').textContent=completed.includes(id)?t.completed:t.available;
  }
  root.querySelector('#map-detail-title').textContent=title(selected);root.querySelector('[data-map-goal]').textContent=details.goal;
  const relations=(ids,empty)=>ids.length?ids.map(id=>`<button type="button" data-map-relation="${id}">${esc(title(id))} <span aria-hidden="true">↗</span></button>`).join(''):`<p>${esc(empty)}</p>`;
  root.querySelector('[data-map-before]').innerHTML=relations(c.prerequisites,t.first);root.querySelector('[data-map-after]').innerHTML=relations(c.next,t.transfer);
  const practice=root.querySelector('[data-map-practice]');practice.href=urls.lesson(selected);practice.dataset.lesson=course.indexOf(lesson);practice.textContent=t.practice+' ↗';
  const start=root.querySelector('[data-map-start]');start.href=urls.lesson(c.suggested);start.dataset.lesson=course.findIndex(item=>item.id===c.suggested);start.textContent=c.suggested===selected?t.tryDirect:t.start.replace('{concept}',title(c.suggested));
  start.hidden=c.suggested===selected;
  let direct=root.querySelector('[data-map-direct]');if(!direct){direct=document.createElement('a');direct.className='text-button';direct.dataset.mapDirect='';root.querySelector('.map-actions').append(direct);}direct.href=urls.lesson(selected)+'?practice=independent';direct.dataset.lesson=course.indexOf(lesson);direct.dataset.practice='true';direct.textContent=t.tryDirect;
  root.querySelector('[data-map-source]').textContent=lesson.source;
  const output=root.querySelector('[data-map-output]');output.textContent=!report?t.ready:!report.ok?`${t.error}: ${errors[report.code==='name'?'nameError':report.code]||errors.syntax}`:report.result.waiting?errors.waiting:report.result.logs.length?report.result.logs.join(' → '):t.noOutput;output.dir=report?.ok?'ltr':'auto';
  cancelAnimationFrame(frame);frame=requestAnimationFrame(drawEdges);
 }
 function drawEdges(){
  if(disposed)return;const board=root.querySelector('.map-board'),svg=root.querySelector('.map-edges'),rect=board.getBoundingClientRect(),c=context(),rtl=getComputedStyle(board).direction==='rtl';
  svg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
  const corridor=Math.min(...[...root.querySelectorAll('.map-node')].map(node=>node.getBoundingClientRect().top))-rect.top-8;let longEdge=0;
  svg.innerHTML=Object.entries(learningPrerequisites).flatMap(([id,parents])=>parents.map(parent=>{
   const a=root.querySelector(`[data-map-node="${parent}"]`).getBoundingClientRect(),b=root.querySelector(`[data-map-node="${id}"]`).getBoundingClientRect();
   const same=Math.abs(a.left-b.left)<2,lane=learningLanes.find(ids=>ids.includes(id)),skip=same&&lane.indexOf(id)-lane.indexOf(parent)>1,across=Math.abs(learningLanes.findIndex(ids=>ids.includes(id))-learningLanes.findIndex(ids=>ids.includes(parent)))>1;
   const x1=(same&&!skip?a.left+a.width/2:rtl?a.left:a.right)-rect.left,y1=(same&&!skip?a.bottom:a.top+a.height/2)-rect.top;
   const x2=(same&&!skip?b.left+b.width/2:skip?(rtl?b.left:b.right):rtl?b.right:b.left)-rect.left,y2=(same&&!skip?b.top:b.top+b.height/2)-rect.top;
   const side=x1+(rtl?-17:17);
   const track=corridor-4*longEdge,leave=x1+(rtl?-10:10),arrive=x2+(rtl?10:-10);if(across)longEdge++;
   const path=across?`M${x1},${y1} H${leave} V${track} H${arrive} V${y2} H${x2}`:skip?`M${x1},${y1} C${side},${y1} ${side},${y2} ${x2},${y2}`:same?`M${x1},${y1} L${x2},${y2}`:`M${x1},${y1} C${(x1+x2)/2},${y1} ${(x1+x2)/2},${y2} ${x2},${y2}`;
   const active=id===selected||c.ancestors.includes(id)&&c.ancestors.includes(parent);return `<path d="${path}" data-from="${parent}" data-to="${id}" data-active="${active}"/><circle cx="${x2}" cy="${y2}" r="3" data-active="${active}"/>`;
  })).join('');
 }
 function click(event){
  const node=event.target.closest('[data-map-node],[data-map-relation]');if(node){select(node.dataset.mapNode||node.dataset.mapRelation,{focus:true});return;}
  if(event.target.closest('[data-map-run]')){report=executeGuide(course.find(item=>item.id===selected).source);paint();}
 }
 function hash(){const id=location.hash.slice(1);if(Object.hasOwn(learningPrerequisites,id))select(id);}
 root.addEventListener('click',click);window.addEventListener('hashchange',hash);render();const resize=new ResizeObserver(drawEdges);resize.observe(root.querySelector('.map-board'));
 return {dispose(){disposed=true;cancelAnimationFrame(frame);resize.disconnect();root.removeEventListener('click',click);window.removeEventListener('hashchange',hash);}};
}
