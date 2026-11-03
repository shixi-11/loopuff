import test from 'node:test';
import assert from 'node:assert/strict';
import {newHeist,startHeist,advanceHeist,pauseHeist,deployHeist,inspectHeist,saveHeist,restoreHeist,heistWorld,heistInputs} from '../src/heist.js';
import {heistExample,heistStarter} from '../src/heist-strategies.js';
const simulate=(s,ms,frame=100)=>{for(let n=0;n<ms&&s.status==='running';n+=frame)advanceHeist(s,Math.min(frame,ms-n));};
test('adaptive programs actually complete all four objectives across changing worlds',()=>{
 for(let seed=0;seed<100;seed++){
  const s=newHeist(seed,'timed',`test-${seed}`);assert.equal(startHeist(s,heistExample).ok,true);simulate(s,310000);
  assert.equal(s.outcome,'escaped',`seed ${seed}`);assert.ok(s.activeMs>30000);assert.ok(s.activeMs<heistWorld(seed).timeLimitMs);assert.ok(s.key&&s.door&&s.bag);
  assert.deepEqual(s.events.filter(e=>['key','door','bag'].includes(e.kind)).map(e=>e.kind),['key','door','bag']);
  assert.equal(saveHeist(s).history.length,1);assert.equal(saveHeist(s,saveHeist(s).history).history.length,1);
 }
});
test('movement is continuous and a hardcoded forward policy cannot pass a closed door',()=>{
 const s=newHeist(5);startHeist(s,'sync fn decide(a,b,c,d,e,f,g) {return 1}');let previous=s.x;
 for(let i=0;i<1000;i++){advanceHeist(s,20);assert.ok(Math.abs(s.x-previous)<=130);previous=s.x;}
 assert.equal(s.x,heistWorld(s.seed).door-1200);assert.equal(s.key,false);assert.equal(s.bag,false);assert.ok(s.events.some(e=>e.kind==='blocked'));
});
test('same program observations follow current inputs; inspection and invalid deployment cannot move the world',()=>{
 const s=newHeist(1),before=structuredClone(s);assert.equal(inspectHeist(s,heistStarter).ok,true);assert.deepEqual(s,before);
 for(const code of ['',heistStarter+'; 1.log()',heistStarter.replaceAll('return 1','return 9'),'unknown.log()','x'.repeat(3001)]){
  const report=inspectHeist(s,code);assert.equal(report.ok,false);assert.deepEqual(s,before);
 }
 startHeist(s,heistStarter);simulate(s,1000);const x=s.x,t=s.activeMs,energy=s.energy;deployHeist(s,'unknown.log()');
 assert.equal(s.status,'paused');simulate(s,1000);assert.equal(s.x,x);assert.equal(s.activeMs,t);assert.equal(s.energy,energy);
});
test('fixed frames, pauses and save restoration retain decisions and fractional active time',()=>{
 const a=newHeist(9,'practice','same'),b=newHeist(9,'practice','same');startHeist(a,heistExample);startHeist(b,heistExample);simulate(a,40000,20);simulate(b,40000,250);assert.deepEqual(saveHeist(a),saveHeist(b));
 const policy='sync fn decide(distance,b,c,d,e,f,g) {if distance > 34 then {return 1} else {return 2}}';
 const s=newHeist(0);startHeist(s,policy);simulate(s,503);const snapshot=saveHeist(s),r=restoreHeist(snapshot).current;assert.equal(r.status,'paused');assert.equal(r.remainderMs,3);
 startHeist(r);simulate(s,100);simulate(r,100);assert.deepEqual(saveHeist(r),saveHeist(s));
 pauseHeist(r);const frozen=saveHeist(r);advanceHeist(r,200);assert.deepEqual(saveHeist(r),frozen);startHeist(r);const t=r.activeMs;advanceHeist(r,251);assert.equal(r.status,'paused');assert.equal(r.activeMs,t);
});
test('cover, contact, stamina and patrol directions affect outcomes; practice has no countdown',()=>{
 const practice=newHeist(2),timed=newHeist(2,'timed');for(const s of [practice,timed]){startHeist(s,'sync fn decide(a,b,c,d,e,f,g) {return 3}');simulate(s,310000);}
 assert.equal(practice.status,'running');assert.equal(timed.outcome,'timeout');assert.equal(timed.activeMs,heistWorld(2).timeLimitMs);
 const s=newHeist(8);startHeist(s,heistStarter);simulate(s,310000);assert.ok(['caught','lockdown'].includes(s.outcome));
 const run=newHeist(1);startHeist(run,'sync fn decide(a,b,c,d,e,f,g) {return 6}');simulate(run,3000);assert.ok(run.energy<100000);assert.ok(run.alarm>0);assert.equal(heistInputs(run).energy,Math.floor(run.energy/1000));
});
test('snapshot validation rejects impossible or unknown records while cloning real snapshots',()=>{
 const s=newHeist(7);startHeist(s,heistExample);simulate(s,7000);const saved=saveHeist(s);assert.deepEqual(saveHeist(restoreHeist(saved).current).current,{...saved.current,status:'paused'});
 for(const mutate of [v=>v.version=2,v=>v.current.x=heistWorld(7).exit,v=>v.current.bag=true,v=>v.current.secret='x',v=>v.current.remainderMs=20,v=>v.current.visible=!v.current.visible]){
  const bad=structuredClone(saved);mutate(bad);assert.throws(()=>restoreHeist(bad));
 }
});
test('physical contact is safe while hidden, and leaving cover at contact can cause capture',()=>{
 const s=newHeist(1);startHeist(s,heistExample);let reached=false;
 for(let i=0;i<5000&&s.status==='running';i++){advanceHeist(s,20);if(s.hidden&&Math.abs(s.x-s.guardX)<1000){reached=true;break;}}
 assert.equal(reached,true);const exposed=structuredClone(s);deployHeist(exposed,'sync fn decide(a,b,c,d,e,f,g){return 4}');advanceHeist(exposed,20);assert.equal(exposed.outcome,'caught');advanceHeist(s,20);assert.equal(s.status,'running');assert.equal(s.hidden,true);
});
test('moving interrupts incomplete objective use, and real function replies can choose actions',()=>{
 const s=newHeist(0);startHeist(s,heistStarter);simulate(s,9000);assert.ok(s.useMs>0);assert.equal(s.key,false);
 const reply='fn decide(a,b,c,d,e,f,g){return ! 1}';assert.equal(inspectHeist(s,reply).command,1);deployHeist(s,reply);advanceHeist(s,20);assert.equal(s.useMs,0);assert.equal(s.key,false);
 assert.equal(inspectHeist(newHeist(0),heistExample.replace('sync fn','fn').replaceAll('return ','return ! ')).code,'replyUsed');
 deployHeist(s,'fn decide(a,b,c,d,e,f,g){return ! 4}');simulate(s,400);assert.equal(s.key,true);
});
