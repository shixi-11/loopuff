import test from 'node:test';
import assert from 'node:assert/strict';
import {mountSaves} from '../src/saves-ui.js';
import {emptySave} from '../server/save-format.mjs';
import {createMergePlan} from '../src/save-merge.js';
import {newHeist,startHeist,saveHeist} from '../src/heist.js';
import {heistStarter} from '../src/heist-strategies.js';
import catalog from '../public/locales/zh.json' with {type:'json'};
test('bank restore previews show resources, undeployed work and deployed strategy as one choice',async()=>{
 const descriptors=new Map(),globals={localStorage:{getItem:()=>null},location:{href:'http://127.0.0.1:8772/zh/saves/'},window:{addEventListener(){},removeEventListener(){}}};
 for(const [k,v]of Object.entries(globals)){descriptors.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{configurable:true,value:v});}
 const a=emptySave(),b=emptySave(),s=newHeist(1);startHeist(s,heistStarter);s.draft='7.log()';a.data.heist=saveHeist(s);b.data.heist=saveHeist(newHeist(2));
 const plan=createMergePlan(a,b);assert.equal(plan.conflicts.length,1);const root={innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},removeEventListener(){}};let page;
 try{page=mountSaves(root,{text:catalog.saves,heistText:catalog.heist,diagnosticText:catalog.diagnostic,pursuitText:catalog.pursuit,topics:{course:catalog.ui.navCourse,vault:catalog.vault.title,chase:catalog.chase.title,dispatch:catalog.dispatch.title,pursuit:catalog.pursuit.title,heist:catalog.heist.title},lessons:[],phases:{},account:{user:null},urls:{account:'/zh/account/'},locale:'zh',name:'环灵',model:{accountId:null,preview:{mode:'file',plan},choices:{}}});await new Promise(resolve=>setImmediate(resolve));
  for(const text of [catalog.heist.saveChoice,catalog.heist.deployed,catalog.heist.notDeployed,catalog.heist.energy,catalog.heist.alarm,catalog.heist.positionNow,'7.log()','return 4'])assert.ok(root.innerHTML.includes(text),text);assert.ok(!root.innerHTML.includes('undefined'));assert.match(root.innerHTML,/data-save-action="confirm" disabled/);
 }finally{page?.dispose();for(const [k,v]of descriptors){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k];}}
});
