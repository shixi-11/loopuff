import {createLoopuffRelay} from '../server/http-relay.mjs';
import {arcadeGameIds} from '../src/arcade-protocol.js';
const upstream='https://games.tail1291c2.ts.net/loopuff/api/arcade';
const integer=value=>Number.isSafeInteger(value)&&value>=0;
function profile(value){
 if(value===null)return null;
 if(typeof value?.nickname!=='string'||!integer(value.coins)||!Array.isArray(value.achievements)||!value.achievements.every(key=>typeof key==='string'))throw Error('Invalid profile');
 return {nickname:value.nickname,coins:value.coins,achievements:value.achievements};
}
export function filterArcade(data){
 if(data?.error)return {error:{code:String(data.error.code||'ARCADE_UNAVAILABLE').slice(0,100)}};
 if(data?.leaderboard){
  if(!arcadeGameIds.includes(data.game)||!Array.isArray(data.leaderboard))throw Error('Invalid leaderboard');
  return {game:data.game,leaderboard:data.leaderboard.map(row=>{
   if(!integer(row.rank)||typeof row.nickname!=='string'||!integer(row.score)||!Number.isFinite(row.durationMs)||row.durationMs<0||typeof row.won!=='boolean')throw Error('Invalid row');
   return {rank:row.rank,nickname:row.nickname,score:row.score,durationMs:row.durationMs,won:row.won};
  }),profile:profile(data.profile)};
 }
 if(typeof data?.runId==='string'){
  if('seed' in data){if(!arcadeGameIds.includes(data.game)||!integer(data.seed)||!integer(data.expiresAt))throw Error('Invalid run');return {runId:data.runId,game:data.game,seed:data.seed,expiresAt:data.expiresAt};}
  if(!arcadeGameIds.includes(data.game)||!integer(data.score)||typeof data.won!=='boolean'||!Number.isFinite(data.durationMs)||data.durationMs<0||!integer(data.awarded))throw Error('Invalid result');
  return {runId:data.runId,game:data.game,score:data.score,won:data.won,durationMs:data.durationMs,awarded:data.awarded,profile:profile(data.profile)};
 }
 if(data?.passed===true){if(!integer(data.awarded))throw Error('Invalid award');return {passed:true,awarded:data.awarded,profile:profile(data.profile)};}
 if('profile' in (data??{}))return {profile:profile(data.profile)};
 throw Error('Invalid arcade response');
}
export function createArcadeRelay({fetchImpl=fetch,target=upstream}={}){
 return (req,res)=>{
  const game=new URL(req.url||'/', 'http://localhost').searchParams.get('game');
  const url=new URL(target);if(game!==null)url.searchParams.set('game',game);
  return createLoopuffRelay({target:url.href,fetchImpl,checkGetOrigin:true,bodyLimit:2*1024*1024,unavailable:{error:{code:'ARCADE_UNAVAILABLE'}},filter:filterArcade})(req,res);
 };
}
export default createArcadeRelay();
