import {newPursuit,pausePursuit,savePursuit,restorePursuit} from './pursuit.js';
import {progressStorage} from './save-data.js';
import {createSessionSaveQueue} from './session-save-queue.js';
export const pursuitKey='loopuff-pursuit-v1';
const fresh=(role='police',difficulty='standard',draft='1.log()')=>{const s=newPursuit(crypto.getRandomValues(new Uint32Array(1))[0],role,difficulty,crypto.randomUUID());s.draft=draft;return s;};
export function loadPursuit(storage=localStorage){const raw=storage.getItem(pursuitKey);return raw===null?null:restorePursuit(JSON.parse(raw));}
// One tab owns one live session, across language changes and SPA remounts.
// Pending writes always flush the newest shared world, never a disposed view.
export function createPursuitSession({storage=localStorage,access,createWorld=fresh}={}){
 let loaded=null,badSave=false;try{loaded=loadPursuit(storage);}catch{badSave=true;}
 const listeners=new Set(),session={world:loaded?.current||createWorld(),history:loaded?.history||[],badSave,saveFailed:false,restored:!!loaded};
 const notify=()=>{for(const listener of listeners)listener(session);};
 session.subscribe=listener=>{listeners.add(listener);return()=>listeners.delete(listener);};
 const enqueue=createSessionSaveQueue({write:async()=>{
     const raw=JSON.stringify(savePursuit(session.world,session.history));
     await (access||progressStorage()).write(()=>storage.setItem(pursuitKey,raw));session.saveFailed=false;
 },failed:()=>{session.saveFailed=true;pausePursuit(session.world);},settled:notify});
 session.persist=()=>session.badSave?Promise.resolve(false):enqueue();
 session.replace=(role,difficulty,draft)=>{session.world=createWorld(role,difficulty,draft);session.badSave=false;session.saveFailed=false;session.restored=false;notify();return session.world;};
 session.finish=()=>{
  const s=session.world;if(s.status!=='finished'||session.history.some(h=>h.id===s.id))return false;
  const a=s.actors[s.role];session.history.push({id:s.id,seed:s.seed,role:s.role,difficulty:s.difficulty,activeMs:s.activeMs,outcome:s.outcome,collisions:a.collisions,clears:a.clears});
  if(session.history.length>20)session.history.splice(0,session.history.length-20);session.persist();return true;
 };
 return session;
}
