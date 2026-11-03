// Describe the selected observed batch, not the learner's ability or saved awards.
export function dispatchFeedback(puzzle,report){
 if(!report)return null;
 if(!report.result)return {kind:'error',code:report.code==='name'?'nameError':report.code};
 if(report.result.waiting)return {kind:'waiting'};
 if(report.ok)return {kind:'passed'};
 const actual=report.result.logs,expected=report.expected;
 const mismatch=Array.from({length:Math.max(actual.length,expected.length)},(_,i)=>i).find(i=>actual[i]!==expected[i]);
 if(mismatch!==undefined){
  const kind=puzzle.id==='branch'&&report.inputs.cargo===report.inputs.threshold?'boundary':puzzle.id==='manifest'&&!expected.length?'empty':'output';
  return {kind,outputIndex:mismatch};
 }
 const missing=report.checks.find(check=>check.id==='concepts')?.requirements.filter(item=>!item.passed).map(item=>item.concept)||[];
 const outputIndex=report.result.outputs.findIndex(output=>missing.some(concept=>!(puzzle.dataRequire.includes(concept)?output.dataConcepts:output.concepts).includes(concept)));
 return {kind:'contribution',...(outputIndex>=0?{outputIndex}:{})};
}
