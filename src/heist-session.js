import {newHeist,pauseHeist,saveHeist,restoreHeist} from './heist.js';
import {heistStarter} from './heist-strategies.js';
import {progressStorage} from './save-data.js';
import {createSessionSaveQueue} from './session-save-queue.js';
export const heistKey='loopuff-heist-v1';
const fresh=(seed=crypto.getRandomValues(new Uint32Array(1))[0],mode='practice',draft=heistStarter)=>{const s=newHeist(seed,mode);s.draft=draft;return s;};
export function createHeistSession({storage=localStorage,access,createWorld=fresh}={}){
 let saved=null,badSave=false;try{const raw=storage.getItem(heistKey);if(raw!==null)saved=restoreHeist(JSON.parse(raw));}catch{badSave=true;}
 const listeners=new Set(),session={world:saved?.current||createWorld(),history:saved?.history||[],badSave,saveFailed:false,restored:!!saved};
 const notify=()=>{for(const listener of listeners)listener(session);};
 session.subscribe=listener=>{listeners.add(listener);return()=>listeners.delete(listener);};
 const enqueue=createSessionSaveQueue({write:async()=>{
   const snapshot=saveHeist(session.world,session.history);session.history=snapshot.history;
   await (access||progressStorage()).write(()=>storage.setItem(heistKey,JSON.stringify(snapshot)));session.saveFailed=false;
 },failed:()=>{session.saveFailed=true;pauseHeist(session.world);},settled:notify});
 session.persist=()=>session.badSave?Promise.resolve(false):enqueue();
 session.replace=(seed,mode,draft)=>{pauseHeist(session.world);session.world=createWorld(seed,mode,draft);session.badSave=false;session.saveFailed=false;session.restored=false;notify();return session.world;};
 return session;
}
