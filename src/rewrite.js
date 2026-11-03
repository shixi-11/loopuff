import {course} from './course.js';
import {grade} from './assessment.js';

// These are intermediate tasks, not certificates or substitutes for transfer.
const goals={
 signal:{logs:['3','8'],require:[],example:'3.log(); 8.log()'},
 addition:{logs:['10','13'],require:['add'],dataRequire:['add'],example:'(4 + 6).log(); (8 + 5).log()'},
 names:{logs:['13','17'],require:['name','add'],dataRequire:['name','add'],example:'let cargo = 9; (cargo + 4).log(); (cargo + 8).log()'},
 leap:{logs:['9'],require:['add'],dataRequire:['add'],example:'(4 + 5).log()'},
 comparison:{logs:['false','true'],require:['compare'],dataRequire:['compare'],example:'(3 > 8).log(); (9 > 4).log()'},
 branch:{logs:['3'],require:['name','compare','if'],example:'let fuel = 8; if fuel > 4 then { 3.log() } else { 2.log() }'},
 repeat:{logs:['4','6','10'],require:['for','name','add'],dataRequire:['for','add'],example:'for dock in [3, 5, 9] { (dock + 1).log() }'},
 counter:{logs:['3','4','5'],require:['while','compare','name','add'],dataRequire:['name','add'],example:'let tick = 3; while tick < 6 { tick.log(); tick = tick + 1 }'},
 function:{logs:['9','13'],require:['call','name','add'],dataRequire:['call','add'],example:'sync fn combine(a, b) { return a + b }; combine(4, 5).log(); combine(6, 7).log()'},
 reply:{logs:['11','15'],require:['reply','call','name','add'],dataRequire:['reply','call','add'],example:'fn boost(load) { return ! (load + 3) }; boost(8).log(); boost(12).log()'},
 message:{logs:['14'],require:['send','receive','name','add'],dataRequire:['send','receive','add'],example:'let parcel; { parcel ! 10 | ?(value <- parcel) { (value + 4).log() } }'},
 join:{logs:['17'],require:['send','receive','join','name','add'],dataRequire:['send','receive','join','add'],example:'let west; let east; { west ! 8 | east ! 9 | ?(a <- west & b <- east) { (a + b).log() } }'},
 coordination:{logs:['20'],require:['send','receive','join','name','add','call','if','compare'],dataRequire:['send','receive','join','add','call'],example:'sync fn total(a, b) { return a + b }; let west; let east; { west ! 6 | east ! 9 | ?(a <- west & b <- east) { let load = total(a, b); if load > 12 then { (load + 5).log() } else { load.log() } } }'}
};
export function rewriteTask(id){
 const lesson=course.find(item=>item.id===id);if(!lesson)throw new RangeError('Unknown lesson');
 return {id,starter:lesson.remix.source,goal:goals[id]};
}
export function inspectRewrite(id,source){
 const goal=rewriteTask(id).goal,report=grade(source,{...goal,eachOutputRequire:goal.require.filter(key=>id!=='counter'||key!=='add')},{provenance:true});
 if(!report.ok)return report;
 if(['function','reply'].includes(id)){
  // Calls are recorded on completion. A cached pair of earlier calls cannot
  // stand in for a new call producing the second signal.
  const [first,second]=report.result.outputs.map(output=>new Map(report.result.calls.filter(call=>output.invocations.includes(call.invocation)&&call.kind===(id==='function'?'sync':'reply')).map(call=>[call.definition,call])));
  const reused=[...first.values()].some(a=>{const b=second.get(a.definition);return b&&a.invocation!==b.invocation&&JSON.stringify(a.args)!==JSON.stringify(b.args);});
  if(!reused)return {...report,ok:false,code:id==='function'?'syncRequired':'conceptMissing'};
 }
 return report;
}
export function beginRewrite(state,id,source=rewriteTask(id).starter){
 if(typeof state.rewriteDraft!=='string')state.rewriteDraft=source;
 state.phase='rewrite';
}
export const lessonDiagnostic=Object.freeze({signal:'names',addition:'names',names:'names',leap:'names',comparison:'branch',branch:'branch',repeat:'repeat',counter:'counter',function:'function',reply:'reply',message:'message',join:'join',coordination:'coordination'});
