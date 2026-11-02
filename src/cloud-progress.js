import {gamePrefix} from './routing.js';
import {normalizeSave} from '../server/save-format.mjs';
const error=code=>Object.assign(new Error(code),{code});
export function createCloudProgress({url,getAccount,fetchImpl=fetch}){
 const endpoint=new URL(`${gamePrefix(new URL(url).pathname)}/api/progress/`,url);
 let generation=0,controller=null;
 async function request(method,body,actor){
  if(!actor?.id)throw error('AUTH_REQUIRED');
  if(getAccount()?.id!==actor.id)throw error('ACCOUNT_CHANGED');
  const current=++generation;controller?.abort();const active=new AbortController();controller=active;
  const timer=setTimeout(()=>active.abort(),15000);
  let response,data;
  try{
   try{response=await fetchImpl(endpoint,{method,credentials:'same-origin',signal:active.signal,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});}
   catch{if(current!==generation||getAccount()?.id!==actor.id)throw error('ACCOUNT_CHANGED');throw error(method==='POST'?'SAVE_UNCONFIRMED':'SAVE_NETWORK');}
   try{data=await response.json();}catch{throw error(method==='POST'?'SAVE_UNCONFIRMED':'SAVE_UNAVAILABLE');}
   if(current!==generation||getAccount()?.id!==actor.id)throw error('ACCOUNT_CHANGED');
   if(!response.ok)throw error(method==='POST'&&response.status>=500?'SAVE_UNCONFIRMED':data?.error?.code||'SAVE_UNAVAILABLE');
   if(data?.account?.id!==actor.id||!Number.isSafeInteger(data.revision)||data.revision<0||!(data.updatedAt===null||Number.isSafeInteger(data.updatedAt)&&data.updatedAt>=0)||data.revision>0&&data.updatedAt===null||method==='POST'&&data.revision!==body.expectedRevision+1)throw error(method==='POST'?'SAVE_UNCONFIRMED':'SAVE_UNAVAILABLE');
   let snapshot;
   if('snapshot' in data){try{snapshot=data.snapshot===null?null:normalizeSave(data.snapshot);}catch{throw error(method==='POST'?'SAVE_UNCONFIRMED':'SAVE_UNAVAILABLE');}}
   if(method==='GET'&&(!('snapshot' in data)||data.revision===0&&snapshot!==null||data.revision>0&&snapshot===null))throw error('SAVE_UNAVAILABLE');
   return {...data,...('snapshot' in data?{snapshot}:{})};
  }finally{clearTimeout(timer);if(controller===active)controller=null;}
 }
 return {
  async read(){const actor=getAccount();const result=await request('GET',null,actor);if(!('snapshot' in result))throw error('SAVE_UNAVAILABLE');return result;},
  async write(snapshot,base){
   const actor=getAccount();
   if(!base?.account?.id||base.account.id!==actor?.id||!Number.isSafeInteger(base.revision)||base.revision<0)throw error('ACCOUNT_CHANGED');
   return request('POST',{expectedAccountId:base.account.id,expectedRevision:base.revision,snapshot:normalizeSave(snapshot)},actor);
  },
  reset(){generation++;controller?.abort();controller=null;}
 };
}
