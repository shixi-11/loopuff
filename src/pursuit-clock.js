// Wall-clock input is explicit. A delayed/background frame never becomes a
// large simulation jump or an accelerated way to meet the ten-minute minimum.
export function createPursuitClock({state,advance,pause}){
 let previous=null;
 return {reset(){previous=null;},frame(now,{visible=true,focused=true}={}){
  if(state.status!=='running'){previous=null;return;}
  if(!visible||!focused){previous=null;pause('background');return;}
  if(previous===null){previous=now;return;}
  const elapsed=now-previous;previous=now;
  if(!Number.isFinite(elapsed)||elapsed<0||elapsed>250){previous=null;pause('slow');return;}
  advance(elapsed);
 }};
}
