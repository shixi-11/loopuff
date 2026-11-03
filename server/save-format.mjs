// Shared, host-independent save contract. No account or credential data belongs here.
import {normalizePursuit} from './pursuit-format.mjs';
import {normalizeDiagnostic} from './diagnostic-format.mjs';
export const saveLimit=256*1024;
export const saveKeys=Object.freeze({course:'loopuff-v1',vault:'loopuff-vault-v1',chase:'loopuff-chase-v1',dispatch:'loopuff-dispatch-v1',pursuit:'loopuff-pursuit-v1'});
export class SaveError extends Error{constructor(code='SAVE_INVALID'){super(code);this.code=code;}}
const fail=()=>{throw new SaveError();};
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const record=(value,keys,required=[])=>{
 if(!value||typeof value!=='object'||Array.isArray(value))fail();
 if(Object.keys(value).some(key=>!keys.includes(key))||required.some(key=>!own(value,key)))fail();
 return value;
};
const integer=(value,min,max)=>{if(!Number.isSafeInteger(value)||value<min||value>max)fail();return value;};
const text=(value,max)=>{if(typeof value!=='string'||value.length>max)fail();return value;};
const oneOf=(value,items)=>{if(!items.includes(value))fail();return value;};
const bool=value=>{if(typeof value!=='boolean')fail();return value;};
const optional=(source,key,check,target)=>{if(own(source,key))target[key]=check(source[key]);};
const array=(value,max,check)=>{if(!Array.isArray(value)||value.length>max)fail();return value.map(check);};
const fixed=(value,length,check)=>{if(!Array.isArray(value)||value.length!==length)fail();return value.map(check);};
const id=value=>{if(typeof value!=='string'||!/^[a-z][a-z0-9_-]{0,39}$/.test(value))fail();return value;};
const dictionary=(value,check)=>{record(value,Object.keys(value||{}));if(Object.keys(value).length>128)fail();return Object.fromEntries(Object.entries(value).map(([key,item])=>[id(key),check(item)]));};
const ids=value=>[...new Set(array(value,128,id))];
const stages=value=>[...new Set(array(value,3,n=>integer(n,0,2)))];
const phases=['welcome','levels','brief','typing','predict','output','explain','remix','independent','result','complete','guide','pause','play','vault','chase','dispatch','account','saves'];
const workPhases=['brief','typing','predict','output','explain','remix','independent','result','complete'];
const workKeys=['phase','fragment','typed','draft','assessedSource','score','errors','keys'];
function work(value){
 record(value,workKeys,['phase']);const result={phase:oneOf(value.phase,workPhases)};
 for(const key of ['fragment','score','errors','keys'])optional(value,key,n=>integer(n,0,1000000000),result);
 for(const key of ['typed','draft'])optional(value,key,s=>text(s,4096),result);
 optional(value,'assessedSource',s=>s===null?null:text(s,4096),result);
 if(result.assessedSource!==undefined&&result.assessedSource!==result.draft)result.assessedSource=null;
 return result;
}
function course(value){
 record(value,['lang','state']);const result={};
 optional(value,'lang',lang=>oneOf(lang,['en','zh','zh-Hant','ja','ko','vi','de','es','ru','uk','ar']),result);
 optional(value,'state',state=>{
  record(state,[...workKeys,'lesson','previousPhase','resumePhase','completed','grades','lessonWork','guideWork','guideSelected','diagnostic']);
  const saved={};
  for(const key of ['phase','previousPhase','resumePhase'])optional(state,key,p=>oneOf(p,phases),saved);
  for(const key of ['lesson','fragment','score','errors','keys'])optional(state,key,n=>integer(n,0,1000000000),saved);
  for(const key of ['typed','draft'])optional(state,key,s=>text(s,4096),saved);
  optional(state,'assessedSource',s=>s===null?null:text(s,4096),saved);
  if(saved.assessedSource!==undefined&&saved.assessedSource!==saved.draft)saved.assessedSource=null;
  optional(state,'completed',ids,saved);
  optional(state,'lessonWork',map=>dictionary(map,work),saved);
  optional(state,'guideWork',map=>dictionary(map,s=>text(s,4096)),saved);
  optional(state,'guideSelected',id,saved);
  optional(state,'diagnostic',value=>{try{return normalizeDiagnostic(value);}catch{fail();}},saved);
  optional(state,'grades',map=>dictionary(map,grade=>{
   record(grade,['score','best','attempts'],['score','best','attempts']);
   return {score:integer(grade.score,0,100),best:integer(grade.best,0,100),attempts:integer(grade.attempts,0,1000000000)};
  }),saved);
  return saved;
 },result);
 return result;
}
function vault(value){
 record(value,['version','seed','stage','drafts','edited','stamps','cleared','submitted'],['version','seed','stage','drafts','stamps','cleared','submitted']);
 oneOf(value.version,[1]);const stage=integer(value.stage,0,2),drafts=fixed(value.drafts,3,s=>text(s,4096));
 const submitted=value.submitted===null?null:text(value.submitted,4096);
 return {version:1,seed:integer(value.seed,0,0xffffffff),stage,drafts,edited:own(value,'edited')?stages(value.edited):[],stamps:stages(value.stamps),cleared:stages(value.cleared),submitted:submitted===drafts[stage]?submitted:null};
}
function chase(value){
 record(value,['version','role','work'],['version','role','work']);oneOf(value.version,[1]);record(value.work,['police','thief'],['police','thief']);
 return {version:1,role:oneOf(value.role,['police','thief']),work:Object.fromEntries(['police','thief'].map(role=>{
  const item=value.work[role];record(item,['stage','drafts','submitted','cleared'],['stage','drafts','submitted','cleared']);
  const stage=integer(item.stage,0,2),drafts=fixed(item.drafts,3,s=>text(s,4096)),submitted=item.submitted===null?null:text(item.submitted,4096);
  return [role,{stage,drafts,submitted:submitted===drafts[stage]?submitted:null,cleared:stages(item.cleared)}];
 }))};
}
function dispatch(value){
 const names=['branch','manifest','fuel','relay'];
 record(value,['version','seed','selected','drafts','submitted','cleared','stamps','rounds','awarded'],['version','seed','selected','drafts','submitted','cleared','stamps','rounds']);
 oneOf(value.version,[1]);record(value.drafts,names,names);record(value.submitted,names,names);
 const drafts=Object.fromEntries(names.map(name=>[name,text(value.drafts[name],3000)]));
 const submitted=Object.fromEntries(names.map(name=>{const source=value.submitted[name]===null?null:text(value.submitted[name],3000);return [name,source===drafts[name]?source:null];}));
 const known=value=>[...new Set(array(value,4,name=>oneOf(name,names)))],cleared=known(value.cleared),awarded=cleared.length===4;
 if(own(value,'awarded'))bool(value.awarded);
 return {version:1,seed:integer(value.seed,0,0xffffffff),selected:oneOf(value.selected,names),drafts,submitted,cleared,stamps:known(value.stamps),rounds:Math.max(awarded?1:0,integer(value.rounds,0,999999)),awarded};
}
export function normalizeSave(value){
 record(value,['format','version','data'],['format','version','data']);
 if(value.format!=='loopuff-save'||![1,2].includes(value.version))throw new SaveError('SAVE_VERSION');
 const domains={course,vault,chase,dispatch,pursuit:value=>{try{return normalizePursuit(value);}catch{fail();}}};
 const fields=value.version===1?['course','vault','chase','dispatch']:Object.keys(domains);record(value.data,fields,fields);
 const data=Object.fromEntries(Object.entries(domains).map(([key,check])=>[key,value.version===1&&key==='pursuit'||value.data[key]===null?null:check(value.data[key])]));
 const result={format:'loopuff-save',version:2,data};
 if(new TextEncoder().encode(JSON.stringify(result)).length>saveLimit)throw new SaveError('SAVE_TOO_LARGE');
 return result;
}
export function parseSave(raw){
 if(typeof raw!=='string')fail();
 if(new TextEncoder().encode(raw).length>saveLimit)throw new SaveError('SAVE_TOO_LARGE');
 let value;try{value=JSON.parse(raw);}catch{throw new SaveError('SAVE_INVALID');}
 return normalizeSave(value);
}
export function emptySave(){return {format:'loopuff-save',version:2,data:{course:null,vault:null,chase:null,dispatch:null,pursuit:null}};}
