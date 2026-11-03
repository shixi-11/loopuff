import {run,LessonError} from './runner.js';
export function observeProgram(source){
 try{const result=run(source,{trace:true});return {source,ok:true,result,...result.recording};}
 catch(error){if(!(error instanceof LessonError))throw error;return {source,ok:false,code:error.code,position:error.position,events:error.recording?.events||[],truncated:!!error.recording?.truncated,result:{logs:error.recording?.logs||[],outputs:error.recording?.outputs||[],waiting:0}};}
}
// Replaying a prefix never executes code or writes progress. Message tokens keep
// repeated values and competing receivers distinct; one receive takes a whole join.
export function programFrame(report,cursor){
 const events=report?.events||[],count=Math.max(0,Math.min(events.length,Number.isInteger(cursor)?cursor:0));
 const channels=new Map(),waiting=new Map(),calls=new Map(),outputs=[];let references=[];
 const channel=id=>{if(!channels.has(id))channels.set(id,{id,names:[],messages:[],reply:false});return channels.get(id);};
 for(const event of events.slice(0,count)){
  if(event.type==='channel')channel(event.channel);
  if(event.references)references=event.references;
  if(event.type==='call'){calls.set(event.invocation,{name:event.name,args:event.args});if(event.replyChannel){const port=channel(event.replyChannel);port.replyName=event.name+'()';port.names=[port.replyName];port.reply=true;}}
  if(event.type==='send')channel(event.channel).messages.push({id:event.message,value:event.value});
  if(event.type==='wait')waiting.set(event.request,{...event});
  if(event.type==='receive'){
   event.channels.forEach((id,index)=>{const port=channel(id),at=port.messages.findIndex(message=>message.id===event.messages[index]);if(at<0)throw Error('Missing recorded message');port.messages.splice(at,1);});
   waiting.delete(event.request);
  }
  if(event.type==='log')outputs.push(event.value);
 }
 for(const port of channels.values()){port.bindings=references.filter(binding=>binding.channel===port.id);port.names=[...new Set(port.bindings.map(binding=>binding.name))];if(port.replyName&&!port.names.length)port.names=[port.replyName];}
 const event=events[count-1]||null;
 return {cursor:count,total:events.length,event,channels:[...channels.values()],waiting:[...waiting.values()],calls,outputs,names:event?.names||{},bindingIds:event?.bindingIds||{},context:event?calls.get(event.context)||null:null,finished:!!report&&count===events.length};
}
