import test from 'node:test';
import assert from 'node:assert/strict';
import {newPursuit,pursuitRoute,pursuitRules,startPursuit,pausePursuit,advancePursuit,deployPursuit,inspectPursuit,setPursuitRoute,pursuitInputs,pursuitPosition,pursuitContact,pursuitSegment} from '../src/pursuit.js';
const policy='if obstacle < 4 then { 3.log() } else { if energy > 35 then { 2.log() } else { 1.log() } }';
const simulate=(state,ms,frame=100)=>{for(let elapsed=0;elapsed<ms&&state.status==='running';elapsed+=frame)advancePursuit(state,Math.min(frame,ms-elapsed));return state;};
test('a police leader physically backtracks to intercept instead of waiting at a capped final position',()=>{
 const s=newPursuit(8,'police','calm');setPursuitRoute(s,1);deployPursuit(s,policy);startPursuit(s);
 for(let i=0;i<15000&&s.status==='running'&&s.actors.police.road!=='thief'&&s.actors.police.section<20;i++)advancePursuit(s,100);
 assert.equal(s.status,'running');const before=pursuitPosition(s,'police');simulate(s,10000);
 assert.ok(pursuitPosition(s,'police')<before-20,'leader must move into the escape road, not wait on the exit');
});
test('every generated route has a physical ten-minute lower bound at the fastest legal speed',()=>{
 for(const seed of [0,1,7,255,0xffffffff])for(const path of [0,1]){
  let length=0;for(let i=0;i<20;i++){const route=pursuitRoute(seed,i,path);length+=route.length;assert.ok(route.obstacles.every(n=>n>0&&n<route.length));assert.ok(route.length>=pursuitRules.minSection);}
  assert.ok((length-1.1)/pursuitRules.maxSpeed>600);
 }
});
test('route decisions can turn a missed interception into a real police victory',()=>{
 const s=newPursuit(8,'police','standard');setPursuitRoute(s,1);deployPursuit(s,policy);startPursuit(s);
 for(let n=0;n<18000&&s.status==='running';n++){if(s.actors.police.road==='thief')setPursuitRoute(s,0);advancePursuit(s,100);}
 assert.equal(s.outcome,'caught');assert.equal(pursuitContact(s),true);assert.ok(s.activeMs>600000);assert.ok(s.actors.police.road!=='police');
});
test('real elapsed simulation time is independent of frame rate; paused and idle time do not count',()=>{
 const states=[30,60,120].map(fps=>{const s=newPursuit(18);deployPursuit(s,policy);startPursuit(s);return simulate(s,60000,1000/fps);});
 for(const s of states){assert.equal(s.activeMs,60000);s.lastReport=null;}
 assert.deepEqual(states[0],states[1]);assert.deepEqual(states[1],states[2]);
 const state=states[0];pausePursuit(state);const before=structuredClone(state);simulate(state,600000);assert.deepEqual(state,before);
 const idle=newPursuit(18);advancePursuit(idle,250);assert.equal(idle.activeMs,0);assert.throws(()=>advancePursuit(idle,600000),e=>e.code==='elapsed');
});
test('the same executed policy drives a continuous world for more than 600 seconds before a real outcome',()=>{
 for(const role of ['police','thief']){
  const s=newPursuit(8,role,'calm');setPursuitRoute(s,1);assert.equal(deployPursuit(s,policy).ok,true);startPursuit(s);simulate(s,599900);
  assert.equal(s.outcome,null);assert.equal(s.status,'running');assert.ok(s.actors[role].section>8);assert.ok(s.actors[role].clears>20);
  simulate(s,1200000);assert.equal(s.status,'finished');assert.ok(s.activeMs>=600000);assert.ok(['caught','escaped'].includes(s.outcome));
  if(s.outcome==='caught')assert.equal(pursuitContact(s),true);
  else {assert.equal(s.actors.thief.road,'exit');assert.equal(s.actors.thief.distance,200);}
  const frozen=structuredClone(s);advancePursuit(s,250);assert.deepEqual(s,frozen);
 }
});
test('separate streets and paths cannot capture, but shared physical junctions can',()=>{
 const s=newPursuit(9),p=s.actors.police,t=s.actors.thief;
 assert.equal(pursuitContact(s),false);
 p.road='thief';p.path=1;p.distance=90;t.path=0;t.distance=90;assert.equal(pursuitContact(s),false);
 p.distance=.3;t.distance=.4;assert.equal(pursuitContact(s),true);
 p.section=3;p.path=0;p.distance=pursuitSegment(s,'police').length-.2;t.section=4;t.distance=.3;assert.equal(pursuitContact(s),true);
 p.jumpMs=450;assert.equal(pursuitContact(s),false);
 p.jumpMs=0;p.section=19;p.road='police';p.distance=pursuitSegment(s,'police').length-.2;t.road='exit';t.section=20;t.distance=.3;assert.equal(pursuitContact(s),true);
});
test('reverse interception crosses edges continuously and cannot farm the same supply point',()=>{
 const s=newPursuit(3);startPursuit(s);s.activeMs=700000;
 const p=s.actors.police,t=s.actors.thief;p.road='thief';p.section=3;p.direction=-1;p.path=0;p.distance=111;p.obstacle=1;p.energy=10;t.section=1;t.distance=10;
 const before=p.travelled;simulate(s,1000,10);assert.ok(p.distance<110);assert.equal(p.collected.filter(id=>id==='thief:3:0:0').length,1);assert.ok(p.travelled-before<=7.5+1e-6);
 // A later traversal of that fixed point must not restore its supply twice.
 p.distance=111;p.direction=-1;p.obstacle=1;p.energy=10;simulate(s,1000,10);assert.equal(p.collected.filter(id=>id==='thief:3:0:0').length,1);assert.ok(p.energy<20);
 p.distance=.01;p.direction=-1;p.section=0;p.obstacle=-1;simulate(s,100,10);assert.equal(p.section,0);assert.equal(p.direction,1);assert.ok(p.distance>0);
});
test('reaching ten minutes does not automatically decide a winner or teleport either actor',()=>{
 const s=newPursuit(3);startPursuit(s);simulate(s,600000);assert.equal(s.activeMs,600000);assert.equal(s.status,'running');assert.equal(s.outcome,null);
 assert.ok(s.actors.police.section<20);assert.ok(s.actors.thief.section<20);
 assert.ok(s.actors.police.collisions>20);assert.ok(s.events.some(e=>e.kind==='blocked'));
});
test('energy, route choices and earlier collisions change later world state rather than ending the match early',()=>{
 const steady=newPursuit(11),sprint=newPursuit(11),adapt=newPursuit(11);
 deployPursuit(sprint,'2.log()');deployPursuit(adapt,policy);setPursuitRoute(adapt,1);
 for(const s of [steady,sprint,adapt]){startPursuit(s);simulate(s,120000);assert.equal(s.status,'running');assert.equal(s.outcome,null);}
 assert.ok(sprint.actors.police.energy<steady.actors.police.energy);assert.ok(adapt.actors.police.collisions<steady.actors.police.collisions);
 assert.notEqual(adapt.actors.police.distance,steady.actors.police.distance);assert.equal(adapt.nextRoute,1);
});
test('invalid code cannot partly move the world or spend resources, and changed inputs are real program inputs',()=>{
 const s=newPursuit(99),before=structuredClone(s);
 for(const source of ['','1.log();9.log()','unknown.log()','while true { 1.log() }','x'.repeat(3001)]){assert.equal(inspectPursuit(s,source).ok,false);assert.deepEqual(s,before);}
 assert.equal(inspectPursuit(s,'energy.log()').ok,false);
 assert.deepEqual(inspectPursuit(s,'if energy > 50 then {2.log()} else {1.log()}').logs,['2']);
 s.actors.police.energy=20;assert.deepEqual(inspectPursuit(s,'if energy > 50 then {2.log()} else {1.log()}').logs,['1']);
 assert.equal(pursuitInputs(s).energy,20);assert.equal(deployPursuit(s,policy).ok,true);assert.equal(s.activeMs,0);
});
test('a runtime error caused by later inputs pauses before consuming that world step',()=>{
 const s=newPursuit(1);assert.equal(deployPursuit(s,'(1 / (energy - 100)).log()').ok,false);
 s.actors.police.energy=99;assert.equal(deployPursuit(s,'(1 / (100 - energy)).log()').ok,true);startPursuit(s);
 // Existing queued action runs, then a newly sampled input can make the policy invalid.
 simulate(s,250);s.actors.police.energy=100;const elapsed=s.activeMs;advancePursuit(s,10);
 assert.equal(s.status,'paused');assert.equal(s.activeMs,elapsed);assert.equal(s.lastReport.ok,false);
});
test('a jump pressed between fixed steps is buffered until the world advances',()=>{
 const s=newPursuit(10);startPursuit(s);advancePursuit(s,1,{jump:true});assert.equal(s.actors.police.pendingJump,true);
 advancePursuit(s,9);assert.ok(s.actors.police.jumpMs>0);assert.equal(s.actors.police.pendingJump,false);assert.equal(s.activeMs,10);
});
test('an error during a long frame cannot carry paused time into the resumed world',()=>{
 const s=newPursuit(1);s.actors.police.energy=99;deployPursuit(s,'(1 / (100 - energy)).log()');startPursuit(s);simulate(s,250);
 s.actors.police.energy=100;const elapsed=s.activeMs;advancePursuit(s,250);assert.equal(s.status,'paused');assert.equal(s.remainderMs,0);
 deployPursuit(s,'1.log()');startPursuit(s);advancePursuit(s,10);assert.equal(s.activeMs,elapsed+10);
});
test('deploying an invalid strategy during play pauses without consuming or replacing the old plan',()=>{
 const s=newPursuit(3);startPursuit(s);advancePursuit(s,100);const strategy=s.strategy,queue=[...s.queue],time=s.activeMs;
 assert.equal(deployPursuit(s,'9.log()').ok,false);assert.equal(s.status,'paused');assert.equal(s.strategy,strategy);assert.deepEqual(s.queue,queue);
 advancePursuit(s,250);assert.equal(s.activeMs,time);
});
