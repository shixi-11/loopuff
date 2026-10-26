import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chaseMotion,mountChaseScene,validateChaseArt} from '../src/chase-scene.js';
import {inspectChase,chasePuzzle} from '../src/chase.js';

test('the rendered move obeys player-before-rival order and reaches exact rule endpoints',()=>{
  for(const role of ['police','thief']){
    const from={police:0,thief:4};
    const to=inspectChase(role,0,'2.log()').frames[0];
    const start=chaseMotion(from,to,role,0),middle=chaseMotion(from,to,role,.4),end=chaseMotion(from,to,role,1);
    const other=role==='police'?'thief':'police';
    assert.equal(start.police,0);assert.equal(start.thief,4);
    assert.equal(middle[other],from[other]);assert.ok(middle[role]>from[role]);assert.ok(middle.lift>0);
    assert.equal(end.police,to.police);assert.equal(end.thief,to.thief);assert.equal(end.lift,0);
    assert.equal(chaseMotion(from,to,role,.8)[role],to[role]);
  }
});
test('blocked characters recoil instead of walking through the barricade; final poses show the outcome',()=>{
  const from={police:0,thief:4},blocked=inspectChase('police',1,'3.log()').frames[0];
  assert.equal(blocked.blocked,true);
  const hit=chaseMotion(from,blocked,'police',.4),end=chaseMotion(from,blocked,'police',1);
  assert.ok(hit.police>0&&hit.police<.3);assert.equal(hit.poses.police,6);assert.equal(hit.lift,0);
  assert.equal(end.police,0);assert.equal(end.thief,5);
  const caught=inspectChase('police',0,'3.log();3.log()').frames.at(-1);
  assert.deepEqual(chaseMotion(caught,caught,'police',1).poses,{police:7,thief:6});
  const escaped=inspectChase('thief',0,'3.log();3.log();3.log();3.log();2.log()').frames.at(-1);
  assert.equal(chaseMotion(escaped,escaped,'thief',1).poses.thief,7);
});
test('all registered animation poses stay within their native RGBA PNG source bounds',async()=>{
  const root=new URL('../public/assets/',import.meta.url);
  const atlas=JSON.parse(await readFile(new URL('chase-sprites.json',root),'utf8'));
  for(const name of ['police','thief','props']){
    const bytes=await readFile(new URL(`../art/chase/${name}.png`,import.meta.url)),data=atlas[name];
    assert.equal(bytes.toString('ascii',1,4),'PNG');
    assert.equal(bytes.readUInt32BE(16),data.width);assert.equal(bytes.readUInt32BE(20),data.height);
    assert.equal(bytes[25],6,'RGBA PNG');assert.equal(data.frames.length,name==='props'?2:8);
    for(const [x,y,w,h] of data.frames){assert.ok(w>0&&h>0);assert.ok(x>=0&&y>=0&&x+w<=data.width&&y+h<=data.height);}
  }
});

test('the complete scene draws registered assets and cancels paused or disposed animation work',async t=>{
  const atlas=JSON.parse(await readFile(new URL('../public/assets/chase-sprites.json',import.meta.url),'utf8'));
  const saved=new Map(),frames=new Map(),draws=[],placements=[];let id=0,disconnected=false;
  function set(name,value){saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});}
  t.after(()=>{for(const [name,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}});
  set('Image',class{set src(url){this.source=url;this.width=url.endsWith('chase-street.webp')?1672:1774;this.height=url.endsWith('chase-street.webp')?940:887;queueMicrotask(()=>this.onload?.());}});
  let release;
  const catalog=new Promise(resolve=>{release=resolve;});
  set('fetch',async()=>catalog);
  set('devicePixelRatio',1);
  set('ResizeObserver',class{constructor(cb){this.cb=cb;}observe(){this.cb();}disconnect(){disconnected=true;}});
  set('requestAnimationFrame',cb=>{frames.set(++id,cb);return id;});
  set('cancelAnimationFrame',i=>frames.delete(i));
  const ctx=new Proxy({drawImage(...args){draws.push(args);},translate(...args){placements.push(args);}}, {get(target,name){return target[name]||(()=>{});}});
  const canvas={style:{},getContext:()=>ctx},root={clientWidth:960,dataset:{},querySelector:()=>canvas};
  const motion={matches:false},errors=[],scene=mountChaseScene(root,{role:'police',puzzle:chasePuzzle(1),reduced:motion,text:{police:'Police',thief:'Thief'},onError:()=>errors.push('draw failed')});
  const from={police:0,thief:4},to=inspectChase('police',1,'2.log()').frames[0];
  const waiting=scene.play(from,to);scene.pause(true);
  release({ok:true,json:async()=>atlas});
  assert.equal(await scene.ready,true);assert.deepEqual(errors,[]);assert.equal(root.dataset.scene,'ready');
  await Promise.resolve();assert.equal(frames.size,0,'pause during resource loading stays paused');
  scene.pause(false);assert.equal(frames.size,1);scene.reset();assert.equal(await waiting,false);
  assert.ok(draws.length>=7,'street, gate, barricades and both actors were drawn');
  for(const file of ['chase-police.webp','chase-thief.webp','chase-props.webp','chase-street.webp'])assert.ok(draws.some(args=>args[0].source.endsWith(file)),file);
  const cancelledBeforeStart=scene.play(from,to);scene.reset();assert.equal(await cancelledBeforeStart,false);assert.equal(frames.size,0);
  const pending=scene.play(from,to);await Promise.resolve();assert.equal(frames.size,1);
  scene.pause(true);assert.equal(frames.size,0);
  const count=draws.length;scene.pause(false);assert.equal(frames.size,1);
  scene.reset();assert.equal(await pending,false);assert.equal(frames.size,0);
  assert.ok(draws.length>count,'reset redraws initial positions');
  motion.matches=true;const reduced=scene.play(from,to);scene.pause(true);await Promise.resolve();assert.equal(frames.size,0);
  scene.pause(false);const callbacks=[...frames.values()];frames.clear();callbacks.forEach(cb=>cb(100));assert.equal(await reduced,true);
  motion.matches=false;const second=scene.play(from,to);await Promise.resolve();assert.equal(frames.size,1);scene.dispose();
  assert.equal(await second,false);assert.equal(frames.size,0);assert.equal(disconnected,true);
  const thiefScene=mountChaseScene(root,{role:'thief',puzzle:chasePuzzle(0),reduced:{matches:true},text:{police:'Police',thief:'Thief'}});
  assert.equal(await thiefScene.ready,true);
  const escape=inspectChase('thief',0,'3.log();3.log();3.log();3.log();2.log()').frames.at(-1);
  assert.equal(escape.thief,18);thiefScene.show(escape);
  const thiefX=placements.at(-1)[0];assert.ok(thiefX>40&&thiefX<root.clientWidth-40,'controlled actor stays visible at the exit even when the rival is far behind');
  thiefScene.dispose();
});

test('missing pose contracts fail early instead of becoming a later draw error',async()=>{
  const atlas=JSON.parse(await readFile(new URL('../public/assets/chase-sprites.json',import.meta.url),'utf8'));
  const art={atlas,police:{width:1774,height:887},thief:{width:1774,height:887},props:{width:1774,height:887}};
  assert.equal(validateChaseArt(art),art);
  atlas.police.frames.pop();assert.throws(()=>validateChaseArt(art),/atlas/);
});

test('a hanging asset request times out, exposes the error and can load successfully on retry',async t=>{
  const {mountChaseScene:mount}=await import('../src/chase-scene.js?timeout-check');
  const atlas=JSON.parse(await readFile(new URL('../public/assets/chase-sprites.json',import.meta.url),'utf8'));
  const saved=new Map(),timers=new Map();let successful=false,id=0;
  const set=(name,value)=>{saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});};
  t.after(()=>{for(const [name,d] of saved){if(d)Object.defineProperty(globalThis,name,d);else delete globalThis[name];}});
  set('Image',class{set src(url){this.width=url.endsWith('chase-street.webp')?1672:1774;this.height=url.endsWith('chase-street.webp')?940:887;if(successful&&url)queueMicrotask(()=>this.onload?.());}});
  set('fetch',async()=>successful?{ok:true,json:async()=>atlas}:new Promise(()=>{}));
  set('devicePixelRatio',1);set('ResizeObserver',class{observe(){}disconnect(){}});
  set('setTimeout',(cb,ms)=>{assert.equal(ms,20000);timers.set(++id,cb);return id;});set('clearTimeout',n=>timers.delete(n));
  set('cancelAnimationFrame',()=>{});
  const ctx=new Proxy({}, {get(target,name){return target[name]||(()=>{});}}),canvas={style:{},getContext:()=>ctx};
  const create=()=>({clientWidth:960,dataset:{},querySelector:()=>canvas});
  const errors=[],firstRoot=create(),first=mount(firstRoot,{role:'police',puzzle:chasePuzzle(0),reduced:{matches:true},text:{},onError:()=>errors.push('failed')});
  assert.equal(timers.size,1);[...timers.values()][0]();assert.equal(await first.ready,false);assert.equal(firstRoot.dataset.scene,'error');assert.deepEqual(errors,['failed']);assert.equal(timers.size,0);first.dispose();
  successful=true;const retryRoot=create(),retry=mount(retryRoot,{role:'police',puzzle:chasePuzzle(0),reduced:{matches:true},text:{police:'Police',thief:'Thief'}});
  assert.equal(await retry.ready,true);assert.equal(retryRoot.dataset.scene,'ready');assert.equal(timers.size,0);retry.dispose();
});
