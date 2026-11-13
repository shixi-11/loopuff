import test from 'node:test';
import assert from 'node:assert/strict';
import {newHandheld,compileHandheld,applyHandheld,handheldInput,cartridges} from '../src/handheld.js';
test('real Tolang selects, starts, pauses and ends each cartridge with the right movement mapping',()=>{
 for(let id=1;id<=3;id++){
  const s=newHandheld(8);applyHandheld(s,compileHandheld(`choose(${id}); start()`,s).commands);assert.equal(s.selected,id-1);assert.equal(s.status,'running');
  const position=()=>s.world.player?.x??s.world.piece.x,before=position(),actions=applyHandheld(s,compileHandheld('right()',s).commands);cartridges[s.selected].step(s.world,.12,actions);assert.ok(position()>before,'movement is visible even before a tank crosses a whole grid cell');
  applyHandheld(s,compileHandheld('pause()',s).commands);assert.equal(s.status,'paused');assert.deepEqual(applyHandheld(s,[1]),[]);
  applyHandheld(s,compileHandheld('start(); finish()',s).commands);assert.equal(s.status,'ended');assert.equal(s.automatic,false);
 }
});
test('the whole executed batch is checked before world mutation, including out-of-range choose and inactive-game commands',()=>{
 const s=newHandheld(),before=structuredClone(s);
 for(const source of ['choose(1001)','choose(0)','choose(7)','choose(3); start(); 9999.log()','choose(1); fire()','start(); missing()','while true {wait()}'])assert.throws(()=>compileHandheld(source,s));
 assert.deepEqual(s,before);assert.throws(()=>applyHandheld(s,[1003,2001,9999]));assert.deepEqual(s,before);
});
test('loops retain repeated control calls and live observations are explicitly supplied only to strategies',()=>{
 const s=newHandheld();assert.deepEqual(compileHandheld('for n in [1,2,3] { left() }',s).commands,[1,1,1]);
 assert.throws(()=>compileHandheld('if x < targetX then {right()} else {drop()}',s));
 assert.ok(compileHandheld(cartridges[0].strategy,s,{strategy:true}).commands.length>0);
 assert.throws(()=>compileHandheld('choose(3);start()',s,{strategy:true}));
 applyHandheld(s,[1003,2001]);assert.ok(compileHandheld(cartridges[2].strategy,s,{strategy:true}).commands.includes(5));
});

test('handheld syntax errors point into user code rather than the host helper prefix',()=>{const source='right(';assert.throws(()=>compileHandheld(source,newHandheld()),e=>e.code==='syntax'&&Number.isInteger(e.position)&&e.position>=0&&e.position<=source.length);});
