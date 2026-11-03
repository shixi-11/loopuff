import {rewriteTask,inspectRewrite} from './rewrite.js';
import {mountLessonScene} from './lesson-scene-ui.js';
import {mountJumpLab} from './jump.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountRewrite(root,{id,text:t,ui,sceneText,jumpText,reduced,getSource,onChange,onIndependent}){
 const task=rewriteTask(id),copy=t.tasks[id];let checked=null,disposed=false,serial=0;
 root.innerHTML=`<section class="lesson-page-body rewrite-page"><span class="eyebrow">${esc(ui.practice)}</span><h1 id="learning-title">${esc(t.title)}</h1><p class="dialog-note">${esc(copy.goal)}</p><p>${esc(t.intro)}</p><div class="scene-workbench"><form id="rewrite-form"><div class="rewrite-editor-heading"><label class="editor-label" for="rewrite-editor">${esc(ui.codeLabel)}</label><button class="primary" type="submit">${esc(t.run)}</button></div><textarea id="rewrite-editor" class="practice-editor" rows="10" maxlength="4096" autocomplete="off" autocapitalize="off" spellcheck="false" dir="ltr">${esc(getSource())}</textarea><div class="dialog-actions"><button class="text-button" type="button" data-rewrite="hint">${esc(t.hint)}</button></div><p data-rewrite-hint hidden tabindex="-1">${esc(copy.hint)}</p><p data-rewrite-status role="status" aria-live="polite">${esc(t.ready)}</p><p data-rewrite-save role="status"></p><button class="primary" type="button" data-rewrite="continue" disabled>${esc(t.next)}</button><p><button class="text-button" type="button" data-rewrite="direct">${esc(t.direct)}</button></p><p class="scope-note">${esc(t.scope)}</p></form><div data-rewrite-scene></div></div></section>`;
 const status=root.querySelector('[data-rewrite-status]'),next=root.querySelector('[data-rewrite="continue"]');
 const sceneRoot=root.querySelector('[data-rewrite-scene]');
 if(id==='leap')sceneRoot.innerHTML=`<section class="jump-section"><header><h2>${esc(jumpText.title)}</h2><span>${esc(jumpText.target.replace('{n}',task.goal.logs[0]))}</span></header><p>${esc(jumpText.rule)}</p><div class="jump-lab" dir="ltr"><canvas aria-hidden="true"></canvas><p role="status" aria-live="polite"></p></div></section>`;
 const scene=id==='leap'?mountJumpLab(sceneRoot.querySelector('.jump-lab'),{text:jumpText,target:Number(task.goal.logs[0]),reduced}):mountLessonScene(sceneRoot,{text:sceneText,errors:ui,expected:task.goal.logs,getSource,reduced});
 if(id!=='leap')sceneRoot.querySelector('[data-scene-action="run"]').hidden=true;
 function persist(source){
  const request=++serial;
  const show=saved=>{if(!disposed&&request===serial)root.querySelector('[data-rewrite-save]').textContent=saved===false?t.savedError:'';};
  try{Promise.resolve(onChange(source)).then(show,()=>show(false));}catch{show(false);}
 }
 function input(event){
  if(event.target.id!=='rewrite-editor')return;checked=null;next.disabled=true;scene.reset();status.textContent=t.changed;
  persist(event.target.value);
 }
 function submit(event){
  if(event.target.id!=='rewrite-form')return;event.preventDefault();
  // Read the editor directly so a submit in the same turn cannot check old text.
  const source=root.querySelector('#rewrite-editor').value;
  persist(source);const report=inspectRewrite(id,source);checked=report.ok?source:null;next.disabled=!report.ok;
  status.textContent=report.ok?t.success:['conceptMissing','syncRequired'].includes(report.code)?t.missing:report.result?t.retry:ui[report.code==='name'?'nameError':report.code]||ui.limit;
  if(id==='leap'){if(report.result)scene.play(report.result.logs);else scene.error();}else scene.run();
 }
 function click(event){
  const action=event.target.closest('[data-rewrite]')?.dataset.rewrite;
  if(action==='hint'){const hint=root.querySelector('[data-rewrite-hint]');hint.hidden=false;hint.focus();}
  if(action==='direct'||action==='continue'&&checked===getSource()&&inspectRewrite(id,checked).ok)onIndependent();
 }
 root.addEventListener('input',input);root.addEventListener('submit',submit);root.addEventListener('click',click);
 return {dispose(){disposed=true;serial++;scene.dispose();root.removeEventListener('input',input);root.removeEventListener('submit',submit);root.removeEventListener('click',click);}};
}
