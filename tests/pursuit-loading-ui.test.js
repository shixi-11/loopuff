import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {newPursuit} from '../src/pursuit.js';
test('failed street loading offers an in-place retry and preserves the complete chase',async t=>{
 const uiUrl=new URL('../src/pursuit-ui.js',import.meta.url);let source=await readFile(uiUrl,'utf8');
 source=source.replace("import {mountPursuitScene} from './pursuit-scene.js';",'export const sceneAttempts=[]; const mountPursuitScene=()=>{const scene={ready:Promise.resolve(sceneAttempts.length>0),dispose(){this.disposed=true;},draw(){},resize(){}};sceneAttempts.push(scene);return scene;};');
 source=source.replace("import {mountPursuitPractice} from './pursuit-practice-ui.js';",'const mountPursuitPractice=()=>({dispose(){},refresh(){}});');
 source=source.replace(/from '(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL(path,uiUrl).href));
 const {mountPursuit,sceneAttempts}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const catalog=JSON.parse(await readFile(new URL('../public/locales/zh.json',import.meta.url),'utf8')),globals=new Map();
 const set=(key,value)=>{globals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});};
 t.after(()=>{for(const [key,value]of globals){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}});
 set('document',{hidden:false,hasFocus:()=>true,addEventListener(){},removeEventListener(){}});set('window',{addEventListener(){},removeEventListener(){}});set('requestAnimationFrame',()=>1);set('cancelAnimationFrame',()=>{});
 const nodes=new Map(),handlers={},root={innerHTML:'',querySelectorAll:()=>[],querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{value:'',textContent:'',hidden:false,disabled:false,innerHTML:'',classList:{contains:()=>false},focus(){},addEventListener(){},removeEventListener(){}});return nodes.get(selector);},addEventListener:(name,fn)=>handlers[name]=fn,removeEventListener:name=>delete handlers[name]};
 const world=newPursuit(3,'thief','standard','loading-test');world.draft='2.log()';let replacements=0;
 const session={world,history:[],badSave:false,saveFailed:false,subscribe:()=>()=>{},persist:async()=>true,replace(){replacements++;throw Error('Retry must not create a new chase');}};
 const initial=JSON.stringify(world),page=mountPursuit(root,{text:catalog.pursuit,practiceText:catalog.pursuitPractice,roles:catalog.chase,errors:catalog.ui,reduced:{matches:true},saveUrl:'/zh/saves/',saveLabel:'备份',model:{session}});
 try{
  assert.equal(root.querySelector('[data-pursuit-status]').textContent,catalog.pursuit.loading);
  await Promise.resolve();assert.equal(root.querySelector('[data-pursuit="start"]').textContent,catalog.chase.retryArt);assert.equal(root.querySelector('[data-pursuit="start"]').disabled,false);
  handlers.click({target:{closest:()=>({dataset:{pursuit:'start'}})}});await Promise.resolve();
  assert.equal(sceneAttempts.length,2);assert.equal(sceneAttempts[0].disposed,true);assert.equal(root.querySelector('[data-pursuit-loading]').hidden,true);
  assert.equal(JSON.stringify(world),initial);assert.equal(replacements,0);
 }finally{page.dispose();}
});
