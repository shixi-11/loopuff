const priorities={names:['name','add'],branch:['compare','if','name'],repeat:['for','add','name'],counter:['while','compare','add','name'],function:['call','add','name'],reply:['reply','call','add','name'],message:['receive','add','name'],join:['join','receive','add','name'],coordination:['join','receive','call','if','compare','add','name']};
const lessons={name:'names',add:'addition',compare:'comparison',if:'branch',for:'repeat',while:'counter',call:'function',reply:'reply',receive:'message',join:'join',send:'message'};
// A suggestion about this executed program, never a claim about its author.
export function diagnosticFeedback(area,report,source=''){
 if(!Object.hasOwn(priorities,area))throw new RangeError('Unknown diagnostic area');
 const base={lesson:area,reason:'untried',caseIndex:null,concept:null};
 if(!report)return base;
 if(report.ok)return {...base,reason:'passed'};
 const index=report.cases.findIndex(item=>!item.ok),failed=report.cases[index];
 const result={...base,caseIndex:index>=0?index:null,reason:'execution'};
 if(!source.trim())return {...result,lesson:area==='names'?'signal':area,reason:'empty'};
 if(!failed)return result;
 if(failed.code==='waiting'||failed.result?.waiting)return {...result,reason:'waiting'};
 if(['syncRequired','replyRequired'].includes(failed.code))return {...result,reason:'mechanism'};
 if(!failed.result){
  if(failed.code==='name')return {...result,reason:['function','reply'].includes(area)&&failed.position>=source.length?'entry':'name'};
  return result;
 }
 if(failed.expected.length&&failed.result.logs.length===0)return {...result,lesson:'signal',reason:'empty'};
 const check=failed.checks.find(item=>item.id==='concepts');
 const missing=check?.status!=='blocked'?check?.requirements.filter(item=>!item.passed).map(item=>item.concept)||[]:[];
 const concept=priorities[area].find(key=>missing.includes(key));
 if(concept)return {...result,lesson:lessons[concept],reason:'concept',concept};
 if(area==='branch'&&failed.inputs.fuel===failed.inputs.threshold)return {...result,lesson:'comparison',reason:'boundary'};
 if(area==='counter'&&failed.inputs.limit===0)return {...result,reason:'zero'};
 if(area==='repeat'&&failed.inputs.docks?.length===0)return {...result,reason:'emptyList'};
 return {...result,reason:'output'};
}
