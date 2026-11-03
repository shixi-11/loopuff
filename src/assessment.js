import { run, LessonError } from './runner.js';
export function assess(source,goal,options){return assessProgram(source,goal,options,false);}
export function assessTask(source,goal,options){return assessProgram(source,goal,options,true);}
function assessProgram(source, goal, options, requireCompletion) {
  const result = run(source,options);
  // Count concepts that actually contribute to the displayed value. An unused
  // declaration or calculation must not satisfy the task by coincidence.
  const outputConcepts=new Set(result.outputs.flatMap(output=>output.concepts));
  const dataConcepts=new Set(result.outputs.flatMap(output=>output.dataConcepts));
  const requirements=goal.require.map(concept=>({concept,passed:goal.eachOutputRequire?.includes(concept)?result.outputs.length>0&&result.outputs.every(output=>(goal.dataRequire?.includes(concept)?output.dataConcepts:output.concepts).includes(concept)):(goal.dataRequire?.includes(concept)?dataConcepts:outputConcepts).has(concept)}));
  const outputCorrect=JSON.stringify(result.logs)===JSON.stringify(goal.logs),finished=!requireCompletion||result.waiting===0;
  const conceptsCorrect=requirements.every(item=>item.passed);
  const outputMax=requirements.length?50:80;
  const matched=goal.logs.filter((value,index)=>value===result.logs[index]).length;
  // Waiting is valid language behaviour, but these finite tasks are not done.
  // Keep the observed output and method points without awarding completion.
  const checks=[{id:'execution',points:finished?20:0,max:20,status:finished?'pass':'fail'},
    {id:'output',points:outputCorrect?outputMax:Math.floor(outputMax*matched/Math.max(goal.logs.length,result.logs.length,1)),
      max:outputMax,status:outputCorrect?'pass':'fail',expected:goal.logs,actual:result.logs}];
  if(requirements.length)checks.push({id:'concepts',points:Math.floor(30*requirements.filter(item=>item.passed).length/requirements.length),
    max:30,status:conceptsCorrect?'pass':'fail',requirements});
  const score=checks.reduce((sum,item)=>sum+item.points,0);
  return {ok:finished&&outputCorrect&&conceptsCorrect,code:!finished?'waiting':!outputCorrect?'goalMismatch':!conceptsCorrect?'conceptMissing':null,
    result,score,checks};
}

// Observing output/concepts permits valid waiting language states. Finite user
// tasks additionally require completion, without changing interpreter semantics.
// Time, retries, spelling and matching the example never affect points.
export function grade(source,goal,options){return gradeWith(assess,source,goal,options);}
export function gradeTask(source,goal,options){return gradeWith(assessTask,source,goal,options);}
function gradeWith(check,source,goal,options){
  try{return check(source,goal,options);}
  catch(error){
    if(!(error instanceof LessonError))throw error;
    const checks=[{id:'execution',points:0,max:20,status:'fail'},
      {id:'output',points:0,max:goal.require.length?50:80,status:'blocked',expected:goal.logs,actual:null}];
    if(goal.require.length)checks.push({id:'concepts',points:0,max:30,status:'blocked',
      requirements:goal.require.map(concept=>({concept,passed:false}))});
    return {ok:false,score:0,result:null,code:error.code||'limit',position:error.position||0,checks};
  }
}
