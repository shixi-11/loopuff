import {experimentSettings,experimentSource,runExperiment,experimentObservation} from './causal-experiments.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const code=value=>`<bdi dir="ltr">${esc(value)}</bdi>`;
export function mountCausalExperiment(root,{kind,text:t,ownLabel,ownUrl,errors,model}){
 const settings=model.causal??={};
 const state=settings[kind]??={settings:experimentSettings(kind),report:null,changed:false,invalid:false};
 const el=selector=>root.querySelector(selector);
 root.innerHTML=`<section class="causal-experiment" aria-labelledby="causal-title"><header><h2 id="causal-title">${esc(t[kind+'Title'])}</h2><p>${esc(t[kind+'Intro'])}</p><p class="causal-separate">${esc(t.separate)}</p>${ownLabel?`<a class="text-button causal-own" href="${esc(ownUrl)}">${esc(ownLabel)} ↓</a>`:''}</header><div class="causal-settings">${['a','b'].map((name,index)=>`<div><label for="causal-${name}">${esc(kind==='function'?t[index?'second':'first']:t[index?'east':'west'])}</label><input id="causal-${name}" data-causal-number="${name}" type="number" min="0" max="99" step="1" inputmode="numeric" dir="ltr" value="${esc(state.settings[name])}">${kind==='join'?`<label class="causal-send"><input type="checkbox" data-causal-send="${index?'east':'west'}"${state.settings[index?'east':'west']?' checked':''}>${esc(t.send)}</label>`:''}</div>`).join('')}<button class="primary" type="button" data-causal-run>${esc(t.run)} ▶</button></div><p class="causal-status" data-causal-status role="status" aria-live="polite"></p><div data-causal-result></div><details class="causal-source"><summary>${esc(t.source)}</summary><pre dir="ltr" data-causal-source></pre></details></section>`;
 function paint(){
  const source=experimentSource(kind,state.settings),observation=experimentObservation(state.report);
  el('[data-causal-source]').textContent=source??'';
  el('[data-causal-status]').textContent=state.invalid?t.invalid:state.report&&!state.report.ok?errors[state.report.code==='name'?'nameError':state.report.code]||errors.limit:state.report?.truncated?errors.limit:observation?kind==='join'?t[observation.waiting?'waiting':'done']:t.returned+': '+(observation.returned?.value??'—'):state.changed?t.changed:t.ready;
  let body='';
  if(observation){
   if(kind==='function'){
    const {call,calculation,returned}=observation;
    body=`<div class="causal-flow">${[[t.arguments,call?call.name+'('+call.args.join(', ')+')':'—'],[t.calculation,calculation?`${calculation.left} ${calculation.operator} ${calculation.right} → ${calculation.value}`:'—'],[t.returned,returned?.value??'—']].map(([title,value])=>`<article><h3 dir="auto">${esc(title)}</h3><strong>${code(value)}</strong></article>`).join('')}</div><p>${esc(t.returnNote)}</p>`;
   }else{
    body=`<div class="causal-flow causal-messages">${observation.ports.map(port=>`<article><h3 dir="auto">${esc(port.names.includes('west')?t.west:t.east)} ${code(port.names.join(' / '))}</h3><small dir="auto">${esc(t.sent)}</small><strong>${port.sent.length?code(port.sent.join(' → ')):esc(t.absent)}</strong></article>`).join('')}<article><h3 dir="auto">${esc(t.received)}</h3><strong>${observation.received.length?code(observation.received.map(values=>values.join(' & ')).join(' → ')):'—'}</strong></article></div>${observation.waiting&&observation.ports.some(port=>port.queued.length)?`<p>${esc(t.waitingNote)}</p>`:''}`;
   }
   body+=`<div class="causal-output"><h3 dir="auto">${esc(t.output)}</h3><strong>${observation.outputs.length?code(observation.outputs.join(' → ')):esc(t.noOutput)}</strong></div>`;
  }
  el('[data-causal-result]').innerHTML=body;
 }
 function input(event){
  const {causalNumber,causalSend}=event.target.dataset;
  if(['a','b'].includes(causalNumber))state.settings[causalNumber]=event.target.value;
  else if(kind==='join'&&['west','east'].includes(causalSend))state.settings[causalSend]=event.target.checked;
  else return;
  state.report=null;state.invalid=false;state.changed=true;paint();
 }
 function click(event){
  if(!event.target.closest('[data-causal-run]'))return;
  state.report=runExperiment(kind,state.settings);state.invalid=!state.report;state.changed=false;paint();
 }
 root.addEventListener('input',input);root.addEventListener('click',click);paint();
 return {dispose(){root.removeEventListener('input',input);root.removeEventListener('click',click);}};
}
