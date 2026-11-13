import test from 'node:test';
import assert from 'node:assert/strict';
import {mountHandheld} from '../src/handheld-ui.js';
import {cartridges,newHandheld,applyHandheld,compileHandheld} from '../src/handheld.js';

// Only browser surfaces are mocked. The mounted UI, Tolang interpreter, command
// bridge and all six cartridge simulations are the production implementations.
function events(){
 const listeners=new Map();
 return {
  addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},
  removeEventListener(type,fn){listeners.get(type)?.delete(fn);},
  emit(type,event={}){event.type=type;event.preventDefault??=()=>{};for(const fn of [...(listeners.get(type)||[])])fn(event);},
  count(){return [...listeners.values()].reduce((n,set)=>n+set.size,0);}
 };
}
function fixture(game=2,existingModel=null){
 const previous=new Map(['document','window','requestAnimationFrame','cancelAnimationFrame'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const documentMock={...events(),hidden:false},windowMock=events(),queue=new Map();let next=0,now=1000;
 const ctx=new Proxy({}, {get:(obj,key)=>obj[key]??(()=>{})});
 const pads=['up','right','down','left','a','b'].map(pad=>({dataset:{pad},disabled:false}));
 const nodes=new Map(),root={...events(),contains:()=>true,querySelectorAll(selector){assert.equal(selector,'[data-pad]');return pads;},querySelector(selector){
  if(!nodes.has(selector))nodes.set(selector,{value:'',textContent:'',tagName:selector==='canvas'?'CANVAS':'DIV',setAttribute(){},insertAdjacentHTML(){},getContext:()=>ctx});
  return nodes.get(selector);
 }};
 documentMock.activeElement=root.querySelector('canvas');
 Object.assign(globalThis,{document:documentMock,window:windowMock,requestAnimationFrame:fn=>{queue.set(++next,fn);return next;},cancelAnimationFrame:id=>queue.delete(id)});
 const session=existingModel?.session??newHandheld(42);if(!existingModel)applyHandheld(session,[1001+game,2001]);
 const model=existingModel??{session,strategies:{flight:'right(); fire()',blocks:'right()',tanks:'right(); fire()'}};
 const text=new Proxy({games:['Blocks','Tanks','Flight','Snake','Breakout','Sokoban'],help:Array(6).fill(''),inputNotes:Array(6).fill('')},{get:(o,k)=>o[k]??String(k)});
 const selections=[],steps=[];let resets=0,ends=0;const view=mountHandheld(root,{text,errors:{},model,onSelect:index=>selections.push(index),onStep:(dt,actions)=>steps.push({dt,actions:[...actions],activeMs:session.activeMs}),onReset:()=>resets++,onEnd:()=>ends++});
 const frame=(ms=20)=>{now+=ms;const callbacks=[...queue.values()];queue.clear();for(const fn of callbacks)fn(now);};
 const advance=ms=>{for(let elapsed=0;elapsed<ms;elapsed+=20)frame();};
 const machine=action=>root.emit('click',{target:{closest:()=>({dataset:{machine:action}})}});
 const submit=source=>{root.querySelector('#handheld-editor').value=source;root.emit('input',{target:{id:'handheld-editor',value:source}});root.emit('submit',{target:{id:'handheld-form'}});};
 return {root,session,model,selections,pads,steps,get resets(){return resets;},get ends(){return ends;},queue,documentMock,windowMock,view,frame,advance,machine,submit,
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
  f.frame();const x=f.session.world.piece.x;f.submit('left(); left(); right()');f.frame();
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

test('all six cartridges can be selected and physical buttons match each actual command set',()=>{
 const f=fixture();try{
  assert.equal((f.root.innerHTML.match(/<option /g)||[]).length,6);
  for(let index=0;index<cartridges.length;index++){
   f.view.select(index);
   assert.equal(f.session.selected,index);
   assert.equal(f.session.status,'ready');
   assert.equal(f.root.querySelector('[data-game-name]').textContent,['Blocks','Tanks','Flight','Snake','Breakout','Sokoban'][index]);
   assert.equal(f.root.querySelector('[data-motion-commands]').textContent,cartridges[index].commands);
   const disabled=f.pads.filter(button=>button.disabled).map(button=>button.dataset.pad);
   assert.deepEqual(disabled,index===3?['a','b']:index===4?['up','down','b']:[]);
   f.submit(`choose(${index+1}); start();`);f.advance(280);
   assert.equal(f.session.selected,index);assert.equal(f.session.status,'running');
  }
  assert.ok(f.selections.includes(5),'sixth cartridge notifies the host route');
 }finally{f.close();}
});

test('onStep reports actual fixed 20ms engine inputs even when animation frames arrive unevenly',()=>{
 const f=fixture();try{
  f.frame();const initial=JSON.parse(JSON.stringify(f.session.world));
  f.key('ArrowLeft');f.frame(50);f.frame(10);f.key('ArrowLeft','keyup');f.frame(40);
  assert.equal(f.steps.length,5);assert.equal(f.session.activeMs,100);
  let replay=initial;
  for(const [index,step]of f.steps.entries()){
   assert.equal(step.dt,20000);assert.equal(step.activeMs,(index+1)*20);
   replay=cartridges[2].step(replay,step.dt/1000000,step.actions)??replay;
  }
  assert.deepEqual(f.session.world,replay,'recorded inputs reproduce the production simulation');
 }finally{f.close();}
});

test('held discrete inputs are delivered once per 120ms in both blocks and sokoban',()=>{
 for(const index of [0,5]){
  const f=fixture(index);try{
   f.frame();f.key('ArrowLeft');f.advance(280);f.key('ArrowLeft','keyup');
   const moves=f.steps.filter(step=>step.actions.length);
   assert.deepEqual(moves.map(step=>step.activeMs),[20,140,260]);
   assert.ok(moves.every(step=>step.dt===20000&&step.actions.length===1&&step.actions[0]===(index===0?1:4)));
   assert.ok(f.steps.every(step=>step.dt===20000));
  }finally{f.close();}
 }
});

test('host begin uses its verified seed without a reset loop and finish ends the current replay',()=>{
 const f=fixture();try{
  f.view.begin(763);
  assert.equal(f.session.seed,763);assert.equal(f.session.selected,2);assert.equal(f.session.status,'running');
  assert.deepEqual(f.session.world,cartridges[2].create(763));assert.equal(f.session.activeMs,0);
  assert.equal(f.resets,0,'begin must not invalidate the verified run that requested it');
  f.frame();f.advance(40);assert.equal(f.steps.length,2);
  f.view.finish();assert.equal(f.ends,1);assert.equal(f.session.status,'ended');
  const world=JSON.stringify(f.session.world),time=f.session.activeMs;f.advance(120);
  assert.equal(JSON.stringify(f.session.world),world);assert.equal(f.session.activeMs,time);assert.equal(f.steps.length,2);
  f.view.begin(764);assert.equal(f.resets,0);assert.equal(f.session.activeMs,0);assert.equal(f.session.seed,764);
  assert.deepEqual(f.session.world,cartridges[2].create(764));
 }finally{f.close();}
});

test('remounting a recorded discrete game preserves the action cooldown across a language or page change',()=>{
 const first=fixture(0);first.frame();first.key('ArrowRight');first.advance(20);const model=first.model,initial=first.steps.map(step=>step.actions);first.close();
 const second=fixture(0,model);try{second.frame();second.machine('start');second.key('ArrowLeft');second.advance(140);const ticks=[...initial,...second.steps.map(step=>step.actions)],moves=ticks.flatMap((actions,index)=>actions.some(a=>a!==0)?[index]:[]);assert.ok(moves.length>=2);assert.ok(moves[1]-moves[0]>=6,'the server must be able to validate the resumed actual recording');}finally{second.close();}
});
