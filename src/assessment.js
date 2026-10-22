import { compile, run, LessonError } from './runner.js';
export function assess(source, goal) {
  const program = compile(source), result = run(source);
  // Count concepts that actually contribute to the displayed value. An unused
  // declaration or calculation must not satisfy the task by coincidence.
  const bindings=new Map(), outputConcepts=new Set();
  function concepts(node){
    const used=new Set([node.type]);
    if(node.type==='name'){
      used.add('bind');for(const item of bindings.get(node.name)||[])used.add(item);
    }else if(node.type==='add')for(const child of [node.left,node.right])for(const item of concepts(child))used.add(item);
    return used;
  }
  for(const node of program){const used=concepts(node.expr);if(node.type==='bind')bindings.set(node.name,used);else for(const item of used)outputConcepts.add(item);}
  const requirements=goal.require.map(concept=>({concept,passed:outputConcepts.has(concept)}));
  const outputCorrect=JSON.stringify(result.logs)===JSON.stringify(goal.logs);
  const conceptsCorrect=requirements.every(item=>item.passed);
  const outputMax=requirements.length?50:80;
  const matched=goal.logs.filter((value,index)=>value===result.logs[index]).length;
  const checks=[{id:'execution',points:20,max:20,status:'pass'},
    {id:'output',points:Math.floor(outputMax*matched/Math.max(goal.logs.length,result.logs.length,1)),
      max:outputMax,status:outputCorrect?'pass':'fail',expected:goal.logs,actual:result.logs}];
  if(requirements.length)checks.push({id:'concepts',points:Math.floor(30*requirements.filter(item=>item.passed).length/requirements.length),
    max:30,status:conceptsCorrect?'pass':'fail',requirements});
  const score=checks.reduce((sum,item)=>sum+item.points,0);
  return {ok:outputCorrect&&conceptsCorrect,code:!outputCorrect?'goalMismatch':!conceptsCorrect?'conceptMissing':null,
    result,score,checks};
}

// A grade describes this task only. Time, retries, variable spelling and matching
// the example text never affect points. Errors must not escape the report path.
export function grade(source,goal){
  try{return assess(source,goal);}
  catch(error){
    if(!(error instanceof LessonError))throw error;
    const checks=[{id:'execution',points:0,max:20,status:'fail'},
      {id:'output',points:0,max:goal.require.length?50:80,status:'blocked',expected:goal.logs,actual:null}];
    if(goal.require.length)checks.push({id:'concepts',points:0,max:30,status:'blocked',
      requirements:goal.require.map(concept=>({concept,passed:false}))});
    return {ok:false,score:0,result:null,code:error.code||'limit',position:error.position||0,checks};
  }
}
