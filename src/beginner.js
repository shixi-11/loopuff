// Explanations describe the existing programs; they never mark a lesson complete.
export function beginnerConcept(text,id){
 if(!Object.hasOwn(text.concepts,id))throw Error('Unknown beginner concept');
 return text.concepts[id];
}
export function guideFirstStep(text,station,report){
 if(!report?.ok)return text.first;
 if(station.id==='signal'&&report.source!==station.source&&report.result.logs.length)
  return text.result.replace('{value}',report.result.logs.join(' → '));
 return text.change;
}
export function vaultFirstStep(text,puzzle,source=puzzle.starter){
 if(puzzle.stage<2&&source!==puzzle.starter)return text.vaultSteps[2];
 const values={a:puzzle.a,b:puzzle.b,sum:puzzle.a+puzzle.b,total:puzzle.a+puzzle.b+puzzle.c};
 return text[['vaultFirst','vaultNames','vaultOrder'][puzzle.stage]].replace(/\{(a|b|sum|total)\}/g,(_,key)=>values[key]);
}
