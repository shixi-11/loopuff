import {randomBytes,randomUUID} from 'node:crypto';

export const arcadeGameIds=Object.freeze(['blocks','tanks','flight','snake','breakout','sokoban']);
export class ArcadeError extends Error {
  constructor(code='INVALID_REQUEST',status=400){super(code);this.code=code;this.status=status;}
}
export function normalizeNickname(value){
  if(typeof value!=='string')throw new ArcadeError('INVALID_NICKNAME');
  const name=value.normalize('NFKC').trim().replace(/ +/g,' ');
  if([...name].length<2||[...name].length>24||!/[\p{L}\p{N}]/u.test(name)||!/^[\p{L}\p{M}\p{N} _-]+$/u.test(name))throw new ArcadeError('INVALID_NICKNAME');
  return name;
}

// Account identities are private foreign keys. Only nicknames, scores and
// durations leave this store through public leaderboard/profile projections.
export function createArcadeStore(db,{now=Date.now,newId=randomUUID,newSeed=()=>randomBytes(4).readUInt32LE()}={}){
  db.exec(`
    CREATE TABLE IF NOT EXISTS loopuff_arcade_profiles (
      user_id TEXT PRIMARY KEY NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      nickname TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS loopuff_arcade_runs (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      game TEXT NOT NULL,
      seed INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      result TEXT
    );
    CREATE INDEX IF NOT EXISTS loopuff_arcade_runs_user ON loopuff_arcade_runs(user_id,started_at);
    CREATE TABLE IF NOT EXISTS loopuff_arcade_scores (
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      game TEXT NOT NULL,
      score INTEGER NOT NULL CHECK(score>0),
      duration_us INTEGER NOT NULL CHECK(duration_us>0),
      won INTEGER NOT NULL,
      submitted_at INTEGER NOT NULL,
      PRIMARY KEY(user_id,game)
    );
    CREATE INDEX IF NOT EXISTS loopuff_arcade_ranking ON loopuff_arcade_scores(game,score DESC,duration_us ASC,submitted_at ASC);
    CREATE TABLE IF NOT EXISTS loopuff_arcade_achievements (
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      achievement TEXT NOT NULL,
      coins INTEGER NOT NULL CHECK(coins>0),
      earned_at INTEGER NOT NULL,
      PRIMARY KEY(user_id,achievement)
    );
    CREATE TABLE IF NOT EXISTS loopuff_arcade_lessons (
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      lesson_id TEXT NOT NULL,
      source_hash TEXT NOT NULL,
      passed_at INTEGER NOT NULL,
      PRIMARY KEY(user_id,lesson_id)
    );
  `);
  const ensure=db.prepare('INSERT INTO loopuff_arcade_profiles(user_id,nickname) VALUES (?,?) ON CONFLICT(user_id) DO NOTHING');
  const readProfile=db.prepare('SELECT nickname FROM loopuff_arcade_profiles WHERE user_id=?');
  const readAwards=db.prepare('SELECT achievement,coins FROM loopuff_arcade_achievements WHERE user_id=? ORDER BY achievement');
  const award=db.prepare('INSERT INTO loopuff_arcade_achievements(user_id,achievement,coins,earned_at) VALUES (?,?,?,?) ON CONFLICT(user_id,achievement) DO NOTHING');
  const run=db.prepare('SELECT id,user_id AS userId,game,seed,started_at AS startedAt,expires_at AS expiresAt,result FROM loopuff_arcade_runs WHERE id=? AND user_id=?');
  function transaction(work){db.exec('BEGIN IMMEDIATE');try{const result=work();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}
  function profile(userId){
    ensure.run(userId,`Player-${randomBytes(5).toString('hex')}`);
    const awards=readAwards.all(userId);
    return {nickname:readProfile.get(userId).nickname,coins:awards.reduce((sum,item)=>sum+item.coins,0),achievements:awards.map(item=>item.achievement)};
  }
  function getRun(userId,runId){
    const row=run.get(runId,userId);if(!row)throw new ArcadeError('RUN_NOT_FOUND',404);
    if(row.result!==null)return {...row,result:JSON.parse(row.result)};
    if(now()>row.expiresAt)throw new ArcadeError('RUN_EXPIRED',410);
    return row;
  }
  function give(userId,key,coins){return award.run(userId,key,coins,now()).changes?coins:0;}
  return {
    now,
    profile,
    setNickname(userId,nickname){const safe=normalizeNickname(nickname);return transaction(()=>{profile(userId);db.prepare('UPDATE loopuff_arcade_profiles SET nickname=? WHERE user_id=?').run(safe,userId);return profile(userId);});},
    startRun(userId,game){
      if(!arcadeGameIds.includes(game))throw new ArcadeError('INVALID_GAME');
      return transaction(()=>{
        profile(userId);const timestamp=now(),id=newId(),seed=newSeed()>>>0,expiresAt=timestamp+30*60*1000;
        db.prepare('INSERT INTO loopuff_arcade_runs(id,user_id,game,seed,started_at,expires_at) VALUES (?,?,?,?,?,?)').run(id,userId,game,seed,timestamp,expiresAt);
        return {runId:id,game,seed,expiresAt};
      });
    },
    getRun,
    finishRun(userId,runId,{score,won,durationUs}){
      if(!Number.isSafeInteger(score)||score<0||!Number.isSafeInteger(durationUs)||durationUs<1||durationUs>1800000000||typeof won!=='boolean')throw new ArcadeError('INVALID_REPLAY');
      return transaction(()=>{
        const current=getRun(userId,runId);if(current.result!==null)return current.result;
        if(durationUs>Math.max(0,now()-current.startedAt+5000)*1000)throw new ArcadeError('RUN_TIME_EXCEEDED');
        profile(userId);
        if(score>0)db.prepare(`INSERT INTO loopuff_arcade_scores(user_id,game,score,duration_us,won,submitted_at) VALUES (?,?,?,?,?,?)
          ON CONFLICT(user_id,game) DO UPDATE SET score=excluded.score,duration_us=excluded.duration_us,won=excluded.won,submitted_at=excluded.submitted_at
          WHERE excluded.score>loopuff_arcade_scores.score OR (excluded.score=loopuff_arcade_scores.score AND excluded.duration_us<loopuff_arcade_scores.duration_us)`).run(userId,current.game,score,durationUs,Number(won),now());
        let awarded=0;
        if(score>0&&durationUs>=10000000)awarded+=give(userId,`game:${current.game}:played`,5);
        if(won)awarded+=give(userId,`game:${current.game}:won`,20);
        const result={runId,game:current.game,score,won,durationMs:durationUs/1000,awarded,profile:profile(userId)};
        db.prepare('UPDATE loopuff_arcade_runs SET result=? WHERE id=? AND user_id=? AND result IS NULL').run(JSON.stringify(result),runId,userId);
        return result;
      });
    },
    claimLesson(userId,lessonId,sourceHash){
      return transaction(()=>{
        profile(userId);
        db.prepare('INSERT INTO loopuff_arcade_lessons(user_id,lesson_id,source_hash,passed_at) VALUES (?,?,?,?) ON CONFLICT(user_id,lesson_id) DO NOTHING').run(userId,lessonId,sourceHash,now());
        const awarded=give(userId,`lesson:${lessonId}`,10);
        return {passed:true,awarded,profile:profile(userId)};
      });
    },
    leaderboard(game){
      if(!arcadeGameIds.includes(game))throw new ArcadeError('INVALID_GAME');
      const rows=db.prepare(`SELECT p.nickname,s.score,s.duration_us AS durationUs,s.won FROM loopuff_arcade_scores s JOIN loopuff_arcade_profiles p ON p.user_id=s.user_id
        WHERE s.game=? ORDER BY s.score DESC,s.duration_us ASC,s.submitted_at ASC,s.user_id ASC LIMIT 20`).all(game);
      return rows.map((row,index)=>({rank:index+1,nickname:row.nickname,score:row.score,durationMs:row.durationUs/1000,won:Boolean(row.won)}));
    }
  };
}
