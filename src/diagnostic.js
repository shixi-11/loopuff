import {grade} from './assessment.js';
import {dispatchPuzzle} from './dispatch.js';
import {diagnosticFeedback} from './diagnostic-feedback.js';
import {diagnosticIds,diagnosticSourceLimit,normalizeDiagnostic} from '../server/diagnostic-format.mjs';
export {diagnosticIds,diagnosticSourceLimit,normalizeDiagnostic};
const known=id=>{if(!diagnosticIds.includes(id))throw Error('Unknown diagnostic area');};
const literal=value=>Array.isArray(value)?`[${value.join(', ')}]`:String(value);
const sample=(inputs,logs,options={})=>({inputs,logs:logs.map(String),prefix:Object.entries(inputs).map(([key,value])=>`let ${key} = ${literal(value)};`).join('\n')+'\n',suffix:'',...options});
export const diagnosticLessons={names:['signal','addition','names'],branch:['comparison','branch'],repeat:['repeat'],counter:['counter'],function:['function'],reply:['reply'],message:['message'],join:['join'],coordination:['coordination']};
export function diagnosticPuzzle(seed,id){
 known(id);if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('Invalid diagnostic seed');
 if(id==='coordination'){const p=dispatchPuzzle(seed,'relay');return {...p,id,lessons:diagnosticLessons[id]};}
 let random=(seed>>>0)^Math.imul(diagnosticIds.indexOf(id)+1,0x9e3779b1);
 const roll=()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random;};
 let cases,require,dataRequire=[],example;
 if(id==='names'){
  const pairs=[[0,0],[0,4],[3,0],[-2,5],[8,-3],...Array.from({length:7},()=>[roll()%19-6,roll()%13-4])];
  cases=pairs.map(([cargo,reserve])=>sample({cargo,reserve},[cargo+reserve]));require=['name','add'];dataRequire=['add'];example='(cargo + reserve).log()';
 }else if(id==='branch'){
  const threshold=3+roll()%5;
  cases=[0,threshold-1,threshold,threshold+1,12,...Array.from({length:5},()=>roll()%14)].map(fuel=>sample({fuel,threshold},[fuel>threshold?1:2]));
  require=['name','if','compare'];example='if fuel > threshold then { 1.log() } else { 2.log() }';
 }else if(id==='repeat'){
  const lists=[[],[0],[3,1,3],[-2,0,4],...Array.from({length:6},()=>Array.from({length:roll()%6},()=>roll()%11-3))];
  cases=lists.map(docks=>{const offset=roll()%5;return sample({docks,offset},docks.map(value=>value+offset));});
  require=['for','name','add'];dataRequire=['for','add'];example='for dock in docks { (dock + offset).log() }';
 }else if(id==='counter'){
  cases=[0,1,2,5,8,...Array.from({length:4},()=>roll()%9)].map(limit=>sample({limit},Array.from({length:limit},(_,i)=>i),{require:limit===1?['while','compare','name']:undefined}));
  require=['while','compare','name','add'];dataRequire=['add','name'];example='let count = 0; while count < limit { count.log(); count = count + 1 }';
 }else if(id==='function'||id==='reply'){
  const pairs=[[0,0],[0,7],[4,0],[-3,8],[6,-2],...Array.from({length:7},()=>[roll()%19-5,roll()%11-3])],name=id==='function'?'combine':'boost';
  cases=pairs.map(([cargo,reserve])=>sample({cargo,reserve},[cargo+reserve],{prefix:'',suffix:`\n${name}(${cargo}, ${reserve}).log()`,inputCode:`${name}(${cargo}, ${reserve})`}));
  require=['name','add','call',...(id==='reply'?['reply']:[])];dataRequire=['add','call',...(id==='reply'?['reply']:[])];
  example=id==='function'?'sync fn combine(a,b) { return a + b }':'fn boost(a,b) { return ! (a + b) }';
 }else if(id==='message'){
  cases=[0,1,-3,9,...Array.from({length:6},()=>roll()%21-6)].map(parcel=>sample({parcel},[parcel+1],{prefix:`let mailbox;\n{ mailbox ! ${parcel} | {\n`,suffix:'\n} }',inputCode:`mailbox ! ${parcel}`}));
  require=['name','receive','add'];dataRequire=['receive','add'];example='?(value <- mailbox) { (value + 1).log() }';
 }else{
  const pairs=[[0,0],[0,5],[4,0],[-2,7],[3,-4],...Array.from({length:7},()=>[roll()%13-3,roll()%17-4])];
  cases=pairs.map(([westLoad,eastLoad])=>sample({westLoad,eastLoad},[westLoad+eastLoad],{prefix:`let west; let east;\n{ west ! ${westLoad} | east ! ${eastLoad} | {\n`,suffix:'\n} }',inputCode:`west ! ${westLoad};\neast ! ${eastLoad}`}));
  require=['name','receive','join','add'];dataRequire=['receive','join','add'];example='?(a <- west & b <- east) { (a + b).log() }';
 }
 return {id,cases,require,dataRequire,example,lessons:diagnosticLessons[id],...(id==='function'||id==='reply'?{callKind:id==='function'?'sync':'reply'}:{})};
}
export function inspectDiagnostic(seed,id,source){
 const puzzle=diagnosticPuzzle(seed,id);
 if(typeof source!=='string'||source.length>diagnosticSourceLimit)return {ok:false,passed:0,total:puzzle.cases.length,cases:[],code:'limit'};
 const cases=puzzle.cases.map(item=>{
  const full=item.prefix+source+(item.suffix||''),require=item.logs.length?(item.require||puzzle.require):[],dataRequire=puzzle.dataRequire.filter(key=>require.includes(key));
  const report=grade(full,{logs:item.logs,require,dataRequire,eachOutputRequire:require.filter(key=>id!=='counter'||key!=='add')});
  if(report.result?.waiting){report.ok=false;report.code='waiting';}
  if(report.ok&&puzzle.callKind){
   const entry=report.result.calls.find(call=>call.start===item.prefix.length+source.length+1);
   if(entry?.kind!==puzzle.callKind){report.ok=false;report.code=puzzle.callKind==='sync'?'syncRequired':'replyRequired';}
  }
  return {...report,position:Math.max(0,(report.position||0)-item.prefix.length),inputs:item.inputs,expected:item.logs,
   outputs:report.result?.outputs.map(output=>{const fromPlayer=output.start>=item.prefix.length&&output.end<=item.prefix.length+source.length;return{...output,source:full.slice(output.start,output.end),start:fromPlayer?output.start-item.prefix.length:null,end:fromPlayer?output.end-item.prefix.length:null};})||[]};
 });
 return {ok:cases.every(item=>item.ok),passed:cases.filter(item=>item.ok).length,total:cases.length,cases,code:cases.find(item=>!item.ok)?.code||null};
}
export function newDiagnostic(seed){
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('Invalid diagnostic seed');
 return {version:1,seed,selected:diagnosticIds[0],drafts:Object.fromEntries(diagnosticIds.map(id=>[id,''])),submitted:Object.fromEntries(diagnosticIds.map(id=>[id,null])),hints:Object.fromEntries(diagnosticIds.map(id=>[id,0]))};
}
export function editDiagnostic(state,id,source){known(id);if(typeof source!=='string'||source.length>diagnosticSourceLimit)throw Error('Invalid diagnostic source');state.drafts[id]=source;state.submitted[id]=null;}
export function submitDiagnostic(state,id,source){editDiagnostic(state,id,source);const report=inspectDiagnostic(state.seed,id,source);state.submitted[id]=source;return report;}
export function requestDiagnosticHint(state,id){known(id);return state.hints[id]=Math.min(2,state.hints[id]+1);}
export function nextDiagnostic(state,seed){const candidate=newDiagnostic(seed);if((candidate.seed&3)===(state.seed&3))candidate.seed=(seed^1)>>>0;candidate.selected=state.selected;candidate.drafts={...state.drafts};return candidate;}
export function diagnosticSummary(state){
 const results=Object.fromEntries(diagnosticIds.map(id=>[id,state.submitted[id]!==null&&state.submitted[id]===state.drafts[id]?inspectDiagnostic(state.seed,id,state.drafts[id]):null]));
 const passed=diagnosticIds.filter(id=>results[id]?.ok),pending=diagnosticIds.find(id=>!results[id]?.ok);
 return {results,passed,checked:diagnosticIds.filter(id=>results[id]).length,next:pending||null,lesson:pending?diagnosticFeedback(pending,results[pending],state.drafts[pending]).lesson:null};
}
