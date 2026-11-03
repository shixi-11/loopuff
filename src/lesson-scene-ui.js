import {observeProgram,programFrame} from './program-scene.js';
import {aircraftUrl} from './plane.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const code=value=>`<code dir="ltr">${esc(value)}</code>`;
export function mountLessonScene(root,{text:t,errors,expected,getSource,locked=false,reduced={matches:false}}){
 let report=null,cursor=0,timer=null,disposed=false,playing=false;
 const stop=()=>{clearTimeout(timer);timer=null;playing=false;};
 const title=event=>event?t.events[event.type==='receive'&&event.channels.length>1?'join':event.type]||t.processing:t.processing;
 const detail=(event,frame)=>{
  if(!event)return '…';
  if(event.type==='calculate')return `${event.left} ${event.operator} ${event.right} → ${event.value}`;
  if(event.type==='call'||event.type==='function')return `${event.name}(${(event.args||event.params).join(', ')})`;
  if(event.type==='call-result')return `${event.name}(…) → ${event.value}`;
  if(event.type==='bind'||event.type==='assign')return event.channel?event.name:`${event.name} = ${event.value}`;
  if(event.type==='channel')return event.name;
  if(event.type==='iteration')return `${event.name} = ${event.value}`;
  if(event.type==='list')return event.value;
  if(event.type==='send')return `${event.value} → ${frame.channels.find(port=>port.id===event.channel)?.names.join(' / ')||'?'}`;
  if(event.type==='receive')return event.values.map((value,index)=>`${event.bindings[index]?event.bindings[index]+' ← ':''}${value}`).join(' & ');
  if(event.type==='wait')return event.channels.map(id=>frame.channels.find(port=>port.id===id)?.names.join(' / ')||'?').join(' & ');
  if(event.type==='received-names')return event.bindings.map((name,index)=>name+' = '+event.values[index]).join(', ');
  return event.value??'';
 };
 function paint(){
  if(disposed)return;
  const frame=programFrame(report,cursor),event=frame.event,ended=frame.finished;
  const field=root.querySelector('.program-world');field.dataset.event=event?.type||'idle';field.dataset.playing=String(playing);
  root.querySelector('[data-scene-input-title]').textContent=frame.channels.length?t.messages:t.inputs;
  root.querySelector('[data-scene-input]').innerHTML=frame.channels.length?frame.channels.map(port=>`<article class="program-port" data-waiting="${frame.waiting.some(wait=>wait.channels.includes(port.id))}"><header>${code(port.names.join(' / ')||'?')}${port.reply?`<small>${esc(t.reply)}</small>`:''}</header><div>${port.messages.length?port.messages.map(message=>`<span class="program-packet" data-message="${message.id}">${code(message.value)}</span>`).join(''):`<small>${esc(t.empty)}</small>`}</div></article>`).join(''):Object.keys(frame.names).length?Object.entries(frame.names).map(([name,value])=>`<div class="program-name">${code(name)}<span>=</span>${code(value)}</div>`).join(''):`<p class="program-empty">${esc(t.emptyInputs)}</p>`;
  root.querySelector('[data-scene-operation-title]').textContent=title(event);root.querySelector('[data-scene-operation]').textContent=detail(event,frame);
  root.querySelector('[data-scene-output]').innerHTML=frame.outputs.length?frame.outputs.map(value=>`<span>${code(value)}</span>`).join(''):`<span class="program-empty">${esc(report?t.noOutput:t.notRun)}</span>`;
  let status=locked?t.locked:!report?t.ready:ended&&report.truncated?t.truncated:ended&&!report.ok?t.error:ended&&report.result.waiting?t.waiting.replace('{number}',report.result.waiting):ended?t.finished:title(event);
  if(!ended&&frame.waiting.length)status+=' '+t.waiting.replace('{number}',frame.waiting.length);
  const errorKey=report?.code==='name'?'nameError':report?.code,error=errors[errorKey]||errors.limit;
  if(ended&&report&&!report.ok&&!report.truncated)status+=' '+error;
  root.querySelector('[data-scene-status]').textContent=status;
  root.querySelector('[data-scene-status]').dataset.error=String(ended&&report?.ok===false);
  root.querySelector('[data-scene-context]').textContent=frame.context?t.inCall.replace('{name}',frame.context.name+'('+frame.context.args.join(', ')+')'):t.main;
  const names=root.querySelector('[data-scene-names]');names.innerHTML=Object.entries(frame.names).map(([name,value])=>code(name+' = '+value)).join('');names.closest('.program-values').hidden=!Object.keys(frame.names).length;
  const source=report?.source??getSource();let from=event?.start,to=event?.end;
  if(ended&&report&&!report.ok&&!report.truncated){from=report.position;to=Math.min(source.length,from+1);}
  root.querySelector('[data-scene-source]').innerHTML=from!==undefined?esc(source.slice(0,from))+`<mark>${esc(source.slice(from,to))}</mark>`+esc(source.slice(to)):esc(source);
  root.querySelector('[data-scene-step]').textContent=t.step.replace('{number}',cursor).replace('{total}',frame.total);
  const range=root.querySelector('[data-scene-position]');range.max=String(frame.total);range.value=String(cursor);range.disabled=!report||frame.total===0;
  for(const action of ['previous','start'])root.querySelector(`[data-scene-action="${action}"]`).disabled=cursor===0;
  for(const action of ['next','end'])root.querySelector(`[data-scene-action="${action}"]`).disabled=!report||cursor===frame.total;
  const play=root.querySelector('[data-scene-action="play"]');play.disabled=!report||frame.total===0;play.textContent=playing?t.pause:t.play;play.setAttribute('aria-pressed',String(playing));
  root.querySelector('[data-scene-full]').hidden=!report?.truncated;root.querySelector('[data-scene-full-output]').textContent=report?.result.logs.join('\n')||t.noOutput;
  root.querySelector('[data-scene-final-status]').textContent=report?.truncated?report.ok?report.result.waiting?t.waiting.replace('{number}',report.result.waiting):t.finished:error:'';
  const finalSource=root.querySelector('[data-scene-final-source]');finalSource.hidden=!report?.truncated||report.ok;
  if(report?.truncated&&!report.ok)finalSource.innerHTML=esc(source.slice(0,report.position))+`<mark>${esc(source.slice(report.position,report.position+1))}</mark>`+esc(source.slice(report.position+1));
  root.querySelector('[data-scene-match]').textContent=ended&&report.ok&&!report.truncated&&!report.result.waiting?(JSON.stringify(report.result.logs)===JSON.stringify(expected)?t.matched:t.different):'';
  for(const button of root.querySelectorAll('[data-scene-event]'))button.setAttribute('aria-current',Number(button.dataset.sceneEvent)===cursor?'step':'false');
 }
 function schedule(){
  if(disposed||!playing||document.hidden){stop();paint();return;}
  timer=setTimeout(()=>{timer=null;if(disposed||!playing)return;if(cursor<report.events.length)cursor++;if(cursor>=report.events.length)stop();paint();if(playing)schedule();},650);
 }
 function render(){
  root.innerHTML=`<section class="program-scene" data-locked="${locked}"><header class="program-scene-heading"><h2>${esc(t.title)}</h2>${locked?'':`<p>${esc(t.expected)} ${code(expected.join(' → ')||t.noOutput)}</p>`}<button type="button" class="primary" data-scene-action="run"${locked?' disabled':''}>${esc(t.run)} ▶</button></header><div class="program-world" dir="ltr"><section class="program-input-zone"><h3 data-scene-input-title dir="auto"></h3><div data-scene-input></div></section><section class="program-process"><span class="program-arrow" aria-hidden="true">→</span><span class="program-operation-label" data-scene-operation-title dir="auto"></span><pre data-scene-operation dir="ltr"></pre><span class="program-context" data-scene-context dir="auto"></span></section><section class="program-launch"><img src="${aircraftUrl}" alt=""><h3 dir="auto">${esc(t.output)}</h3><div class="program-signals" data-scene-output></div></section></div>
   <div class="program-controls"><div class="program-step-controls"><button type="button" data-scene-action="start" aria-label="${esc(t.start)}">|←</button><button type="button" data-scene-action="previous" aria-label="${esc(t.previous)}">←</button><button type="button" data-scene-action="play" aria-pressed="false">${esc(t.play)}</button><button type="button" data-scene-action="next" aria-label="${esc(t.next)}">→</button><button type="button" data-scene-action="end" aria-label="${esc(t.end)}">→|</button></div></div>
   <label class="program-position"><span data-scene-step></span><input data-scene-position type="range" min="0" max="0" value="0" aria-label="${esc(t.scrub)}"></label><p class="program-status" data-scene-status role="status" aria-live="polite"></p><p class="program-match" data-scene-match></p>
   <section class="program-values" hidden><h3>${esc(t.names)}</h3><div data-scene-names dir="ltr"></div></section><details class="program-source"><summary>${esc(t.source)}</summary><pre data-scene-source dir="ltr"></pre></details><details class="program-records"><summary>${esc(t.trace)}</summary><ol data-scene-events></ol></details><details class="program-full" data-scene-full hidden><summary>${esc(t.fullOutput)} <small data-scene-final-status></small></summary><pre data-scene-full-output dir="ltr"></pre><pre data-scene-final-source dir="ltr" hidden></pre></details><p class="program-scope">${esc(t.scope)}</p></section>`;
  paint();
 }
 function runProgram({end=false,autoplay=true}={}){
  if(locked||disposed)return;stop();report=observeProgram(getSource());cursor=end||reduced.matches?report.events.length:0;
  root.querySelector('[data-scene-events]').innerHTML=report.events.map((event,index)=>`<li><button type="button" data-scene-event="${index+1}"><span>${index+1}</span><span>${esc(title(event))}</span>${code(report.source.slice(event.start,event.end).split('\n')[0])}</button></li>`).join('');
  playing=autoplay&&!end&&!reduced.matches&&!document.hidden&&cursor<report.events.length;paint();if(playing)schedule();
 }
 function click(event){
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.sceneEvent){stop();cursor=Number(button.dataset.sceneEvent);paint();return;}
  const action=button.dataset.sceneAction;if(!action)return;
  if(action==='run'){runProgram();return;}
  if(!report)return;
  if(action==='play'){if(playing)stop();else{playing=true;if(cursor===report.events.length)cursor=0;schedule();}paint();return;}
  stop();if(action==='start')cursor=0;if(action==='end')cursor=report.events.length;if(action==='previous')cursor=Math.max(0,cursor-1);if(action==='next')cursor=Math.min(report.events.length,cursor+1);paint();
 }
 function input(event){if(!event.target.matches('[data-scene-position]'))return;stop();cursor=Number(event.target.value);paint();}
 function hidden(){if(document.hidden){stop();paint();}}
 function motion(){if(reduced.matches){stop();paint();}}
 root.addEventListener('click',click);root.addEventListener('input',input);document.addEventListener('visibilitychange',hidden);reduced.addEventListener?.('change',motion);render();
 return {run:runProgram,reset(){stop();report=null;cursor=0;root.querySelector('[data-scene-events]').innerHTML='';paint();},dispose(){disposed=true;stop();root.removeEventListener('click',click);root.removeEventListener('input',input);document.removeEventListener('visibilitychange',hidden);reduced.removeEventListener?.('change',motion);}};
}
