import {normalizeSave,parseSave,SaveError,courseLessonIds} from './save-format.mjs';

function omitsRewrite(previous,next){
 const records=snapshot=>{
  const state=snapshot.data.course?.state,map={};if(!state)return map;
  for(const [id,work] of Object.entries(state.lessonWork||{}))if(typeof work.rewriteDraft==='string')map[id]=work.rewriteDraft;
  const id=courseLessonIds[state.lesson??0];
  // A menu may carry a stale mirror: it only fills a missing per-lesson field.
  if(id&&map[id]===undefined&&typeof state.rewriteDraft==='string')map[id]=state.rewriteDraft;
  return map;
 };
 const before=records(previous),after=records(next);
 return Object.keys(before).some(id=>after[id]===undefined);
}

// Private per-account snapshots; revisions are write preconditions, not game scores.
export function createProgressStore(db,{now=Date.now}={}){
 db.exec(`CREATE TABLE IF NOT EXISTS loopuff_progress (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL CHECK(revision > 0),
  snapshot TEXT NOT NULL,
  updated_at INTEGER NOT NULL
 )`);
 const read=db.prepare('SELECT revision, snapshot, updated_at AS updatedAt FROM loopuff_progress WHERE user_id = ?');
 const insert=db.prepare('INSERT INTO loopuff_progress(user_id,revision,snapshot,updated_at) VALUES (?,1,?,?) ON CONFLICT(user_id) DO NOTHING RETURNING revision,updated_at AS updatedAt');
 const update=db.prepare('UPDATE loopuff_progress SET revision=revision+1,snapshot=?,updated_at=? WHERE user_id=? AND revision=? RETURNING revision,updated_at AS updatedAt');
 return {
  get(userId){const row=read.get(userId);return row?{revision:row.revision,updatedAt:row.updatedAt,snapshot:parseSave(row.snapshot)}:{revision:0,updatedAt:null,snapshot:null};},
  put(userId,expectedRevision,snapshot){
   if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||expectedRevision>=Number.MAX_SAFE_INTEGER)throw new SaveError();
   const normalized=normalizeSave(snapshot),encoded=JSON.stringify(normalized),timestamp=now();
   // A still-open v1 client cannot erase a domain it does not understand, even
   // if it somehow obtained a matching revision. Never downgrade GET responses.
   const current=read.get(userId);
   if(current&&current.revision!==expectedRevision)throw new SaveError('SAVE_CONFLICT');
   if(current){const previous=parseSave(current.snapshot);if(snapshot.version===1&&previous.data.pursuit!==null||snapshot.version<3&&previous.data.heist!==null||previous.data.course?.state?.diagnostic&&!snapshot.data.course?.state?.diagnostic||omitsRewrite(previous,normalized))throw new SaveError('SAVE_VERSION');}
   const row=expectedRevision===0?insert.get(userId,encoded,timestamp):update.get(encoded,timestamp,userId,expectedRevision);
   if(!row)throw new SaveError('SAVE_CONFLICT');
   return {revision:row.revision,updatedAt:row.updatedAt};
  }
 };
}
