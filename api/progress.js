import {createLoopuffRelay} from '../server/http-relay.mjs';
import {normalizeSave,saveLimit} from '../server/save-format.mjs';
const upstream='https://games.tail1291c2.ts.net/loopuff/api/progress';
export function createProgressRelay({fetchImpl=fetch,target=upstream}={}){
 return createLoopuffRelay({target,fetchImpl,checkGetOrigin:true,bodyLimit:saveLimit+4096,unavailable:{error:{code:'SAVE_UNAVAILABLE'}},filter:data=>{
  if(data?.error)return {error:{code:String(data.error.code||'SAVE_UNAVAILABLE').slice(0,100)}};
  if(typeof data?.account?.id!=='string'||typeof data.account.email!=='string'||!Number.isSafeInteger(data.revision)||data.revision<0||!(data.updatedAt===null||Number.isSafeInteger(data.updatedAt)))throw Error('Invalid progress response');
  return {account:{id:data.account.id,email:data.account.email},revision:data.revision,updatedAt:data.updatedAt,...('snapshot' in data?{snapshot:data.snapshot===null?null:normalizeSave(data.snapshot)}:{})};
 }});
}
export default createProgressRelay();
