// A request resolves only after a write containing it. Closing the drain is
// synchronous, so a completion microtask cannot strand a later request.
export function createSessionSaveQueue({write,failed,settled}){
 let active=false,serial=0,waiters=[];
 const notify=()=>{try{settled();}catch(error){if(globalThis.reportError)globalThis.reportError(error);else console.error('Progress view update failed',error);}};
 async function drain(){
  while(waiters.length){
   const batch=serial;
   try{await write();}
   catch(error){failed(error);const rejected=waiters;waiters=[];active=false;for(const item of rejected)item.resolve(false);notify();return;}
   const completed=waiters.filter(item=>item.serial<=batch);waiters=waiters.filter(item=>item.serial>batch);for(const item of completed)item.resolve(true);notify();
  }
  active=false;
 }
 return ()=>new Promise(resolve=>{waiters.push({serial:++serial,resolve});if(!active){active=true;void drain();}});
}
