import {saveKeys,normalizeSave,SaveError} from '../server/save-format.mjs';
import {supportedSave} from './save-merge.js';

export const journalKey='loopuff-restore-v1',ownerKey='loopuff-owner-v1';
const keys=Object.values(saveKeys),transactionKeys=[...keys,ownerKey];
const fail=code=>{throw new SaveError(code);};
export function readBaseline(storage){return Object.fromEntries(transactionKeys.map(key=>[key,storage.getItem(key)]));}
export function baselineMatches(storage,baseline){return transactionKeys.every(key=>storage.getItem(key)===baseline[key]);}
export function captureSave(storage){
 const baseline=readBaseline(storage),data={};
 for(const [domain,key] of Object.entries(saveKeys)){
  try{data[domain]=baseline[key]===null?null:JSON.parse(baseline[key]);}catch{fail('SAVE_INVALID');}
 }
 return {baseline,snapshot:supportedSave({format:'loopuff-save',version:3,data})};
}
export function readOwner(storage){
 const raw=storage.getItem(ownerKey);if(raw===null)return null;
 try{const value=JSON.parse(raw);if(value?.version===1&&typeof value.accountId==='string'&&value.accountId.length>0&&value.accountId.length<=128&&Object.keys(value).every(key=>['version','accountId'].includes(key)))return value.accountId;}catch{}
 // A damaged ownership record must not silently become guest data.
 fail('SAVE_OWNER_INVALID');
}
function journal(storage){
 const raw=storage.getItem(journalKey);if(raw===null)return null;
 let value;try{value=JSON.parse(raw);}catch{fail('SAVE_RECOVERY_REQUIRED');}
 if(value?.version!==1||!Array.isArray(value.entries)||value.entries.length>transactionKeys.length||!Number.isInteger(value.attempted)||value.attempted<0||value.attempted>value.entries.length||Object.keys(value).some(key=>!['version','entries','attempted'].includes(key)))fail('SAVE_RECOVERY_REQUIRED');
 const seen=new Set();
 for(const item of value.entries){
  if(!item||!transactionKeys.includes(item.key)||seen.has(item.key)||Object.keys(item).some(key=>!['key','before','after'].includes(key))||![item.before,item.after].every(s=>s===null||typeof s==='string'&&s.length<=1024*1024))fail('SAVE_RECOVERY_REQUIRED');
  seen.add(item.key);
 }
 return {raw,value};
}
const write=(storage,key,value)=>value===null?storage.removeItem(key):storage.setItem(key,value);
// Recovery rolls back only bytes still written by this restore. A third version
// from another tab stays in place with the two original versions in the journal.
function recoverSave(storage){
 const saved=journal(storage);if(!saved)return {status:'none',conflicts:[]};
 const conflicts=[];
 for(const item of saved.value.entries.slice(0,saved.value.attempted).reverse()){
  const current=storage.getItem(item.key);
  if(current===item.before)continue;
  if(current===item.after){
   if(storage.getItem(journalKey)!==saved.raw)fail('SAVE_RECOVERY_REQUIRED');
   write(storage,item.key,item.before);
  }else conflicts.push({...item,current});
 }
 if(!conflicts.length){if(storage.getItem(journalKey)!==saved.raw)fail('SAVE_RECOVERY_REQUIRED');storage.removeItem(journalKey);}
 return {status:conflicts.length?'pending':'recovered',conflicts};
}
// Explicitly keep the current bytes after the player has reviewed a recovery.
function keepRecoveredSave(storage,baseline,expectedJournal){
 if(!baselineMatches(storage,baseline)||storage.getItem(journalKey)!==expectedJournal)fail('SAVE_LOCAL_CHANGED');
 journal(storage);storage.removeItem(journalKey);
}
function applySave(storage,value,baseline,{accountId,expectedOwner=baseline[ownerKey]}={}){
 const snapshot=supportedSave(value);
 if(!baselineMatches(storage,baseline)||storage.getItem(ownerKey)!==expectedOwner)fail('SAVE_LOCAL_CHANGED');
 if(storage.getItem(journalKey)!==null)fail('SAVE_RECOVERY_REQUIRED');
 if(accountId!==undefined&&accountId!==null&&(typeof accountId!=='string'||!accountId||accountId.length>128))fail('SAVE_OWNER_INVALID');
 const entries=Object.entries(saveKeys).map(([domain,key])=>({key,before:baseline[key],after:snapshot.data[domain]===null?null:JSON.stringify(snapshot.data[domain])}));
 if(accountId!==undefined)entries.push({key:ownerKey,before:expectedOwner,after:accountId===null?null:JSON.stringify({version:1,accountId})});
 const valueJournal={version:1,entries,attempted:0};let owned=null;
 try{
  for(let i=0;i<entries.length;i++){
   const item=entries[i];
   if(storage.getItem(item.key)!==item.before||owned!==null&&storage.getItem(journalKey)!==owned)fail('SAVE_LOCAL_CHANGED');
   valueJournal.attempted=i+1;const nextJournal=JSON.stringify(valueJournal);storage.setItem(journalKey,nextJournal);owned=nextJournal;
   // Recheck after storing the recovery journal; another tab may have saved.
   if(storage.getItem(item.key)!==item.before)fail('SAVE_LOCAL_CHANGED');
   write(storage,item.key,item.after);
  }
  if(storage.getItem(journalKey)!==owned||entries.some(item=>storage.getItem(item.key)!==item.after)||accountId===undefined&&storage.getItem(ownerKey)!==expectedOwner)fail('SAVE_LOCAL_CHANGED');
  storage.removeItem(journalKey);
 }catch(error){
  if(owned!==null&&storage.getItem(journalKey)===owned){try{if(recoverSave(storage).status==='pending')throw new SaveError('SAVE_RECOVERY_REQUIRED');}catch{throw new SaveError('SAVE_RECOVERY_REQUIRED');}}
  throw error instanceof SaveError?error:new SaveError('SAVE_STORAGE');
 }
 return normalizeSave(snapshot);
}

// Every current game writer uses the same origin-wide Web Lock as restoration.
// The baseline also prevents an older open page from overwriting another page's
// completed write once it next acquires the lock. Legacy pages cannot join this
// protocol; close old game pages before importing a backup.
export function createSaveAccess(storage,{locks=globalThis.navigator?.locks}={}){
 let expected=readBaseline(storage),blocked=false;
 const exclusive=(operation,required=true)=>{
  if(locks?.request)return locks.request('loopuff-progress-v1',{mode:'exclusive'},operation);
  if(required)return Promise.reject(new SaveError('SAVE_LOCK_REQUIRED'));
  return Promise.resolve().then(operation);
 };
 return {
  capture:()=>exclusive(()=>captureSave(storage),false),
  async recover(){
   if(!locks?.request&&storage.getItem(journalKey)===null)return {status:'none',conflicts:[]};
   return exclusive(()=>{const report=recoverSave(storage);expected=readBaseline(storage);blocked=blocked||report.status!=='none';return report;});
  },
  write(operation){return exclusive(()=>{
   if(blocked||storage.getItem(journalKey)!==null)fail('SAVE_RECOVERY_REQUIRED');
   if(!baselineMatches(storage,expected))fail('SAVE_LOCAL_CHANGED');
   operation();expected=readBaseline(storage);
  },false);},
  apply(value,baseline,options){return exclusive(()=>{
   if(options?.isCurrent&&!options.isCurrent())fail('SAVE_CANCELLED');
   try{const result=applySave(storage,value,baseline,options);blocked=true;return result;}
   finally{expected=readBaseline(storage);if(storage.getItem(journalKey)!==null)blocked=true;}
  });},
  keep(baseline,expectedJournal,{isCurrent}={}){return exclusive(()=>{if(isCurrent&&!isCurrent())fail('SAVE_CANCELLED');keepRecoveredSave(storage,baseline,expectedJournal);blocked=true;});},
  bind(accountId,baseline,{isCurrent}={}){return exclusive(()=>{
   if(isCurrent&&!isCurrent())fail('SAVE_CANCELLED');
   if(blocked||storage.getItem(journalKey)!==null)fail('SAVE_RECOVERY_REQUIRED');
   if(!baselineMatches(storage,baseline))fail('SAVE_LOCAL_CHANGED');
   if(typeof accountId!=='string'||!accountId||accountId.length>128)fail('SAVE_OWNER_INVALID');
   storage.setItem(ownerKey,JSON.stringify({version:1,accountId}));expected=readBaseline(storage);
  });}
 };
}
let browserAccess;
export function progressStorage(){return browserAccess??=createSaveAccess(localStorage);}
