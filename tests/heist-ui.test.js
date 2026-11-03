import test from 'node:test';
// Read-only UI review evidence. Uses current production modules with an in-memory
// DOM, storage and scene; never opens a browser or writes a production save.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {newHeist,startHeist,advanceHeist,pauseHeist} from '../src/heist.js';
import {heistStarter} from '../src/heist-strategies.js';
import {createHeistSession} from '../src/heist-session.js';

test('restored runs keep background and slow-frame pauses distinct from code errors, and new runs restore focus',async()=>{
const uiUrl=new URL('../src/heist-ui.js',import.meta.url);
let source=await readFile(uiUrl,'utf8');
assert.ok(source.includes("import {mountHeistScene} from './heist-scene.js';"));
source=source.replace("import {mountHeistScene} from './heist-scene.js';",
 'const mountHeistScene=()=>({ready:Promise.resolve(true),draw(){},resize(){},dispose(){}});');
source=source.replace(/from '(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL(path,uiUrl).href));
const {mountHeist}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const catalog=JSON.parse(await readFile(new URL('../public/locales/en.json',import.meta.url),'utf8'));
const bytes=new Map(),storage={getItem:key=>bytes.get(key)??null,setItem:(key,value)=>bytes.set(key,String(value))};
const createWorld=(seed=1,mode='practice',draft=heistStarter)=>{const world=newHeist(seed,mode);world.draft=draft;return world;};
const session=createHeistSession({storage,access:{write:async operation=>operation()},createWorld});
const restored=session.world;startHeist(restored,heistStarter);advanceHeist(restored,200);pauseHeist(restored);restored.lastReport=null;

const savedGlobals=new Map(),windowHandlers={},documentHandlers={};
const replaceGlobal=(key,value)=>{savedGlobals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});};
let tick,active=null;
replaceGlobal('document',{hidden:false,hasFocus:()=>true,addEventListener:(key,value)=>documentHandlers[key]=value,removeEventListener:key=>delete documentHandlers[key]});
replaceGlobal('window',{addEventListener:(key,value)=>windowHandlers[key]=value,removeEventListener:key=>delete windowHandlers[key]});
replaceGlobal('requestAnimationFrame',callback=>(tick=callback,1));
replaceGlobal('cancelAnimationFrame',()=>{});
const handlers={},nodes=new Map();
const root={innerHTML:'',querySelector(selector){
 if(!nodes.has(selector)){
  const classes=new Set(),action=selector.match(/data-heist="([^"]+)"/)?.[1];
  const node={textContent:'',innerHTML:'',value:selector==='[data-heist-seed]'?'1':selector==='[data-heist-mode]'?'practice':'',hidden:false,open:false,dataset:{heist:action},
   classList:{contains:name=>classes.has(name),toggle(name){if(classes.has(name)){classes.delete(name);return false;}classes.add(name);return true;}},
   focus(){if(!node.disabled)active=node;},click(){handlers.click({target:{closest:()=>node}});},addEventListener(){},removeEventListener(){}};
  nodes.set(selector,node);
 }
 return nodes.get(selector);
},addEventListener:(key,value)=>handlers[key]=value,removeEventListener:key=>delete handlers[key]};
let page;
try{
 page=mountHeist(root,{text:catalog.heist,errors:catalog.ui,model:{session},saveUrl:'/en/saves/',saveLabel:'Backups'});
 await Promise.resolve();
 root.querySelector('[data-heist="start"]').click();
 assert.equal(restored.lastReport,null,'resuming unchanged code does not manufacture a report');
 tick(0);tick(400);
 assert.equal(restored.status,'paused');assert.equal(restored.activeMs,200);
 assert.equal(root.querySelector('[data-heist-status]').textContent,catalog.heist.slow);
 root.querySelector('[data-heist="start"]').click();tick(1000);tick(1100);
 document.hidden=true;documentHandlers.visibilitychange();
 assert.equal(root.querySelector('[data-heist-status]').textContent,catalog.heist.background);
 assert.equal(restored.status,'paused');document.hidden=false;
 const oldId=restored.id;
 root.querySelector('.heist-settings').open=true;
 root.querySelector('[data-heist="new"]').click();root.querySelector('[data-heist="new"]').click();
 assert.equal(root.querySelector('.heist-settings').open,false);
 assert.equal(active,root.querySelector('[data-heist="start"]'));
 assert.equal(session.world.activeMs,0);assert.notEqual(session.world.id,oldId);
 await session.persist();
 console.log(JSON.stringify({longFrameKeepsSlowNotice:true,hiddenKeepsBackgroundNotice:true,noPausedTimeAccrual:true,newRunFocus:'start',sameSeedHasDistinctRunId:true}));
}finally{
 page?.dispose();await session.persist();
 for(const [key,descriptor]of savedGlobals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
}

});
