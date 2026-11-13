import test from 'node:test';
import assert from 'node:assert/strict';
import { createBreakout, stepBreakout, observeBreakout, drawBreakout } from '../src/handheld-breakout.js';

function freeze(s) { Object.freeze(s); for (const v of Object.values(s)) if (v && typeof v === 'object' && !Object.isFrozen(v)) freeze(v); return s; }
function airborne() { const s=createBreakout(7); s.ball.attached=false; return s; }

test('seeded, serializable state and immutable deterministic replay', () => {
  const start=freeze(createBreakout(19)), original=JSON.stringify(start);
  let a=start,b=JSON.parse(original);
  for(let i=0;i<700;i++) { const actions=i<10?[3]:[i%100<50?1:2]; a=stepBreakout(a,1/120,actions); b=stepBreakout(b,1/120,actions); }
  assert.deepEqual(a,b); assert.equal(JSON.stringify(start),original); assert.notEqual(a,start);
  assert.deepEqual(JSON.parse(JSON.stringify(a)),a);
  for(const key of ['paddleX','ballX','ballY','ballVX','ballVY','lives','remaining','attached']) assert.ok(Number.isInteger(observeBreakout(a)[key]),key);
});

test('safe serve stays attached until requested; paddle holds for the interval', () => {
  const s=createBreakout(1), moved=stepBreakout(s,.25,[2]);
  assert.equal(moved.ball.attached,true); assert.equal(moved.ball.x,moved.paddle.x); assert.ok(moved.paddle.x>s.paddle.x);
  const launched=stepBreakout(moved,.1,[3]); assert.equal(launched.ball.attached,false); assert.ok(launched.ball.vy<0); assert.ok(launched.ball.y<moved.ball.y);
  assert.equal(stepBreakout(s,100,[1]).paddle.x,33);
});

test('fixed simulation replays identically at different caller dt sizes', () => {
  let a=createBreakout(3),b=createBreakout(3),c=createBreakout(3);
  for(let phase=0;phase<8;phase++) { const actions=phase===0?[3]:[phase%2?1:2];
    for(let i=0;i<30;i++) a=stepBreakout(a,1/30,actions);
    for(let i=0;i<120;i++) b=stepBreakout(b,1/120,actions);
    for(let i=0;i<100;i++) c=stepBreakout(c,.01,actions);
  }
  assert.deepEqual(a,b); assert.deepEqual(a,c);
});

test('swept collision destroys a brick even at extreme speed without tunnelling', () => {
  const s=airborne(); s.bricks=[{x:140,y:70,w:28,h:10,hp:1,color:0},{x:30,y:40,w:28,h:10,hp:1,color:1}];
  Object.assign(s.ball,{x:154,y:130,vx:0,vy:-20000});
  const next=stepBreakout(s,1/240); assert.equal(next.bricks.length,1); assert.ok(next.score>0); assert.ok(next.ball.vy>0); assert.ok(next.ball.y>83);
});

test('brick side and corner contacts reflect the appropriate axes', () => {
  const s=airborne(); s.bricks=[{x:140,y:70,w:28,h:10,hp:2,color:0}];
  Object.assign(s.ball,{x:130,y:75,vx:1000,vy:0});
  const n=stepBreakout(s,.01); assert.ok(n.ball.vx<0); assert.equal(n.bricks[0].hp,1);
  const c=airborne(); c.bricks=s.bricks; Object.assign(c.ball,{x:130,y:60,vx:1000,vy:1000});
  const corner=stepBreakout(c,.01); assert.ok(corner.ball.vx<0); assert.ok(corner.ball.vy<0);
});

test('paddle hit position steers bounce and never bounces a ball below the paddle', () => {
  const s=airborne(); Object.assign(s.ball,{x:s.paddle.x+18,y:209,vx:0,vy:600});
  const n=stepBreakout(s,.02); assert.ok(n.ball.vy<0); assert.ok(n.ball.vx>0);
  const left=airborne(); Object.assign(left.ball,{x:left.paddle.x-18,y:209,vx:0,vy:600}); assert.ok(stepBreakout(left,.02).ball.vx<0);
  const below=airborne(); Object.assign(below.ball,{x:below.paddle.x,y:224,vx:0,vy:160}); assert.ok(stepBreakout(below,.02).ball.vy>0);
});

test('losing a ball costs exactly one life and provides a safe manual re-serve', () => {
  let s=airborne();
  for(let lives=2;lives>=0;lives--) {
    Object.assign(s.ball,{x:20,y:242,vx:0,vy:500,attached:false}); s=stepBreakout(s,.1,[3]);
    assert.equal(s.lives,lives); assert.equal(s.over,lives===0); assert.equal(s.ball.attached,lives>0);
    if(lives>0) {
      assert.equal(stepBreakout(s,.1,[3]).ball.attached,true);
      s=stepBreakout(s,.02,[]);
      assert.equal(stepBreakout(s,.1,[3]).ball.attached,false);
    }
  }
  assert.equal(s.won,false); assert.deepEqual(stepBreakout(s,1,[3]),s);
});

test('three distinct layouts, wave transitions and final victory', () => {
  let s=createBreakout(4); const layouts=[];
  for(let wave=1;wave<=3;wave++) {
    assert.equal(s.wave,wave); layouts.push(s.bricks.map(b=>`${b.x},${b.y}`).join(';'));
    s.bricks=[{x:140,y:70,w:28,h:10,hp:1,color:0}]; Object.assign(s.ball,{x:154,y:90,vx:0,vy:-300,attached:false});
    s=stepBreakout(s,.05);
    if(wave<3) { assert.equal(s.ball.attached,true); assert.equal(s.over,false); }
  }
  assert.equal(new Set(layouts).size,3); assert.equal(s.won,true); assert.equal(s.over,true); assert.equal(s.lives,3);
});

test('a policy observing only every 250ms can complete all three unmodified waves', () => {
  let s=createBreakout(7);
  for(let i=0;i<1600&&!s.over;i++) {
    const o=observeBreakout(s);let target=o.ballX;
    if(o.ballVY>0) {
      const projected=o.ballX+o.ballVX*(213-o.ballY)/o.ballVY;
      const folded=((projected-11)%596+596)%596;
      target=11+(folded>298?596-folded:folded);
    }
    const action=o.attached?3:target>o.paddleX+20?2:target<o.paddleX-20?1:0;
    s=stepBreakout(s,.25,[action]);
  }
  assert.equal(s.won,true); assert.equal(s.wave,3); assert.equal(s.lives,3);
});

test('invalid dt is a fresh unchanged snapshot; drawing is read-only', () => {
  const s=freeze(createBreakout(2));
  for(const dt of [0,-1,NaN,Infinity]) { const n=stepBreakout(s,dt); assert.notEqual(n,s); assert.deepEqual(n,s); }
  const ctx=new Proxy({}, { get:(_,k)=>k==='measureText'?()=>({width:1}):()=>{},set:()=>true });
  drawBreakout(ctx,s); assert.equal(s.time,0);
});
