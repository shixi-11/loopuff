import {observeProgram,programFrame} from './program-scene.js';

export const experimentKinds=['function','join'];
export function experimentSettings(kind){
 if(!experimentKinds.includes(kind))throw Error('Unknown experiment');
 return {a:kind==='function'?'3':'4',b:kind==='function'?'4':'6',west:true,east:false};
}
export function experimentSource(kind,settings){
 if(!experimentKinds.includes(kind))throw Error('Unknown experiment');
 if(!['a','b'].every(key=>typeof settings[key]==='string'&&/^\d{1,2}$/.test(settings[key])))return null;
 const a=Number(settings.a),b=Number(settings.b);
 if(kind==='function')return `sync fn combine(a, b) {\n  return a + b\n};\nlet load = combine(${a}, ${b});\nload.log()`;
 if(typeof settings.west!=='boolean'||typeof settings.east!=='boolean')return null;
 const parts=[...(settings.west?[`west ! ${a}`]:[]),...(settings.east?[`east ! ${b}`]:[]),'?(a <- west & b <- east) {\n  (a + b).log()\n}'];
 return `let west; let east;\n{ ${parts.join('\n| ')}\n}`;
}
export function runExperiment(kind,settings){
 const source=experimentSource(kind,settings);return source===null?null:observeProgram(source);
}
// The display reads recorded events, including invocation identity and atomic
// receives. It never calculates a substitute result from the input controls.
export function experimentObservation(report){
 if(!report?.ok||report.truncated)return null;
 const events=report.events,call=events.find(event=>event.type==='call');
 const calculation=call?events.find(event=>event.type==='calculate'&&event.context===call.invocation):null;
 const returned=call?events.find(event=>event.type==='call-result'&&event.invocation===call.invocation):null;
 const frame=programFrame(report,events.length);
 return {call,calculation,returned,ports:frame.channels.map(port=>({names:port.names,queued:port.messages.map(message=>message.value),sent:events.filter(event=>event.type==='send'&&event.channel===port.id).map(event=>event.value)})),
  received:events.filter(event=>event.type==='receive'&&event.channels.length>1).map(event=>event.values),waiting:report.result.waiting,outputs:report.result.logs};
}
