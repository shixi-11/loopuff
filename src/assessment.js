import { compile, run } from './runner.js';
export function assess(source, goal) {
  const program = compile(source), result = run(source);
  if (JSON.stringify(result.logs) !== JSON.stringify(goal.logs)) return {ok:false, code:'goalMismatch', result};
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
  if (goal.require.some(concept => !outputConcepts.has(concept))) return {ok:false, code:'conceptMissing', result};
  return {ok:true, result};
}
