import {saveLimit,saveKeys,parseSave,emptySave,SaveError} from '../server/save-format.mjs';
import {progressStorage,readBaseline,baselineMatches,readOwner,journalKey,ownerKey} from './save-data.js';
import {createMergePlan,resolveMerge} from './save-merge.js';
import {createCloudProgress} from './cloud-progress.js';
import {course} from './course.js';
import {diagnosticIds,diagnosticPuzzle} from './diagnostic.js';

const html=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const code=source=>`<pre class="exercise-code" dir="ltr">${html(source)}</pre>`;
const tasks=['branch','manifest','fuel','relay'];
export function setSaveAccount(model,id){
 if(model.accountId===id)return false;
 model.accountId=id;model.cloud=null;if(model.preview?.mode!=='file')model.preview=null;model.allowCopy=false;model.error=null;model.message=null;return true;
}
export function markUploadPending(model){model.cloud=null;model.preview=null;model.error='SAVE_UNCONFIRMED';}
function download(value,filename){
 const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function mountSaves(root,{text:t,topics,lessons,phases,account,urls,locale,name,pursuitText,diagnosticText,model={}}){
 let disposed=false,busy=false,local=null,localError=null,recovery=null,focusComparison=false;
 setSaveAccount(model,account.user?.id??null);
 const access=progressStorage(),cloud=createCloudProgress({url:location.href,getAccount:()=>account.user});
 const fail=code=>{throw new SaveError(code);};
 const message=()=>model.error?(t.errors[model.error]||t.errors.SAVE_UNAVAILABLE):t[model.message]||'';
 const filename=kind=>{const now=new Date(),date=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');const purpose=locale==='zh'?(kind==='progress'?'进度':'恢复记录'):locale==='zh-Hant'?(kind==='progress'?'進度':'還原紀錄'):kind;return `${date}_${name}${locale.startsWith('zh')?'':'_'}${purpose}.json`;};
 const domainName=domain=>topics[domain];
 function summary(snapshot){
  if(!snapshot)return `<p>${html(t.noProgress)}</p>`;
  const d=snapshot.data;
  return `<dl class="save-totals">${[
   ['course',`${d.course?.state?.completed?.length??0} / ${course.length}`],
   ['vault',`${d.vault?.stamps.length??0} / 3`],
   ['chase',`${(d.chase?.work.police.cleared.length??0)+(d.chase?.work.thief.cleared.length??0)} / 6`],
   ['dispatch',`${d.dispatch?.stamps.length??0} / 4`],
   ['pursuit',d.pursuit?`${topics[d.pursuit.current.role]} · ${Math.floor(d.pursuit.current.activeMs/60000)}:${String(Math.floor(d.pursuit.current.activeMs/1000)%60).padStart(2,'0')}`:'']
  ].map(([domain,count])=>`<div><dt>${html(domainName(domain))}</dt><dd>${d[domain]===null?html(t.noProgress):`<bdi dir="ltr">${count}</bdi>${domain==='course'&&d.course?.state?.diagnostic?`<small>${html(t.diagnosticDrafts)}: <bdi dir="ltr">${diagnosticIds.filter(id=>d.course.state.diagnostic.drafts[id].trim()).length} / ${diagnosticIds.length}</bdi></small>`:''}`}</dd></div>`).join('')}</dl>`;
 }
 function diagnosticTask(value){return code(value.draft||t.emptyDraft)+`<p>${html(t.diagnosticHints)}: <bdi dir="ltr">${value.hint} / 2</bdi></p><p>${html(value.submitted===null?t.diagnosticPending:t.diagnosticSubmitted)}</p>`;}
 function previewValue(item,value){
  if(item.kind==='diagnostic-task')return diagnosticTask(value);
  if(item.kind==='diagnostic-run')return diagnosticIds.map(id=>{
   const samples=diagnosticPuzzle(value.seed,id).cases,inputs=[samples[0],samples.at(-1)].map(sample=>sample.inputCode||sample.prefix.trim()).join('\n…\n');
   return `<h4>${html(diagnosticText.tasks[id].title)}</h4><p>${html(diagnosticText.input)}</p>${code(inputs)}${diagnosticTask({draft:value.drafts[id],submitted:value.submitted[id],hint:value.hints[id]})}`;
  }).join('');
  if(item.domain==='pursuit'){
   const s=value.current;return `<p>${html(t.currentRun)}: ${html(topics[s.role])} · <bdi dir="ltr">${Math.floor(s.activeMs/60000)}:${String(Math.floor(s.activeMs/1000)%60).padStart(2,'0')}</bdi></p><p>${html(pursuitText.round)}: <bdi dir="ltr">${s.actors[s.role].section+1}</bdi> · ${html(pursuitText.history)}: <bdi dir="ltr">${value.history.length}</bdi></p>${code(s.draft||t.emptyDraft)}`;
  }
  if(item.kind==='lesson'){
   const w=value.work;
   return `<p>${html(t.phase)}: ${html(phases[w.phase]||t.phase)}</p>${code(w.draft||t.emptyDraft)}${w.typed?`<p>${html(t.step.replace('{number}',(w.fragment??0)+1))}</p>${code(w.typed)}`:''}${value.score!==null?`<p>${html(t.score)}: <bdi dir="ltr">${value.score} / 100</bdi></p>`:''}`;
  }
  if(item.kind==='run'){
   const drafts=Array.isArray(value.drafts)?value.drafts:Object.values(value.drafts);
   return `<p>${html(t.cleared)}: <bdi dir="ltr">${value.cleared.length} / ${item.domain==='vault'?3:4}</bdi></p>${drafts.map((draft,i)=>`<h4>${html(t.stage.replace('{number}',i+1))}</h4>${code(draft||t.emptyDraft)}`).join('')}`;
  }
  return code((typeof value==='string'?value:value.draft)||t.emptyDraft);
 }
 function conflictTitle(item){
  if(item.kind==='diagnostic-run')return t.diagnosticTitle;
  if(item.kind==='diagnostic-task')return t.diagnosticTitle+' · '+diagnosticText.tasks[item.item].title;
  if(item.domain==='course')return (item.kind==='guide'?topics.guide+' · ':'')+lessons[course.findIndex(l=>l.id===item.item)].title;
  if(item.kind==='run')return domainName(item.domain)+' · '+t.currentRun;
  if(item.domain==='chase'){const [role,index]=item.item.split(':');return domainName(item.domain)+' · '+topics[role]+' · '+t.stage.replace('{number}',Number(index)+1);}
  if(item.domain==='dispatch')return domainName(item.domain)+' · '+topics.dispatchTasks[tasks.indexOf(item.item)];
  return domainName(item.domain)+' · '+t.stage.replace('{number}',Number(item.item)+1);
 }
 function comparison(){
  const p=model.preview;if(!p)return '';
  const incoming=p.mode==='file'?t.fileVersion:t.cloudVersion;
  return `<section class="save-comparison" aria-labelledby="save-compare-title"><header><h2 id="save-compare-title" tabindex="-1">${html(t.comparison)}</h2><p>${html(p.mode==='upload'?t.uploadNote:t.restoreNote)}</p>${p.mode!=='file'?`<p class="save-account-email" dir="ltr">${html(p.base.account.email)}</p>`:''}</header>
   <div class="save-comparison-overview"><section><h3>${html(t.localVersion)}</h3>${summary(p.plan.local)}</section><section><h3>${html(incoming)}</h3>${summary(p.plan.incoming)}</section></div>
   ${p.plan.conflicts.length?`<p>${html(t.chooseAll)}</p>`:`<p>${html(t.noConflicts)}</p>`}
   ${p.plan.conflicts.map((item,i)=>`<fieldset class="save-conflict"><legend>${html(conflictTitle(item))}</legend>${item.kind.startsWith('diagnostic-')?`<p>${html(t.diagnosticChoice)}</p>`:''}${item.domain==='pursuit'?`<p>${html(pursuitText.saveChoice)}</p>`:''}<div class="save-versions">${['local','incoming'].map(side=>`<label class="save-version" data-selected="${model.choices?.[item.id]===side}"><span class="save-choice"><input type="radio" name="save-choice-${i}" data-save-choice="${html(item.id)}" value="${side}"${model.choices?.[item.id]===side?' checked':''}><strong>${html(side==='local'?t.keepLocal:t.keepIncoming)}</strong></span><span class="save-version-body">${previewValue(item,item[side])}</span></label>`).join('')}</div></fieldset>`).join('')}
   ${p.mode==='upload'&&p.owner!==p.base.account.id?`<label class="save-adopt"><input type="checkbox" data-save-copy${model.allowCopy?' checked':''}> <span>${html(p.owner?t.copyOther:t.copyGuest)}</span></label>`:''}
   <div class="dialog-actions"><button class="primary" type="button" data-save-action="confirm"${!ready()?' disabled':''}>${html(p.mode==='upload'?t.upload:t.apply)}</button><button class="text-button" type="button" data-save-action="cancel">${html(t.cancel)}</button></div></section>`;
 }
 function ready(){const p=model.preview;return p&&p.plan.conflicts.every(item=>['local','incoming'].includes(model.choices?.[item.id]))&&(p.mode!=='upload'||p.owner===p.base.account.id||model.allowCopy);}
 function render(){
  if(disposed)return;
  const previousFocus=root.querySelector(':focus')?.dataset.saveAction;
  root.innerHTML=`<section class="saves-page"><header class="saves-heading"><span class="eyebrow">${html(name)}</span><h1 id="learning-title">${html(t.title)}</h1><p>${html(t.intro)}</p></header>
   ${recovery?`<section class="save-recovery"><h2>${html(t.recovery)}</h2><p>${html(t.recoveryNote)}</p><button type="button" class="text-button" data-save-action="recovery-download">${html(t.downloadRecovery)}</button><label class="save-adopt"><input type="checkbox" data-save-recovery-confirm${model.recoveryConfirmed?' checked':''}><span>${html(t.recoveryConfirm)}</span></label><button type="button" class="primary" data-save-action="keep-current"${!model.recoveryConfirmed?' disabled':''}>${html(t.keepCurrent)}</button></section>`:''}
   <div class="save-options"><section class="save-card"><h2>${html(t.local)}</h2>${local?summary(local.snapshot):`<p>${html(t.errors[localError]||t.busy)}</p>`}<button type="button" class="primary" data-save-action="download"${!local?' disabled':''}>${html(t.download)}</button>${localError&&!recovery?`<p>${html(t.rawRecoveryNote)}</p><button type="button" class="text-button" data-save-action="recovery-download">${html(t.downloadRecovery)}</button>`:''}<div class="save-import"><label for="save-import-file">${html(t.selectFile)}</label><input id="save-import-file" type="file" accept="application/json,.json" aria-describedby="save-file-hint"${recovery?' disabled':''}><p id="save-file-hint">${html(t.fileHint)}</p></div></section>
   <section class="save-card"><h2>${html(t.cloud)}</h2><p>${html(t.manual)}</p>${account.user?`<p class="save-account-email" dir="ltr">${html(account.user.email)}</p><button type="button" class="text-button" data-save-action="read">${html(t.readCloud)}</button>${model.cloud?`${model.cloud.snapshot?`<p>${html(t.updated.replace('{date}',new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(model.cloud.updatedAt))))}</p>${summary(model.cloud.snapshot)}`:`<p>${html(t.noCloud)}</p>`}<div class="dialog-actions"><button type="button" class="primary" data-save-action="preview-upload"${!local||recovery?' disabled':''}>${html(t.saveCloud)}</button>${model.cloud.snapshot?`<button type="button" class="text-button" data-save-action="preview-cloud"${!local||recovery?' disabled':''}>${html(t.restoreCloud)}</button>`:''}</div>`:`<p>${html(t.notRead)}</p>`}`:`<a data-action="open-account" href="${html(urls.account)}">${html(t.signIn)} <span aria-hidden="true">↗</span></a>`}</section></div>
   <p class="save-status" data-error="${!!model.error}" role="status" aria-live="polite">${html(busy?t.busy:message())}</p>${comparison()}</section>`;
  if(busy)for(const control of root.querySelectorAll('button,input'))control.disabled=true;
  if(previousFocus)root.querySelector(`[data-save-action="${previousFocus}"]`)?.focus({preventScroll:true});
 }
 async function refreshLocal(){
  try{local=await access.capture();localError=null;}catch(error){local=null;localError=error.code||'SAVE_STORAGE';}
  const raw=localStorage.getItem(journalKey),baseline=readBaseline(localStorage);
  if(raw!==recovery?.raw||JSON.stringify(baseline)!==JSON.stringify(recovery?.baseline))model.recoveryConfirmed=false;
  recovery=raw===null?null:{raw,baseline};
 }
 async function perform(operation){
  if(busy||disposed)return;const anchor=root.querySelector(':focus')?.dataset.saveAction;busy=true;model.error=null;model.message=null;render();
  try{await operation();}
  catch(error){
   if(!disposed){model.error=error.code||'SAVE_STORAGE';
    if(['SAVE_UNCONFIRMED','SAVE_CONFLICT','ACCOUNT_CHANGED','AUTH_REQUIRED'].includes(error.code)){model.cloud=null;if(model.preview?.mode!=='file')model.preview=null;}
    if(error.code==='SAVE_LOCAL_CHANGED')model.preview=null;
   }
  }finally{busy=false;if(!disposed){render();if(focusComparison&&model.preview){root.querySelector('#save-compare-title')?.focus();focusComparison=false;}else if(model.error){const status=root.querySelector('.save-status');status?.setAttribute('tabindex','-1');status?.focus();}else if(anchor)root.querySelector(`[data-save-action="${anchor}"]`)?.focus({preventScroll:true});}}
 }
 async function begin(mode,snapshot,base){
  const captured=await access.capture();if(disposed)return;
  model.preview={mode,plan:createMergePlan(captured.snapshot,snapshot),baseline:captured.baseline,base,owner:mode==='upload'?readOwner(localStorage):null};model.choices={};model.allowCopy=false;
  focusComparison=true;
 }
 async function confirm(){
  const p=model.preview;if(!ready())fail('SAVE_CHOICES_REQUIRED');
  if(!baselineMatches(localStorage,p.baseline))fail('SAVE_LOCAL_CHANGED');
  const snapshot=resolveMerge(p.plan,model.choices);
  if(p.mode==='upload'){
   if(account.user?.id!==p.base.account.id)fail('ACCOUNT_CHANGED');
   // This marker survives navigation and locale remounts. An interrupted POST
   // must require another read, never revive a ready-to-upload old preview.
   markUploadPending(model);
   const saved=await cloud.write(snapshot,p.base);if(disposed)return;
   model.cloud={...saved,snapshot};model.error=null;
   let linked=false;try{await access.bind(saved.account.id,p.baseline,{isCurrent:()=>!disposed&&account.user?.id===saved.account.id});linked=true;}catch{}
   if(disposed||account.user?.id!==saved.account.id)return;
   model.message=linked?'saved':'savedLocalChanged';
   await refreshLocal();
  }else{
   if(p.mode==='cloud'){
    const latest=await cloud.read();if(disposed)return;
    if(latest.account.id!==p.base.account.id)fail('ACCOUNT_CHANGED');
    if(latest.revision!==p.base.revision)fail('SAVE_CONFLICT');
   }
   if(disposed)return;
   await access.apply(snapshot,p.baseline,{accountId:p.mode==='cloud'?p.base.account.id:null,isCurrent:()=>{if(disposed)return false;if(p.mode==='cloud'&&account.user?.id!==p.base.account.id)fail('ACCOUNT_CHANGED');return true;}});if(!disposed)location.reload();
  }
 }
 const click=event=>{
  const action=event.target.closest('[data-save-action]')?.dataset.saveAction;if(!action)return;
  if(action==='cancel'){model.preview=null;render();return;}
  perform(async()=>{
   if(action==='download'){const captured=await access.capture();download(captured.snapshot,filename('progress'));}
   if(action==='read'){const result=await cloud.read();if(disposed)return;model.cloud=result;model.preview=null;await refreshLocal();}
   if(action==='preview-upload')await begin('upload',model.cloud.snapshot||emptySave(),model.cloud);
   if(action==='preview-cloud')await begin('cloud',model.cloud.snapshot,model.cloud);
   if(action==='confirm')await confirm();
   if(action==='recovery-download')download({format:'loopuff-recovery',version:1,journal:localStorage.getItem(journalKey),current:readBaseline(localStorage)},filename('recovery'));
   if(action==='keep-current'){if(!model.recoveryConfirmed)fail('SAVE_CHOICES_REQUIRED');await access.keep(recovery.baseline,recovery.raw,{isCurrent:()=>!disposed});if(!disposed)location.reload();}
  });
 };
 const change=event=>{
  if(event.target.id==='save-import-file'){
   const file=event.target.files?.[0];if(!file)return;
   perform(async()=>{if(file.size>saveLimit)fail('SAVE_TOO_LARGE');const snapshot=parseSave(await file.text());if(!disposed)await begin('file',snapshot);});
  }
  const id=event.target.dataset.saveChoice;if(id){model.choices[id]=event.target.value;render();root.querySelector(`[data-save-choice="${id}"][value="${event.target.value}"]`)?.focus({preventScroll:true});}
  if(event.target.matches('[data-save-copy]')){model.allowCopy=event.target.checked;render();root.querySelector('[data-save-copy]')?.focus({preventScroll:true});}
  if(event.target.matches('[data-save-recovery-confirm]')){model.recoveryConfirmed=event.target.checked;render();root.querySelector('[data-save-recovery-confirm]')?.focus({preventScroll:true});}
 };
 const storageChanged=event=>{if(event.storageArea!==localStorage||event.key!==null&&![...Object.values(saveKeys),ownerKey,journalKey].includes(event.key))return;model.preview=null;model.recoveryConfirmed=false;perform(async()=>{await refreshLocal();model.message='changed';});};
 root.addEventListener('click',click);root.addEventListener('change',change);window.addEventListener('storage',storageChanged);
 perform(refreshLocal);
 return {refresh(){if(setSaveAccount(model,account.user?.id??null))cloud.reset();render();},async localSaved(){if(busy)return;await refreshLocal();render();},dispose(){disposed=true;cloud.reset();root.removeEventListener('click',click);root.removeEventListener('change',change);window.removeEventListener('storage',storageChanged);}};
}
