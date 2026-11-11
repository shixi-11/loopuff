import test from 'node:test';
import assert from 'node:assert/strict';
import {createFlight,stepFlight,observeFlight} from '../src/handheld-flight.js';
const advance=(s,seconds,actions=[])=>{for(let t=0;t<seconds;t+=1/60)stepFlight(s,1/60,actions);};
test('deterministic JSON state, integer observations and complete movement bounds',()=>{
 const a=createFlight(42),b=createFlight(42);advance(a,1,[1,4]);advance(b,1,[1,4]);assert.deepEqual(a,b);assert.deepEqual(JSON.parse(JSON.stringify(a)),a);
 advance(a,5,[1,4]);assert.equal(a.player.x,9);assert.equal(a.player.y,104);advance(a,5,[2,5]);assert.equal(a.player.x,311);assert.equal(a.player.y,229);
 assert.ok(Object.values(observeFlight(a)).every(Number.isInteger));
});
test('no automatic fire; held fire respects cooldown',()=>{
 const s=createFlight();stepFlight(s,.1);assert.equal(s.bullets.length,0);stepFlight(s,.1,[3]);assert.equal(s.bullets.filter(b=>!b.enemy).length,1);stepFlight(s,.05,[3]);assert.equal(s.bullets.length,1);stepFlight(s,.1,[3]);assert.equal(s.bullets.length,2);
});
test('a fired bullet travels and destroys an aligned enemy for score',()=>{
 const s=createFlight();s.enemies=[{x:160,y:80,homeX:160,homeY:80,phase:0,dive:0,hp:1,fire:99}];advance(s,.8,[3]);assert.equal(s.score,100);assert.equal(s.enemies.length,0);assert.ok(s.effects.length>0);
});
test('enemy hits consume one life then shield prevents stacked instant death',()=>{
 const s=createFlight();s.player.shield=0;s.bullets=Array.from({length:5},()=>({x:160,y:205,vy:65,enemy:true}));stepFlight(s,.05);assert.equal(s.health,2);assert.ok(s.player.shield>1);assert.equal(s.over,false);
 s.player.shield=0;s.health=1;s.bullets=[{x:160,y:205,vy:65,enemy:true}];stepFlight(s,.05);assert.equal(s.over,true);const snapshot=JSON.stringify(s);stepFlight(s,1,[3]);assert.equal(JSON.stringify(s),snapshot);
});
test('cleared formation advances wave after breathing room',()=>{
 const s=createFlight();s.enemies=[];advance(s,.5);assert.equal(s.wave,1);advance(s,.7);assert.equal(s.wave,2);assert.equal(s.enemies.length,12);assert.equal(s.won,false);
});
