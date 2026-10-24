// Course work is local to each lesson. Rewards describe exploration, not grades.
const phases=['brief','typing','predict','output','explain','remix','independent','result','complete'];
export function rememberLesson(state,id,phase=state.phase==='pause'?state.previousPhase:state.phase){
  if(!phases.includes(phase))return;
  if(!state.lessonWork||typeof state.lessonWork!=='object'||Array.isArray(state.lessonWork))state.lessonWork={};
  state.lessonWork[id]={phase,fragment:state.fragment,typed:state.typed,draft:state.draft,
    assessedSource:state.assessedSource,score:state.score,errors:state.errors,keys:state.keys};
}
export function lessonWork(state,id){
  const work=state.lessonWork?.[id];
  if(!work||!phases.includes(work.phase))return null;
  const text=value=>typeof value==='string'?value.slice(0,4096):'';
  const draft=text(work.draft);
  return {phase:work.phase,fragment:Number.isInteger(work.fragment)?Math.max(0,work.fragment):0,
    typed:text(work.typed),draft,assessedSource:typeof work.assessedSource==='string'&&work.assessedSource===draft?draft:null,
    score:Number.isFinite(work.score)?Math.max(0,work.score):0,
    errors:Number.isFinite(work.errors)?Math.max(0,work.errors):0,
    keys:Number.isFinite(work.keys)?Math.max(0,work.keys):0};
}
export function explorationProgress(state,vault,ids){
  const completed=[...new Set((state.completed||[]).filter(id=>ids.includes(id)))];
  const stamps=[...new Set((vault.stamps||[]).filter(n=>Number.isInteger(n)&&n>=0&&n<3))];
  return {completed:completed.length,stamps:stamps.length,points:completed.length*100+stamps.length*50,
    next:ids.findIndex(id=>!completed.includes(id))};
}
