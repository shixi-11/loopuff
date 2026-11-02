import { grade } from './assessment.js';

// Original dispatch puzzles. Inputs are game data, not new language features.
export const dispatchIds=['branch','manifest','fuel','relay'];
export const dispatchSourceLimit=3000;
const hasId=id=>dispatchIds.includes(id);
const list=values=>'['+values.join(', ')+']';
const makeCase=(inputs,logs)=>({inputs,logs:logs.map(String),prefix:Object.entries(inputs).map(([name,value])=>`let ${name} = ${Array.isArray(value)?list(value):value};`).join('\n')+'\n'});
export function dispatchPuzzle(seed,id){
 if(!hasId(id))throw Error('Unknown dispatch mission');
 let state=(seed>>>0)^Math.imul(dispatchIds.indexOf(id)+1,2654435761);
 const roll=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;};
 const threshold=3+roll()%4,reserve=2+roll()%4,offset=1+roll()%3;
 let cases,require,dataRequire,starter,example;
 if(id==='branch'){
  cases=Array.from({length:10},(_,cargo)=>makeCase({cargo,threshold},[cargo<threshold?1:2]));
  require=['if','compare','name'];dataRequire=[];
  starter='if cargo < threshold then {\n  1.log()\n} else {\n  1.log()\n}';
  example='if cargo < threshold then { 1.log() } else { 2.log() }';
 }else if(id==='manifest'){
  const routes=[[],[0],[1,3],[4,2,4],[3,0,2,1]];
  for(let i=0;i<5;i++)routes.push(Array.from({length:1+roll()%5},()=>roll()%6));
  cases=routes.map(docks=>makeCase({docks,offset},docks.map(dock=>dock+offset)));
  require=['for','name','add'];dataRequire=['for','add'];
  starter='for dock in docks {\n  dock.log()\n}';
  example='for destination in docks { (destination + offset).log() }';
 }else if(id==='fuel'){
  cases=[];
  for(let cargo=0;cargo<10;cargo++)for(let i=0;i<4;i++){
   const amount=2+(reserve-2+i)%4,sample=makeCase({cargo,reserve:amount},[cargo+amount]);
   sample.prefix='';sample.suffix=`\nfuel(${cargo}, ${amount}).log()`;sample.inputCode=`fuel(${cargo}, ${amount})`;
   cases.push(sample);
  }
  require=['call','name','add'];dataRequire=['call','add'];
  starter='sync fn fuel(cargo, reserve) {\n  return cargo\n}';
  example='sync fn fuel(load, extra) { return load + extra }';
 }else{
  cases=[];
  for(let westLoad=0;westLoad<7;westLoad++)for(let eastLoad=0;eastLoad<7;eastLoad++){
   const total=westLoad+eastLoad;
   const sample=makeCase({westLoad,eastLoad,threshold,reserve},[total>threshold?total+reserve:total]);
   sample.prefix=`let threshold = ${threshold};\nlet reserve = ${reserve};\nlet west; let east;\n{ west ! ${westLoad} | east ! ${eastLoad} | {\n`;
   sample.suffix='\n} }';sample.inputCode=`let threshold = ${threshold};\nlet reserve = ${reserve};\nwest ! ${westLoad};\neast ! ${eastLoad}`;
   cases.push(sample);
  }
  require=['receive','join','call','if','compare','add'];dataRequire=['receive','join','call','add'];
  starter='';
  example='sync fn total(a,b) { return a+b };\n?(a <- west & b <- east) {\n  let load = total(a,b);\n  if load > threshold then { (load + reserve).log() } else { load.log() }\n}';
 }
 return {id,cases,require,dataRequire,starter,example,parameters:{threshold,reserve,offset}};
}

export function inspectDispatch(seed,id,source){
 const puzzle=dispatchPuzzle(seed,id);
 if(typeof source!=='string'||source.length>dispatchSourceLimit)return {ok:false,passed:0,total:puzzle.cases.length,cases:[],code:'limit'};
 const cases=puzzle.cases.map(sample=>{
  // An empty manifest must emit nothing; method evidence comes from the other batches.
  const fullSource=sample.prefix+source+(sample.suffix||'');
  const report=grade(fullSource,{logs:sample.logs,require:sample.logs.length?puzzle.require:[],dataRequire:puzzle.dataRequire});
  const position=Math.max(0,(report.position||0)-sample.prefix.length);
  return {...report,position,inputs:sample.inputs,expected:sample.logs,
   outputs:report.result?.outputs.map(output=>{
    const fromPlayer=output.start>=sample.prefix.length&&output.end<=sample.prefix.length+source.length;
    return {...output,source:fullSource.slice(output.start,output.end),start:fromPlayer?output.start-sample.prefix.length:null,end:fromPlayer?output.end-sample.prefix.length:null};
   })||[]};
 });
 return {ok:cases.every(report=>report.ok),passed:cases.filter(report=>report.ok).length,total:cases.length,cases,code:cases.find(report=>!report.ok)?.code||null};
}

export function newDispatch(seed){
 return {version:1,seed:seed>>>0,selected:dispatchIds[0],drafts:Object.fromEntries(dispatchIds.map(id=>[id,dispatchPuzzle(seed,id).starter])),
  submitted:Object.fromEntries(dispatchIds.map(id=>[id,null])),cleared:[],stamps:[],rounds:0,awarded:false};
}
export function restoreDispatch(value,seed){
 const state=newDispatch(seed);
 if(!value||value.version!==1||!Number.isInteger(value.seed)||value.seed<0||value.seed>0xffffffff)return state;
 state.seed=value.seed;
 if(hasId(value.selected))state.selected=value.selected;
 for(const id of dispatchIds){
  const draft=value.drafts?.[id];
  state.drafts[id]=typeof draft==='string'?draft.slice(0,dispatchSourceLimit):dispatchPuzzle(state.seed,id).starter;
  if(typeof value.submitted?.[id]==='string'&&value.submitted[id]===state.drafts[id])state.submitted[id]=value.submitted[id];
 }
 const ids=items=>[...new Set(Array.isArray(items)?items.filter(hasId):[])];
 state.cleared=ids(value.cleared);state.stamps=ids(value.stamps);
 state.rounds=Number.isInteger(value.rounds)?Math.max(0,Math.min(999999,value.rounds)):0;
 state.awarded=state.cleared.length===dispatchIds.length;
 if(state.awarded)state.rounds=Math.max(1,state.rounds);
 return state;
}
export function editDispatch(state,id,source){
 if(!hasId(id))throw Error('Unknown dispatch mission');
 state.drafts[id]=String(source).slice(0,dispatchSourceLimit);state.submitted[id]=null;
}
export function submitDispatch(state,id,source){
 if(!hasId(id))throw Error('Unknown dispatch mission');
 if(typeof source!=='string'||source.length>dispatchSourceLimit)return inspectDispatch(state.seed,id,source);
 editDispatch(state,id,source);
 const report=inspectDispatch(state.seed,id,state.drafts[id]);state.submitted[id]=state.drafts[id];
 if(report.ok){
  if(!state.cleared.includes(id))state.cleared.push(id);
  if(!state.stamps.includes(id))state.stamps.push(id);
  if(state.cleared.length===dispatchIds.length&&!state.awarded){state.rounds=Math.min(999999,state.rounds+1);state.awarded=true;}
 }
 return report;
}
export function nextDispatchRound(state,seed){
 // Change the low bits too: threshold generation must not repeat the same round parameters.
 const candidate=seed>>>0,nextSeed=(candidate&3)===(state.seed&3)?(candidate^1)>>>0:candidate;
 const next=newDispatch(nextSeed);
 next.selected=state.selected;next.drafts={...state.drafts};next.stamps=[...state.stamps];next.rounds=state.rounds;
 return next;
}
