import {normalizeSave,SaveError} from '../server/save-format.mjs';
import {course} from './course.js';
import {lessonWork,rememberLesson} from './progress.js';
import {guideStations} from './guide.js';

const lessonIds=course.map(item=>item.id),tasks=['branch','manifest','fuel','relay'];
const workFields=['fragment','typed','draft','assessedSource','score','errors','keys'];
const workPhases=['brief','typing','predict','output','explain','remix','independent','result','complete'];
const clone=value=>structuredClone(value);
const union=(a=[],b=[])=>[...new Set([...a,...b])];
const stable=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const same=(a,b)=>stable(a)===stable(b);

export function supportedSave(value){
 const snapshot=normalizeSave(value),state=snapshot.data.course?.state;
 if(state){
  const ids=[...(state.completed||[]),...Object.keys(state.lessonWork||{}),...Object.keys(state.grades||{})];
  if(ids.some(id=>!lessonIds.includes(id))||state.lesson!==undefined&&state.lesson>=lessonIds.length)throw new SaveError('SAVE_NEW_LESSONS');
  const guideIds=guideStations.map(s=>s.id);
  if([...Object.keys(state.guideWork||{}),...(state.guideSelected?[state.guideSelected]:[])].some(id=>!guideIds.includes(id)))throw new SaveError('SAVE_NEW_LESSONS');
  const checkFragment=(work,index)=>{
   const phase=work.phase==='pause'?work.previousPhase:work.phase;
   if(phase==='typing'&&course[index].mode==='lab')throw new SaveError('SAVE_INVALID');
   const fragments=course[index].fragments;
   if(!fragments){if(phase==='typing')throw new SaveError('SAVE_INVALID');return;}
   const length=fragments.length;
   if(work.fragment!==undefined&&(work.fragment>length||phase==='typing'&&work.fragment===length))throw new SaveError('SAVE_INVALID');
  };
  checkFragment(state,state.lesson??0);
  const currentId=lessonIds[state.lesson??0],effective=state.phase==='pause'?state.previousPhase:state.phase;
  if(!workPhases.includes(effective)&&!state.lessonWork?.[currentId]&&workPhases.includes(state.resumePhase))checkFragment({...state,phase:state.resumePhase},state.lesson??0);
  for(const [id,work] of Object.entries(state.lessonWork||{}))checkFragment(work,lessonIds.indexOf(id));
 }
 return snapshot;
}
// Migrate the old current-lesson mirror before comparing two devices. A menu's
// stale mirror must never overwrite an already saved per-lesson work snapshot.
function courseWork(value){
 if(!value?.state)return value;
 const saved=clone(value),s=saved.state,id=lessonIds[s.lesson??0];
 const phase=s.phase==='pause'?s.previousPhase:s.phase;
 if(workPhases.includes(phase))rememberLesson(s,id,phase);
 else if(!lessonWork(s,id)&&workPhases.includes(s.resumePhase))rememberLesson(s,id,s.resumePhase);
 if(s.lessonWork)s.lessonWork=Object.fromEntries(Object.keys(s.lessonWork).map(id=>[id,lessonWork(s,id)]));
 return saved;
}
function merge(local,incoming,choose){
 const data={};
 const pick=(domain,item,kind,a,b)=>same(a,b)?clone(a):choose({id:[domain,item,kind].filter(Boolean).join(':'),domain,item,kind,local:clone(a),incoming:clone(b)});
 function mergeCourse(a,b){
  a=courseWork(a);b=courseWork(b);
  const base=clone(a),left=a.state||{},right=b.state||{},s=base.state||{};base.state=s;
  const map={},grades={};
  for(const id of lessonIds){
   const x=left.lessonWork?.[id],y=right.lessonWork?.[id],lg=left.grades?.[id],rg=right.grades?.[id];
   let selected=x?'local':'incoming';
   if(x&&y){
    const decision=same(x,y)&&(lg?.score??null)===(rg?.score??null)?{work:clone(x),side:'local'}:pick('course',id,'lesson',{work:x,score:lg?.score??null,side:'local'},{work:y,score:rg?.score??null,side:'incoming'});
    selected=decision.side;map[id]=decision.work;
   }else if(x||y)map[id]=clone(x||y);
   if(lg||rg){
    const chosen=selected==='local'?lg:rg,other=selected==='local'?rg:lg;
    grades[id]={score:chosen?.score??(map[id]?0:other?.score??0),best:Math.max(lg?.best??0,rg?.best??0),attempts:Math.max(lg?.attempts??0,rg?.attempts??0)};
   }
  }
  s.lessonWork=map;s.grades=grades;s.completed=union(left.completed,right.completed);
  if(left.guideWork||right.guideWork){
   s.guideWork={};
   for(const {id} of guideStations){
    const x=left.guideWork?.[id],y=right.guideWork?.[id];
    if(x!==undefined&&y!==undefined)s.guideWork[id]=pick('course',id,'guide',x,y);
    else if(x!==undefined||y!==undefined)s.guideWork[id]=x??y;
   }
  }
  if(left.guideSelected||right.guideSelected)s.guideSelected=left.guideSelected||right.guideSelected;
  s.lesson=left.lesson??right.lesson??0;
  const current=map[lessonIds[s.lesson]];
  if(current){
   for(const key of workFields)s[key]=current[key];
   if(workPhases.includes(s.phase))s.phase=current.phase;
   else if(s.phase==='pause')s.previousPhase=current.phase;
   s.resumePhase=current.phase;
  }
  return base;
 }
 function mergeVault(a,b){
  if(a.seed!==b.seed){const selected=pick('vault',null,'run',a,b);selected.stamps=union(a.stamps,b.stamps);return selected;}
  const value=clone(a);value.stamps=union(a.stamps,b.stamps);value.cleared=union(a.cleared,b.cleared);value.edited=[];
  for(let i=0;i<3;i++){
   const selected=pick('vault',String(i),'draft',{draft:a.drafts[i],edited:a.edited.includes(i)},{draft:b.drafts[i],edited:b.edited.includes(i)});
   value.drafts[i]=selected.draft;if(selected.edited)value.edited.push(i);
  }
  value.submitted=[a,b].find(item=>item.stage===value.stage&&item.submitted!==null&&item.submitted===value.drafts[value.stage])?.submitted??null;
  return value;
 }
 function mergeChase(a,b){
  const value=clone(a);
  for(const role of ['police','thief']){
   const x=a.work[role],y=b.work[role],w=value.work[role];w.cleared=union(x.cleared,y.cleared);
   for(let i=0;i<3;i++)w.drafts[i]=pick('chase',`${role}:${i}`,'draft',x.drafts[i],y.drafts[i]);
   w.submitted=[x,y].find(item=>item.stage===w.stage&&item.submitted!==null&&item.submitted===w.drafts[w.stage])?.submitted??null;
  }
  return value;
 }
 function mergeDispatch(a,b){
  const chosen=a.seed===b.seed?a:pick('dispatch',null,'run',a,b),value=clone(chosen);
  value.stamps=union(a.stamps,b.stamps);value.rounds=Math.max(a.rounds,b.rounds);
  if(a.seed===b.seed){value.cleared=union(a.cleared,b.cleared);if(value.cleared.length===4&&!a.awarded&&!b.awarded)value.rounds=Math.min(999999,value.rounds+1);}
  value.awarded=value.cleared.length===4;
  for(const id of tasks){
   value.drafts[id]=pick('dispatch',id,'draft',a.drafts[id],b.drafts[id]);
   value.submitted[id]=[chosen,...(a.seed===b.seed?[b]:[])].find(item=>item.submitted[id]!==null&&item.submitted[id]===value.drafts[id])?.submitted[id]??null;
  }
  return value;
 }
 const mergers={course:mergeCourse,vault:mergeVault,chase:mergeChase,dispatch:mergeDispatch,pursuit:(a,b)=>pick('pursuit',null,'run',a,b)};
 for(const domain of Object.keys(mergers)){
  const a=local.data[domain],b=incoming.data[domain];
  data[domain]=a===null?clone(b):b===null?clone(a):mergers[domain](a,b);
 }
 return supportedSave({format:'loopuff-save',version:2,data});
}
export function createMergePlan(local,incoming){
 const left=supportedSave(local),right=supportedSave(incoming),conflicts=[];
 merge(left,right,item=>{conflicts.push(item);return clone(item.local);});
 return {local:left,incoming:right,conflicts};
}
export function resolveMerge(plan,choices={}){
 return merge(supportedSave(plan.local),supportedSave(plan.incoming),item=>{
  const choice=choices[item.id];if(!['local','incoming'].includes(choice))throw new SaveError('SAVE_CHOICES_REQUIRED');
  return clone(item[choice]);
 });
}
