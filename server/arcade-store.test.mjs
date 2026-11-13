import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createArcadeStore,normalizeNickname} from './arcade-store.mjs';

function fixture(t){
  const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON; CREATE TABLE user(id TEXT PRIMARY KEY,email TEXT);');
  for(const id of ['private-a','private-b'])db.prepare('INSERT INTO user VALUES (?,?)').run(id,`${id}@private.invalid`);
  let time=1000000;const store=createArcadeStore(db,{now:()=>time,newSeed:()=>7});t.after(()=>db.close());
  return {db,store,advance:ms=>time+=ms};
}
const finish=(f,user,game,score,durationUs=10000000,won=false)=>{const run=f.store.startRun(user,game);f.advance(durationUs/1000);return f.store.finishRun(user,run.runId,{score,durationUs,won});};

test('profile defaults and nickname normalization never expose auth identity or executable markup',t=>{
  const {store}=fixture(t),a=store.profile('private-a');assert.match(a.nickname,/^Player-[a-f0-9]{10}$/);assert.equal(a.coins,0);
  assert.equal(store.profile('private-a').nickname,a.nickname);
  assert.deepEqual(Object.keys(a).sort(),['achievements','coins','nickname']);
  for(const name of ['<script>x</script>','a@b.com','a\u202eb','a\nxx','😈😈','x','a'.repeat(25)])assert.throws(()=>store.setNickname('private-a',name),{code:'INVALID_NICKNAME'});
  assert.equal(store.profile('private-a').nickname,a.nickname);
  assert.equal(normalizeNickname('  星  航员 '),'星 航员');
  assert.equal(store.setNickname('private-a','Ｐｉｌｏｔ ７').nickname,'Pilot 7');
});

test('run ownership, expiry, wallclock and single submission are enforced durably',t=>{
  const f=fixture(t),run=f.store.startRun('private-a','blocks');
  assert.equal(run.seed,7);assert.equal(run.expiresAt,2800000);
  assert.throws(()=>f.store.getRun('private-b',run.runId),{code:'RUN_NOT_FOUND'});
  assert.throws(()=>f.store.finishRun('private-b',run.runId,{score:999,won:true,durationUs:1}),{code:'RUN_NOT_FOUND'});
  assert.throws(()=>f.store.finishRun('private-a',run.runId,{score:50,won:false,durationUs:5000001}),{code:'RUN_TIME_EXCEEDED'});
  assert.equal(f.store.getRun('private-a',run.runId).result,null);
  f.advance(10000);const result=f.store.finishRun('private-a',run.runId,{score:50,won:false,durationUs:10000000});assert.equal(result.awarded,5);
  f.advance(1800001);assert.deepEqual(f.store.finishRun('private-a',run.runId,{score:999,won:true,durationUs:1}),result);
  const expired=f.store.startRun('private-a','snake');f.advance(1800001);assert.throws(()=>f.store.getRun('private-a',expired.runId),{code:'RUN_EXPIRED'});
  assert.equal(f.store.leaderboard('blocks')[0].score,50);
});

test('leaderboard uses per-game personal best and shorter duration for equal scores, top 20 only',t=>{
  const f=fixture(t);f.store.setNickname('private-a','Star A');f.store.setNickname('private-b','Star B');
  finish(f,'private-a','blocks',100,15000000);finish(f,'private-b','blocks',100,10000000);
  assert.equal(f.store.leaderboard('blocks')[0].nickname,'Star B');
  finish(f,'private-a','blocks',99,1000000);finish(f,'private-a','blocks',100,17000000);
  assert.equal(f.store.leaderboard('blocks')[1].durationMs,15000);
  finish(f,'private-a','blocks',100,9000000);assert.equal(f.store.leaderboard('blocks')[0].nickname,'Star A');
  finish(f,'private-a','snake',500);assert.equal(f.store.leaderboard('snake').length,1);
  for(let i=0;i<23;i++){const id=`other-${i}`;f.db.prepare('INSERT INTO user VALUES (?,?)').run(id,'hidden@private.invalid');finish(f,id,'blocks',200+i);}
  const rows=f.store.leaderboard('blocks');assert.equal(rows.length,20);assert.equal(rows[0].score,222);assert.equal(rows[19].score,203);
  for(const row of rows)assert.deepEqual(Object.keys(row).sort(),['durationMs','nickname','rank','score','won']);
  assert.doesNotMatch(JSON.stringify(rows),/private\.invalid|userId|user_id|source_hash/);
});

test('first play, victory and actual lesson submissions award exactly once',t=>{
  const f=fixture(t);assert.equal(finish(f,'private-a','blocks',0).awarded,0);
  assert.equal(finish(f,'private-a','blocks',1,9999999).awarded,0);
  assert.equal(finish(f,'private-a','blocks',100,10000000,true).awarded,25);
  assert.equal(finish(f,'private-a','blocks',200,11000000,true).awarded,0);
  assert.equal(f.store.claimLesson('private-a','addition','first-hash').awarded,10);
  assert.equal(f.store.claimLesson('private-a','addition','later-hash').awarded,0);
  assert.equal(f.store.profile('private-a').coins,35);assert.equal(f.store.profile('private-b').coins,0);
  assert.equal(f.db.prepare('SELECT source_hash AS hash FROM loopuff_arcade_lessons').get().hash,'first-hash');
});

test('a failed achievement write rolls back run consumption, personal score and lesson submission together',t=>{
  const f=fixture(t),run=f.store.startRun('private-a','blocks');f.advance(10000);
  f.db.exec("CREATE TRIGGER fail_award BEFORE INSERT ON loopuff_arcade_achievements BEGIN SELECT RAISE(ABORT,'test rollback'); END");
  assert.throws(()=>f.store.finishRun('private-a',run.runId,{score:100,won:true,durationUs:10000000}),/test rollback/);
  assert.equal(f.store.getRun('private-a',run.runId).result,null);assert.deepEqual(f.store.leaderboard('blocks'),[]);assert.equal(f.store.profile('private-a').coins,0);
  assert.throws(()=>f.store.claimLesson('private-a','signal','hash'),/test rollback/);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM loopuff_arcade_lessons').get().n,0);
  f.db.exec('DROP TRIGGER fail_award');assert.equal(f.store.finishRun('private-a',run.runId,{score:100,won:true,durationUs:10000000}).awarded,25);
});

test('profiles, issued seeds, results and coin ledger survive SQLite reopen',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'loopuff-arcade-'));const path=join(dir,'test.sqlite');
  let db=new DatabaseSync(path);db.exec("CREATE TABLE user(id TEXT PRIMARY KEY);INSERT INTO user VALUES ('account')");let time=1000000;
  let store=createArcadeStore(db,{now:()=>time,newSeed:()=>19});store.setNickname('account','Pilot');const run=store.startRun('account','flight');time+=10000;
  const saved=store.finishRun('account',run.runId,{score:100,won:true,durationUs:10000000});store.claimLesson('account','names','hash');db.close();
  db=new DatabaseSync(path);t.after(async()=>{db.close();await rm(dir,{recursive:true,force:true});});store=createArcadeStore(db,{now:()=>time});
  assert.equal(store.getRun('account',run.runId).seed,19);assert.deepEqual(store.getRun('account',run.runId).result,saved);assert.equal(store.profile('account').coins,35);assert.equal(store.leaderboard('flight')[0].nickname,'Pilot');
});
