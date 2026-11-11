import {gradeTask} from './assessment.js';
import {startStepIds,startWorkKey} from './guide-work.js';
import {normalizeDiagnostic,diagnosticSummary} from './diagnostic.js';
import {dispatchIds,inspectDispatch} from './dispatch.js';

export const startSteps=[
 {id:'run',starter:'7.log()',example:'7.log()',logs:['7'],require:[]},
 {id:'change',starter:'7.log()',example:'9.log()',logs:['9'],require:[]},
 {id:'repair',starter:'7.log(',example:'7.log()',logs:['7'],require:[]},
 {id:'calculate',starter:'(2 + 3).log()',example:'(4 + 7).log()',logs:['11'],require:['add'],dataRequire:['add']},
 {id:'name',starter:'let energy = 5;\n(energy + 2).log()',example:'let energy = 10;\n(energy + 4).log()',logs:['14'],require:['name','add'],dataRequire:['name','add']},
 {id:'decide',starter:'1.log()',example:'if obstacle < 4 then { 3.log() } else { 1.log() }',require:['if','compare','name'],inputs:[3,4,8,1,0,2]}
];
const step=id=>{const value=startSteps.find(item=>item.id===id);if(!value)throw Error('Unknown start step');return value;};
export function startSource(work,id){return work[startWorkKey(id)]??step(id).starter;}
export function inspectStartStep(id,source){
 const task=step(id),values=task.inputs||[null];
 if(typeof source!=='string'||source.length>4096)return {ok:false,code:'limit',cases:[]};
 const cases=values.map(obstacle=>{
  const prefix=obstacle===null?'':`let obstacle = ${obstacle};\n`,expected=obstacle===null?task.logs:[obstacle<4?'3':'1'];
  const report=gradeTask(prefix+source,{logs:expected,require:task.require,dataRequire:task.dataRequire||[]});
  return {...report,expected,obstacle,position:Math.max(0,(report.position||0)-prefix.length),outputs:report.result?.outputs.map(output=>({...output,start:Math.max(0,output.start-prefix.length),end:Math.max(0,output.end-prefix.length)}))||[]};
 });
 return {ok:cases.every(item=>item.ok),code:cases.find(item=>!item.ok)?.code||null,cases};
}
export function startProgress(work){return startStepIds.filter(id=>typeof work[startWorkKey(id,true)]==='string'&&work[startWorkKey(id,true)]===startSource(work,id)&&inspectStartStep(id,startSource(work,id)).ok);}
export function editStart(work,id,source){step(id);if(typeof source!=='string'||source.length>4096)throw Error('Invalid start source');work[startWorkKey(id)]=source;delete work[startWorkKey(id,true)];}
export function checkStart(work,id){const source=startSource(work,id),report=inspectStartStep(id,source);work[startWorkKey(id,true)]=source;return report;}
export function requestedStartStep(input,work){const id=new URL(input).searchParams.get('step');return startStepIds.includes(id)?id:startStepIds.find(id=>!startProgress(work).includes(id))||startStepIds.at(-1);}
export function advanceProgress(diagnostic,dispatch){
 let checked={passed:[],next:'names'},bad=false;
 if(diagnostic!==undefined)try{checked=diagnosticSummary(normalizeDiagnostic(diagnostic));}catch{bad=true;}
 const projects=dispatchIds.filter(id=>dispatch?.submitted?.[id]!==null&&typeof dispatch?.drafts?.[id]==='string'&&dispatch.submitted[id]===dispatch.drafts[id]&&inspectDispatch(dispatch.seed,id,dispatch.drafts[id]).ok);
 return {passed:checked.passed,next:checked.next,projects,bad};
}
