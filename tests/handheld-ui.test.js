import test from 'node:test';
import assert from 'node:assert/strict';
import {mountHandheld} from '../src/handheld-ui.js';
import {newHandheld,applyHandheld,compileHandheld} from '../src/handheld.js';

// Only browser surfaces are mocked. The mounted UI, Tolang interpreter, command
// bridge and all three cartridge simulations are the production implementations.
function events(){
 const listeners=new Map();
 return {
  addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},
  removeEventListener(type,fn){listeners.get(type)?.delete(fn);},
  emit(type,event={}){event.type=type;event.preventDefault??=()=>{};for(const fn of [...(listeners.get(type)||[])])fn(event);},
  count(){return [...listeners.values()].reduce((n,set)=>n+set.size,0);}
 };
}
function fixture(game=2){
 const previous=new Map(['document','window','requestAnimationFrame','cancelAnimationFrame'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const documentMock={...events(),hidden:false},windowMock=events(),queue=new Map();let next=0,now=1000;
 const ctx=new Proxy({}, {get:(obj,key)=>obj[key]??(()=>{})});
 const nodes=new Map(),root={...events(),contains:()=>true,querySelector(selector){
  if(!nodes.has(selector))nodes.set(selector,{value:'',textContent:'',tagName:selector==='canvas'?'CANVAS':'DIV',setAttribute(){},insertAdjacentHTML(){},getContext:()=>ctx});
  return nodes.get(selector);
 }};
 documentMock.activeElement=root.querySelector('canvas');
 Object.assign(globalThis,{document:documentMock,window:windowMock,requestAnimationFrame:fn=>{queue.set(++next,fn);return next;},cancelAnimationFrame:id=>queue.delete(id)});
 const session=newHandheld(42);applyHandheld(session,[1001+game,2001]);
 const model={session,strategies:{flight:'right(); fire()',blocks:'right()',tanks:'right(); fire()'}};
 const text=new Proxy({games:['Blocks','Tanks','Flight'],help:['','',''],inputNotes:['','','']},{get:(o,k)=>o[k]??String(k)});
 const selections=[];const view=mountHandheld(root,{text,errors:{},model,onSelect:index=>selections.push(index)});
 const frame=(ms=20)=>{now+=ms;const callbacks=[...queue.values()];queue.clear();for(const fn of callbacks)fn(now);};
 const advance=ms=>{for(let elapsed=0;elapsed<ms;elapsed+=20)frame();};
 const machine=action=>root.emit('click',{target:{closest:()=>({dataset:{machine:action}})}});
 const submit=source=>{root.querySelector('#handheld-editor').value=source;root.emit('input',{target:{id:'handheld-editor',value:source}});root.emit('submit',{target:{id:'handheld-form'}});};
 return {root,session,model,selections,queue,documentMock,windowMock,view,frame,advance,machine,submit,
  key(key,type='keydown'){documentMock.emit(type,{key,target:documentMock.activeElement});},
  pad(pad){root.emit('pointerdown',{pointerId:1,target:{closest:()=>({dataset:{pad},setPointerCapture(){}})}});},
  close(){view.dispose();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
 };
}

test('keyboard and pointer each take over from the real automatic strategy',()=>{
 for(const mode of ['keyboard','pointer']){
  const f=fixture();try{
   f.machine('auto');f.advance(80);assert.equal(f.session.automatic,true);const x=f.session.world.player.x;
   if(mode==='keyboard')f.key('ArrowLeft');else f.pad('left');
   assert.equal(f.session.automatic,false,mode+' must disable automatic control');f.advance(80);
   assert.ok(f.session.world.player.x<x,mode+' must move left rather than cancel against the old right strategy');
  }finally{f.close();}
 }
});

test('visibility loss and window blur discard queued starts and freeze active time',()=>{
 for(const mode of ['hidden','blur']){
  const f=fixture();try{
   f.submit('left(); right(); start(); fire()');f.advance(40);
   if(mode==='hidden'){f.documentMock.hidden=true;f.documentMock.emit('visibilitychange');}else f.windowMock.emit('blur');
   const before=JSON.stringify(f.session.world),time=f.session.activeMs;
   f.advance(200);f.documentMock.hidden=false;f.documentMock.emit('visibilitychange');f.advance(700);
   assert.equal(f.session.status,'paused',mode);assert.equal(f.session.activeMs,time,mode);assert.equal(JSON.stringify(f.session.world),before,mode);
   f.machine('start');f.advance(80);assert.equal(f.session.status,'running');assert.ok(f.session.activeMs>time);
  }finally{f.close();}
 }
});

test('pause and finish followed by start never reuse an old code movement pulse',()=>{
 for(const action of ['pause','finish']){
  const f=fixture();try{
   f.submit('left()');f.advance(40);assert.ok(f.session.world.player.x<160);
   f.machine(action);f.machine('start');const x=f.session.world.player.x;f.advance(80);
   assert.equal(f.session.world.player.x,x,action+' must clear the previous left pulse');
  }finally{f.close();}
 }
});

test('repeated left calls are executed separately and preserve code order',()=>{
 const f=fixture(0);try{
  const x=f.session.world.piece.x;f.submit('left(); left(); right()');f.frame();
  assert.equal(f.session.world.piece.x,x-1);f.advance(120);assert.equal(f.session.world.piece.x,x-2);
  f.advance(140);assert.equal(f.session.world.piece.x,x-1,'right follows both left calls');
 }finally{f.close();}
});

test('an invalid tail rejects the entire batch without selecting or changing a world',()=>{
 for(const source of ['choose(1); start(); left(); 999.log()','choose(1); start(); choose(1001)','choose(1); start(); fire()','choose(1); start(); let invalid = ;']){
  const f=fixture();try{
   const before=JSON.stringify(f.session.world),seed=f.session.seed,selected=f.session.selected;
   f.submit(source);f.advance(500);assert.equal(JSON.stringify(f.session.world),before,source);assert.equal(f.session.seed,seed);assert.equal(f.session.selected,selected);assert.equal(f.session.status,'paused');
  }finally{f.close();}
 }
});

test('dispose cancels RAF, removes every listener and prevents further execution',()=>{
 const f=fixture();try{
  f.machine('auto');f.advance(40);f.submit('left(); start(); right()');f.view.dispose();
  const snapshot=JSON.stringify(f.session);assert.equal(f.queue.size,0);assert.equal(f.root.count(),0);assert.equal(f.documentMock.count(),0);assert.equal(f.windowMock.count(),0);
  f.advance(500);f.key('ArrowRight');f.windowMock.emit('blur');assert.equal(JSON.stringify(f.session),snapshot);assert.equal(f.session.status,'paused');
 }finally{f.close();}
});

test('keyup releases a held direction after focus moves into the code editor',()=>{
 const f=fixture();try{
  f.advance(20);f.key('ArrowLeft');f.advance(60);assert.ok(f.session.world.player.x<160);
  f.documentMock.activeElement={tagName:'TEXTAREA'};f.key('ArrowLeft','keyup');
  const x=f.session.world.player.x;f.advance(200);assert.equal(f.session.world.player.x,x,'typing focus must not leave the old direction held');
 }finally{f.close();}
});

test('a pointer tap released before the next frame still delivers exactly one action',()=>{
 for(const release of ['pointerup','lostpointercapture']){
  const f=fixture(0);try{
   f.advance(20);const x=f.session.world.piece.x;
   f.pad('left');f.root.emit(release);f.frame();assert.equal(f.session.world.piece.x,x-1,release+' must preserve the queued tap');
   f.advance(300);assert.equal(f.session.world.piece.x,x-1,release+' must release held repeats');
  }finally{f.close();}
 }
});

test('keyboard activation of physical A and B delivers rotate and hard drop once',()=>{
 const f=fixture(0);try{
  f.advance(20);const rotation=f.session.world.piece.rotation,pieces=f.session.world.pieces;
  const activate=pad=>f.root.emit('click',{detail:0,target:{closest:selector=>selector==='[data-pad]'?{dataset:{pad}}:null}});
  activate('a');f.frame();assert.equal(f.session.world.piece.rotation,(rotation+1)%4);
  f.advance(140);assert.equal(f.session.world.piece.rotation,(rotation+1)%4,'keyboard click is not a held button');
  activate('b');f.frame();assert.equal(f.session.world.pieces,pieces+1);f.advance(140);assert.equal(f.session.world.pieces,pieces+1);
 }finally{f.close();}
});

test('observations are available to strategies without being injected into console programs',()=>{
 const session=newHandheld(42);applyHandheld(session,[1003,2001]);
 const strategy='if x > 0 then { right() } else { left() }';
 assert.deepEqual(compileHandheld(strategy,session,{strategy:true}).commands,[2]);
 assert.throws(()=>compileHandheld(strategy,session),error=>error.code==='name');
 assert.deepEqual(compileHandheld('choose(3); start(); left(); left(); fire()',session).commands,[1003,2001,1,1,5]);
});

test('dropdown and Tolang cartridge changes notify the route without rewriting the initial deep link',()=>{
 const f=fixture();try{
  assert.deepEqual(f.selections,[]);
  f.root.emit('change',{target:{id:'handheld-game',value:'1'}});assert.equal(f.session.selected,1);assert.deepEqual(f.selections,[1]);
  f.submit('choose(3); start();');f.advance(500);assert.equal(f.session.selected,2);assert.deepEqual(f.selections,[1,2]);
 }finally{f.close();}
});
