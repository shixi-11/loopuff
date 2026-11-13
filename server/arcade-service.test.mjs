import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createArcadeStore,arcadeGameIds,ArcadeError} from './arcade-store.mjs';
import {arcadeTickUs,arcadeActionCooldown,isDiscreteGame} from '../src/arcade-protocol.js';
import {createArcadeService,validateArcadeSteps,replayArcade,replayArcadeIsolated,inspectArcadeLesson,arcadeBodyBytes} from './arcade-service.mjs';
import {createAccountService} from './account-service.mjs';
import {course} from '../src/course.js';
import {arcadeLearningSteps} from '../src/arcade-learning.js';
import {createBlocks,stepBlocks} from '../src/handheld-blocks.js';
import {createTanks,stepTanks} from '../src/handheld-tanks.js';
import {createFlight,stepFlight} from '../src/handheld-flight.js';
import {createSnake,stepSnake} from '../src/handheld-snake.js';
import {createBreakout,stepBreakout} from '../src/handheld-breakout.js';
import {createSokoban,stepSokoban} from '../src/handheld-sokoban.js';
const base='http://127.0.0.1:8773',origin='http://localhost:8773';
test('new learning rewards validate actual game controls and never duplicate legacy exercise aliases',async t=>{
 const f=fixture(t);
 for(const step of arcadeLearningSteps.slice(5))assert.equal(inspectArcadeLesson('arcade:'+step.id,step.example),true,step.id);
 assert.throws(()=>inspectArcadeLesson('arcade:run','7.log()'),error=>error.code==='INVALID_LESSON');
 assert.equal((await post(f.service,{action:'claim',lessonId:'arcade:repeat',source:'start();right();right();right()'})).status,422);
 const step=arcadeLearningSteps.find(item=>item.id==='repeat');
 assert.equal((await data(await post(f.service,{action:'claim',lessonId:'arcade:repeat',source:step.example}))).body.awarded,10);
 assert.equal((await data(await post(f.service,{action:'claim',lessonId:'arcade:repeat',source:step.example}))).body.awarded,0);
});
const post=(service,input,user='private-a',extra={})=>service(new Request(base+'/api/arcade',{method:'POST',headers:{Origin:origin,'x-test-user':user,'Content-Type':'application/json',...extra},body:JSON.stringify(input)}));
const data=async response=>({status:response.status,body:await response.json()});
function fixture(t,options={}){
  const db=new DatabaseSync(':memory:');db.exec("PRAGMA foreign_keys=ON;CREATE TABLE user(id TEXT PRIMARY KEY,email TEXT);INSERT INTO user VALUES ('private-a','private-a@secret.invalid'),('private-b','private-b@secret.invalid')");
  let time=1000000;const store=createArcadeStore(db,{now:()=>time,newSeed:()=>7}),limits=[];
  const service=createArcadeService({store,...options,origins:new Set([origin]),limiter:(...args)=>limits.push(args),address:()=> 'test-ip',
    session:async request=>({userId:request.headers.get('x-test-user')||null}),
    readJSON:async(request,limit)=>{const text=await request.text();if(Buffer.byteLength(text)>limit)throw Object.assign(Error(),{status:413,code:'BODY_TOO_LARGE'});try{return JSON.parse(text);}catch{throw Object.assign(Error(),{status:400,code:'INVALID_JSON'});}},
    respond:(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}})});
  t.after(()=>db.close());return {db,store,service,limits,advance:ms=>time+=ms};
}

test('adversarial microsecond and burst proofs cannot buy scores or wins',()=>{
  for(const game of arcadeGameIds)assert.throws(()=>validateArcadeSteps(game,[[1,'',1]]),{code:'INVALID_TICK'},game);
  for(const game of ['blocks','sokoban']){
    assert.throws(()=>validateArcadeSteps(game,[[arcadeTickUs,'22',1]]),{code:'ACTION_LIMIT'});
    assert.throws(()=>validateArcadeSteps(game,[[arcadeTickUs,'2',2]]),{code:'ACTION_TOO_FAST'});
    assert.throws(()=>validateArcadeSteps(game,[[arcadeTickUs,'2',1],[arcadeTickUs,'',arcadeActionCooldown-2],[arcadeTickUs,'1',1]]),{code:'ACTION_TOO_FAST'});
    assert.doesNotThrow(()=>validateArcadeSteps(game,[[arcadeTickUs,'2',1],[arcadeTickUs,'0',arcadeActionCooldown-1],[arcadeTickUs,'1',1]]));
  }
  assert.deepEqual(validateArcadeSteps('flight',[[arcadeTickUs,'1133',1]]).groups[0].actions,[1,1,3,3]);
  assert.throws(()=>validateArcadeSteps('flight',[[arcadeTickUs,'11111',1]]),{code:'ACTION_LIMIT'});
});

test('concurrent duplicate finish shares one replay and global capacity stays at two without queuing',async t=>{
  const pending=[];let calls=0;
  const replay=()=>{calls++;return new Promise((resolve,reject)=>pending.push({resolve,reject}));};
  const first=fixture(t,{replay}),second=fixture(t,{replay});
  const a=first.store.startRun('private-a','blocks'),b=second.store.startRun('private-a','blocks'),c=second.store.startRun('private-b','blocks');
  const finish=run=>({action:'finish',runId:run.runId,steps:[[arcadeTickUs,'5',1]]});
  const p1=post(first.service,finish(a)),duplicates=Array.from({length:7},()=>post(first.service,finish(a))),p2=post(second.service,finish(b));
  await new Promise(resolve=>setImmediate(resolve));
  try{
    assert.equal(calls,2,'duplicates must not allocate workers');
    assert.equal((await post(first.service,finish(a),'private-b')).status,404,'pending work cannot be shared across accounts');
    const busy=await data(await post(second.service,finish(c),'private-b'));assert.equal(busy.status,429);assert.equal(busy.body.error.code,'REPLAY_BUSY');assert.equal(calls,2);
  }finally{for(const task of pending)task.resolve({score:10,won:false,durationUs:arcadeTickUs});}
  const responses=await Promise.all([p1,...duplicates,p2].map(async p=>data(await p)));for(const response of responses)assert.equal(response.status,200);
  for(const duplicate of responses.slice(1,8))assert.deepEqual(duplicate.body,responses[0].body);
  assert.equal(first.limits.filter(([bucket])=>bucket==='arcade-replay').length,1);
  const retry=post(second.service,finish(c),'private-b');await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,3);pending.at(-1).resolve({score:10,won:false,durationUs:arcadeTickUs});assert.equal((await retry).status,200);
});

test('failed and timed-out replay release in-flight identity and global slots for retry',async t=>{
  let calls=0;const f=fixture(t,{replay:async()=>{calls++;if(calls===1)throw new ArcadeError('REPLAY_RESOURCE_LIMIT',422);return {score:10,won:false,durationUs:arcadeTickUs};}});
  const run=f.store.startRun('private-a','blocks'),body={action:'finish',runId:run.runId,steps:[[arcadeTickUs,'5',1]]};
  const rejected=await data(await post(f.service,body));assert.equal(rejected.status,422);assert.equal(rejected.body.error.code,'REPLAY_RESOURCE_LIMIT');assert.equal(f.store.getRun('private-a',run.runId).result,null);
  assert.equal((await post(f.service,body)).status,200);assert.equal(calls,2);
  const timeout=fixture(t,{replay:(...args)=>replayArcadeIsolated(...args,{timeoutMs:1})}),slow=timeout.store.startRun('private-a','blocks');
  const failed=await data(await post(timeout.service,{...body,runId:slow.runId}));assert.equal(failed.status,422);assert.equal(failed.body.error.code,'REPLAY_TIMEOUT');assert.equal(timeout.store.getRun('private-a',slow.runId).result,null);
  const fresh=fixture(t),newRun=fresh.store.startRun('private-a','blocks');assert.equal((await post(fresh.service,{...body,runId:newRun.runId})).status,200);
});

test('compressed steps preserve repeats and order and reject unsupported or excessive input',()=>{
  assert.deepEqual(validateArcadeSteps('flight',[[arcadeTickUs,'113',2]]).groups[0].actions,[1,1,3]);
  for(const steps of [[],[[0,'',1]],[[50001,'',1]],[[1.5,'',1]],[[1,'',0]],[[1,'',90001]],[[50000,'',36001]],[[1,'',90000],[1,'',1]],[[1,'7',1]],[[1,'x',1]],[[1,'1'.repeat(33),1]],[[1,[],1]],[[1,'',1,4]]])assert.throws(()=>validateArcadeSteps('blocks',steps));
  assert.throws(()=>validateArcadeSteps('breakout',[[1,'4',1]]));assert.throws(()=>validateArcadeSteps('snake',[[1,'5',1]]));
  assert.equal(validateArcadeSteps('sokoban',[[arcadeTickUs,'5',1],[arcadeTickUs,'',5],[arcadeTickUs,'6',1]]).totalUs,arcadeTickUs*7);
  assert.equal(validateArcadeSteps('blocks',[[arcadeTickUs,'0',90000]]).totalUs,1800000000);
});

test('all six real engines are replayed with exactly their seed, dt and action sequence',async()=>{
  const engines={blocks:[createBlocks,stepBlocks,'5'],tanks:[createTanks,stepTanks,'25'],flight:[createFlight,stepFlight,'23'],snake:[createSnake,stepSnake,'3'],breakout:[createBreakout,stepBreakout,'3'],sokoban:[createSokoban,stepSokoban,'2']};
  for(const game of arcadeGameIds){
    const [create,step,actions]=engines[game],steps=[[arcadeTickUs,actions,isDiscreteGame(game)?1:3],[arcadeTickUs,'',10]];let world=create(7),durationUs=0;
    for(const [us,commands,count]of steps)for(let i=0;i<count;i++)if(!world.over){world=step(world,us/1000000,[...commands].map(Number))??world;durationUs+=us;}
    assert.deepEqual(replayArcade(game,7,steps),{score:world.score,won:world.won===true,durationUs},game);
    assert.deepEqual(await replayArcadeIsolated(game,7,steps),replayArcade(game,7,steps),`${game} worker`);
  }
  assert.deepEqual(replayArcade('flight',7,[[arcadeTickUs,'113',4]]),replayArcade('flight',7,Array.from({length:4},()=>[arcadeTickUs,'113',1])));
});

test('finish rejects forged fields, computes actual score, is idempotent, and keeps public data safe',async t=>{
  const f=fixture(t),run=(await data(await post(f.service,{action:'start',game:'blocks'}))).body;
  const fake=await data(await post(f.service,{action:'finish',runId:run.runId,steps:[[arcadeTickUs,'5',1]],score:999999,won:true,coins:999}));
  assert.equal(fake.status,400);assert.equal(f.store.getRun('private-a',run.runId).result,null);
  const body={action:'finish',runId:run.runId,steps:[[arcadeTickUs,'5',1]]};
  const first=await data(await post(f.service,body));assert.equal(first.status,200);assert.equal(first.body.score,replayArcade('blocks',7,body.steps).score);assert.ok(first.body.score>0);assert.equal(first.body.awarded,0);
  const again=await data(await post(f.service,{...body,steps:[[50000,'555',15]]}));assert.deepEqual(again,first);
  assert.equal((await post(f.service,body,'private-b')).status,404);
  const publicResponse=await f.service(new Request(base+'/loopuff/api/arcade?game=blocks'));const publicData=await publicResponse.json();
  assert.equal(publicResponse.status,200);assert.equal(publicData.profile,null);assert.equal(publicData.leaderboard[0].score,first.body.score);
  assert.doesNotMatch(JSON.stringify(publicData),/private-a|secret\.invalid|userId|user_id|runId|seed/);
  assert.ok(f.limits.some(([bucket])=>bucket==='arcade-replay'));
});

test('real valid ten-second play awards once; zero-effect padding after terminal does not count',async t=>{
  const f=fixture(t);f.advance(10000);
  for(let i=0;i<2;i++){
    const run=f.store.startRun('private-a','blocks');f.advance(10000);
    const response=await data(await post(f.service,{action:'finish',runId:run.runId,steps:[[arcadeTickUs,'5',1],[arcadeTickUs,'',499]]}));
    assert.equal(response.status,200);assert.equal(response.body.durationMs,10000);assert.equal(response.body.awarded,i===0?5:0);assert.equal(response.body.profile.coins,5);
  }
  const snake=replayArcade('snake',7,[[arcadeTickUs,'',750]]);assert.ok(snake.durationUs<10000000);assert.equal(snake.won,false);
});

test('a real five-board victory earns service-computed win coins once and ignores post-win padding',async t=>{
  const f=fixture(t),solutions=['2','441','12321','441141233223211','122113344441232113222321'];
  const commands=solutions.join(''),playing=[...commands].flatMap((command,index)=>index<commands.length-1?[[arcadeTickUs,command,1],[arcadeTickUs,'',arcadeActionCooldown-1]]:[[arcadeTickUs,command,1]]);
  const durationMs=10000+(1+(commands.length-1)*arcadeActionCooldown)*arcadeTickUs/1000;
  const steps=[[arcadeTickUs,'',500],...playing,[arcadeTickUs,'',750]];
  for(let i=0;i<2;i++){
    const run=f.store.startRun('private-a','sokoban');f.advance(40000);
    const result=await data(await post(f.service,{action:'finish',runId:run.runId,steps}));
    assert.equal(result.status,200);assert.equal(result.body.score,1500);assert.equal(result.body.won,true);assert.equal(result.body.durationMs,durationMs);assert.equal(result.body.awarded,i===0?25:0);assert.equal(result.body.profile.coins,25);
  }
});

test('bad replay, future simulated time, cross-account access and expired runs do not consume or overwrite',async t=>{
  const f=fixture(t),run=f.store.startRun('private-a','blocks');
  for(const [steps,code]of [[[[50001,'5',1]],'INVALID_TICK'],[[[arcadeTickUs,'',251]],'RUN_TIME_EXCEEDED']]){
    const rejected=await data(await post(f.service,{action:'finish',runId:run.runId,steps}));assert.equal(rejected.status,400);assert.equal(rejected.body.error.code,code);assert.equal(f.store.getRun('private-a',run.runId).result,null);
  }
  assert.equal((await post(f.service,{action:'finish',runId:run.runId,steps:[[arcadeTickUs,'',1]]},'private-b')).status,404);
  f.advance(1800001);assert.equal((await post(f.service,{action:'finish',runId:run.runId,steps:[[arcadeTickUs,'',1]]})).status,410);assert.deepEqual(f.store.leaderboard('blocks'),[]);
});

test('lesson claim runs formal grade and multi-input inspectors, never completed flags or unused concepts',async t=>{
  const f=fixture(t);
  for(const lesson of course)assert.equal(inspectArcadeLesson(lesson.id,lesson.independent.example),true,lesson.id);
  assert.equal(inspectArcadeLesson('addition','let unused = 4 + 7; 11.log()'),false);
  assert.equal(inspectArcadeLesson('start:decide','if obstacle < 4 then {3.log()} else {1.log()}'),true);
  assert.equal(inspectArcadeLesson('start:decide','3.log()'),false);
  assert.equal(inspectArcadeLesson('diagnostic:branch','if fuel > threshold then {1.log()} else {2.log()}'),true);
  assert.equal(inspectArcadeLesson('diagnostic:branch','let unused = 1 > 0; 1.log()'),false);
  assert.equal((await post(f.service,{action:'claim',lessonId:'signal',completed:true})).status,400);
  assert.equal((await post(f.service,{action:'claim',lessonId:'signal',source:'0.log()'})).status,422);
  const accepted=await data(await post(f.service,{action:'claim',lessonId:'signal',source:'12.log()'}));assert.equal(accepted.status,200);assert.equal(accepted.body.awarded,10);
  assert.equal((await data(await post(f.service,{action:'claim',lessonId:'signal',source:'(6 + 6).log()'}))).body.awarded,0);
  assert.equal((await post(f.service,{action:'claim',lessonId:'signal',source:'0.log()'})).status,422);assert.equal(f.store.profile('private-a').coins,10);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM loopuff_arcade_lessons').get().n,1);
});

test('real BetterAuth session, origin, method and 2MB streaming body boundaries are reused',async t=>{
  const service=await createAccountService({databasePath:':memory:',baseURL:base,secret:'test-only-arcade-service-secret-0123456789abcdef'});t.after(()=>service.close());
  const req=(method,input,cookies='',extra={},path='/api/arcade')=>service(new Request(base+path,{method,headers:{Origin:origin,Cookie:cookies,'Content-Type':'application/json',...extra},...(input?{body:JSON.stringify(input)}:{})}));
  assert.equal((await req('GET')).status,200);assert.equal((await req('POST',{action:'profile'})).status,401);
  assert.equal((await req('POST',{action:'profile'},'',{Origin:'https://foreign.invalid'})).status,403);assert.equal((await req('POST',{action:'profile'},'',{Origin:''})).status,403);assert.equal((await req('DELETE')).status,405);
  const accounts=[];
  for(const name of ['first','second']){
    const signup=await req('POST',{action:'sign-up',email:`${name}@private.invalid`,password:'Arcade-test-password-2026'},'',{},'/api/account');assert.equal(signup.status,200);
    const auth=await signup.json(),cookies=signup.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');accounts.push({cookies,id:auth.user.id});
  }
  const a=accounts[0],b=accounts[1],profile=await data(await req('POST',{action:'profile'},a.cookies));assert.equal(profile.status,200);assert.match(profile.body.profile.nickname,/^Player-/);assert.doesNotMatch(JSON.stringify(profile.body),new RegExp(a.id+'|private.invalid'));
  const run=(await data(await req('POST',{action:'start',game:'blocks'},a.cookies,{},'/loopuff/api/arcade'))).body;
  const finish={action:'finish',runId:run.runId,steps:[[arcadeTickUs,'5',1]]};assert.equal((await req('POST',finish,b.cookies)).status,404);assert.equal((await req('POST',finish,a.cookies)).status,200);
  assert.equal((await req('POST',{action:'profile',nickname:'<img src=x onerror=alert(1)>'},a.cookies)).status,400);
  assert.equal((await req('POST',{action:'profile'},a.cookies,{'Content-Length':String(arcadeBodyBytes+1)})).status,413);
  assert.equal((await req('POST',{action:'profile',extra:'a'.repeat(arcadeBodyBytes)},a.cookies)).status,413);
  const leaderboard=await data(await req('GET',null,'',{},'/api/arcade?game=blocks'));assert.equal(leaderboard.body.profile,null);assert.equal(leaderboard.body.leaderboard.length,1);
  assert.doesNotMatch(JSON.stringify(leaderboard.body),new RegExp(a.id+'|'+b.id+'|private.invalid'));
});
