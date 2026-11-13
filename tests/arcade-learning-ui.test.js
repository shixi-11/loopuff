import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mountArcadeLearning} from '../src/arcade-learning-ui.js';
import {arcadeLearningSteps,arcadeLearningIds} from '../src/arcade-learning.js';
const catalog=JSON.parse(readFileSync(new URL('../public/locales/zh.json',import.meta.url)));
function fixture(initialStep='run',save=()=>true){
 const descriptors=new Map(['document','requestAnimationFrame','cancelAnimationFrame','matchMedia'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 let serial=0;const queue=new Map(),context=new Proxy({},{get:(obj,key)=>obj[key]??(()=>{})});Object.assign(globalThis,{document:{hidden:false},matchMedia:()=>({matches:false}),requestAnimationFrame:callback=>{queue.set(++serial,callback);return serial;},cancelAnimationFrame:id=>queue.delete(id)});
 const nodes=new Map(),handlers={},root={innerHTML:'',addEventListener(k,v){handlers[k]=v;},removeEventListener(k){delete handlers[k];},querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',hidden:false,disabled:false,dataset:{},value:'',options:selector==='#arcade-lesson-step'?arcadeLearningIds.map(value=>({value,textContent:''})):[],setAttribute(){},focus(){},scrollIntoView(){},getContext:()=>context});return nodes.get(selector);}};
 const model={drafts:{'start-decide':'1.log()'}},view=mountArcadeLearning(root,{text:catalog.arcadeLearning,pathText:catalog.learningPaths,games:catalog.handheld.games,states:catalog.handheld,errors:catalog.ui,model,initialStep,urls:{guide:'/guide',advance:'/advance',play:'/play'},onChange:save,reduced:{matches:true}});
 return {root,model,edit(value){handlers.input({target:{id:'arcade-lesson-editor',value}});},run(){handlers.submit({target:{id:'arcade-lesson-form'},preventDefault(){}});},select(value){handlers.change({target:{id:'arcade-lesson-step',value}});},close(){view.dispose();for(const[key,descriptor]of descriptors)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}};
}
test('pause and finish remain distinct visible states, with actual movement and shot feedback',async()=>{
 const f=fixture('finish');try{f.run();await f.model.arcadeSavePromise;const result=f.root.querySelector('[data-arcade-lesson-result]').innerHTML;assert.ok(result.includes(catalog.handheld.paused));assert.equal(f.root.querySelector('[data-arcade-lesson-status]').dataset.passed,'false');
  f.edit('finish()');f.run();await f.model.arcadeSavePromise;assert.equal(f.root.querySelector('[data-arcade-lesson-status]').dataset.passed,'true');
  f.select('control');f.edit(arcadeLearningSteps.find(s=>s.id==='control').example);f.run();await f.model.arcadeSavePromise;assert.match(f.root.querySelector('[data-arcade-lesson-result]').innerHTML,/72 → 79 px/);
 }finally{f.close();}
});
test('syntax errors show the source position and a visible marked excerpt, not a dangling prompt',async()=>{
 const f=fixture('repair');try{f.run();await f.model.arcadeSavePromise;assert.match(f.root.querySelector('[data-arcade-lesson-status]').textContent,/\d+\./);const excerpt=f.root.querySelector('[data-arcade-lesson-error]');assert.equal(excerpt.hidden,false);assert.match(excerpt.innerHTML,/<mark>/);assert.match(excerpt.innerHTML,/7\.log\(/);
 }finally{f.close();}
});
test('last-step success offers real exits without falsely claiming every exercise is complete',async()=>{
 const f=fixture('strategy');try{f.edit(arcadeLearningSteps.at(-1).example);f.run();await f.model.arcadeSavePromise;assert.equal(f.root.querySelector('[data-arcade-lesson-complete]').hidden,false);assert.equal(f.root.querySelector('[data-arcade-lesson-all]').hidden,true);assert.equal(f.model.drafts['start-decide'],'1.log()');
  f.edit('drop()');assert.equal(f.root.querySelector('[data-arcade-lesson-complete]').hidden,true);assert.equal(f.model.drafts['arcade-strategy-checked'],undefined);
 }finally{f.close();}
});
test('failed persistence blocks continuation while retaining the submitted draft',async()=>{
 const f=fixture('run',()=>false);try{f.run();await f.model.arcadeSavePromise;assert.equal(f.root.querySelector('[data-arcade-lesson="next"]').disabled,true);assert.equal(f.root.querySelector('[data-arcade-lesson-save]').textContent,catalog.arcadeLearning.saveError);assert.equal(f.model.drafts['start-run-checked'],'7.log()');}finally{f.close();}
});
