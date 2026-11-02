// Relay the dedicated account contract without exposing provider tokens.
import {createLoopuffRelay} from "../server/http-relay.mjs";
const upstream="https://games.tail1291c2.ts.net/loopuff/api/account";
export function createAccountRelay({fetchImpl=fetch,target=upstream}={}){
 return createLoopuffRelay({target,fetchImpl,bodyLimit:4096,unavailable:{available:false,user:null,error:{code:"AUTH_UNAVAILABLE"}},filter:data=>data?.error?{error:{code:String(data.error.code||"AUTH_FAILED").slice(0,100)}}:{available:data?.available!==false,user:data?.user?{id:data.user.id,email:data.user.email}:null}});
}
export default createAccountRelay();
