import {run} from './runner.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const parts=['value','dot','operation','call'];

// A small real program, separate from graded work and persistent student drafts.
export function teachingIntroduction(t){
 return `<section class="teaching-intro" aria-labelledby="teaching-title"><header><span class="eyebrow">Tolang</span><h2 id="teaching-title">${esc(t.title)}</h2><p>${esc(t.intro)}</p></header><div class="teaching-flow"><section><label for="teaching-value">${esc(t.valueLabel)}</label><input id="teaching-value" type="number" min="0" max="99" step="1" required value="7" dir="ltr"><p>${esc(t.valueText)}</p></section><section class="teaching-program"><h3>${esc(t.programTitle)}</h3><div class="teaching-options"><button type="button" data-teach-example="bare" aria-pressed="false">${esc(t.bareLabel)}</button><button type="button" data-teach-example="log" aria-pressed="true"><bdi dir="ltr">.log()</bdi></button></div><pre data-teach-source dir="ltr">7.log()</pre><button type="button" class="primary" data-teach-run>${esc(t.runLabel)} ▶</button></section><section class="teaching-output"><h3>${esc(t.outputLabel)}</h3><output data-teach-output dir="ltr"></output><p data-teach-status role="status" aria-live="polite">${esc(t.ready)}</p></section></div><p class="teaching-purpose">${esc(t.programText)}</p><div class="teaching-syntax"><h3>${esc(t.syntaxTitle)}</h3><div class="teaching-tokens" dir="ltr">${parts.map((id,index)=>`<button type="button" data-teach-token="${id}" aria-pressed="${index===0}" aria-controls="teaching-token-help"><code>${['7','.','log','()'][index]}</code><span>${esc(t[id+'Label'])}</span></button>`).join('')}</div><p id="teaching-token-help">${esc(t.valueText)}</p></div></section>`;
}

export function mountTeaching(root,t){
 if(!root)return {dispose(){}};
 let mode='log',token='value';
 const el=selector=>root.querySelector(selector),value=()=>el('#teaching-value').value===''?'…':String(Number(el('#teaching-value').value));
 const source=()=>value()+(mode==='log'?'.log()':'');
 function paint(){
  el('[data-teach-source]').textContent=source();
  el('[data-teach-token="value"] code').textContent=value();
  for(const button of root.querySelectorAll('[data-teach-example]'))button.setAttribute('aria-pressed',String(button.dataset.teachExample===mode));
  for(const button of root.querySelectorAll('[data-teach-token]'))button.setAttribute('aria-pressed',String(button.dataset.teachToken===token));
  el('#teaching-token-help').textContent=t[token+'Text'];
 }
 function invalidate(){el('[data-teach-output]').textContent='';el('[data-teach-status]').textContent=t.changed;paint();}
 function input(event){if(event.target.id==='teaching-value')invalidate();}
 function click(event){
  const button=event.target.closest('button');if(!button||!root.contains(button))return;
  if(button.dataset.teachToken){token=button.dataset.teachToken;paint();}
  if(button.dataset.teachExample){mode=button.dataset.teachExample;invalidate();}
  if(button.hasAttribute('data-teach-run')){
   const field=el('#teaching-value');if(!field.reportValidity())return;
   const report=run(source());el('[data-teach-output]').textContent=report.logs.join(' → ');
   el('[data-teach-status]').textContent=report.logs.length?t.ran:t.noOutput;
  }
 }
 root.addEventListener('input',input);root.addEventListener('click',click);
 return {dispose(){root.removeEventListener('input',input);root.removeEventListener('click',click);}};
}

export function teachingReading(t,id){return `<section class="teaching-reading"><h2>${esc(t.syntaxTitle)}</h2><p>${esc(t.lessons[id])}</p></section>`;}

export function teachingSymbols(t){return `<div class="teaching-symbols">${parts.map((id,index)=>`<details><summary><code dir="ltr">${['7','.','log','()'][index]}</code><span>${esc(t[id+'Label'])}</span></summary><p>${esc(t[id+'Text'])}</p></details>`).join('')}</div>`;}
