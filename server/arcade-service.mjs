import {createHash} from 'node:crypto';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {ArcadeError,arcadeGameIds} from './arcade-store.mjs';
import {arcadeTickUs,arcadeActionCooldown,isDiscreteGame} from '../src/arcade-protocol.js';
import {course} from '../src/course.js';
import {arcadeNewStepIds} from '../src/guide-work.js';
import {inspectArcadeLearning} from '../src/arcade-learning.js';
import {gradeTask} from '../src/assessment.js';
import {inspectStartStep,startSteps} from '../src/learning-paths.js';
import {inspectDiagnostic,diagnosticIds} from '../src/diagnostic.js';
import {createBlocks,stepBlocks} from '../src/handheld-blocks.js';
import {createTanks,stepTanks} from '../src/handheld-tanks.js';
import {createFlight,stepFlight} from '../src/handheld-flight.js';
import {createSnake,stepSnake} from '../src/handheld-snake.js';
import {createBreakout,stepBreakout} from '../src/handheld-breakout.js';
import {createSokoban,stepSokoban} from '../src/handheld-sokoban.js';

export const arcadeBodyBytes=2*1024*1024;
export const arcadePaths=new Set(['/api/arcade','/loopuff/api/arcade']);
const ENGINES={blocks:[createBlocks,stepBlocks,5],tanks:[createTanks,stepTanks,5],flight:[createFlight,stepFlight,5],snake:[createSnake,stepSnake,4],breakout:[createBreakout,stepBreakout,3],sokoban:[createSokoban,stepSokoban,6]};
const DIAGNOSTIC_SEED=0x51a7c0de;
const inFlightReplays=new WeakMap();
let activeReplays=0;

export function validateArcadeSteps(game,steps){
  if(!arcadeGameIds.includes(game))throw new ArcadeError('INVALID_GAME');
  if(!Array.isArray(steps)||steps.length<1||steps.length>90000)throw new ArcadeError('INVALID_STEPS');
  let totalSteps=0,totalUs=0,lastActionTick=-arcadeActionCooldown;
  const groups=steps.map(item=>{
    if(!Array.isArray(item)||item.length!==3)throw new ArcadeError('INVALID_STEPS');
    const [dtUs,commands,count]=item;
    if(dtUs!==arcadeTickUs)throw new ArcadeError('INVALID_TICK');
    if(typeof commands!=='string'||!/^\d*$/.test(commands)||[...commands].some(c=>Number(c)>ENGINES[game][2])||!Number.isInteger(count)||count<1||count>90000)throw new ArcadeError('INVALID_STEPS');
    const discrete=isDiscreteGame(game);
    if(commands.length>(discrete?1:4))throw new ArcadeError('ACTION_LIMIT');
    if(discrete&&/[1-9]/.test(commands)){
      if(count>1||totalSteps-lastActionTick<arcadeActionCooldown)throw new ArcadeError('ACTION_TOO_FAST');
      lastActionTick=totalSteps;
    }
    totalSteps+=count;totalUs+=dtUs*count;
    if(totalSteps>90000||totalUs>1800000000)throw new ArcadeError('REPLAY_LIMIT');
    return {dtUs,actions:[...commands].map(Number),count};
  });
  return {groups,totalSteps,totalUs};
}

// The only score calculation used by HTTP finish: seed + ordered actual
// engine inputs. Client score/win/balance fields never enter this function.
export function replayArcade(game,seed,steps){
  const {groups}=validateArcadeSteps(game,steps),[create,step]=ENGINES[game];
  let world=create(seed),durationUs=0;
  outer:for(const group of groups)for(let i=0;i<group.count;i++){
    if(world.over)break outer;
    world=step(world,group.dtUs/1000000,group.actions)??world;
    durationUs+=group.dtUs;
  }
  if(!Number.isSafeInteger(world.score)||world.score<0||!durationUs)throw new ArcadeError('INVALID_REPLAY');
  return {score:world.score,won:world.won===true,durationUs};
}

// Replay is isolated from the authentication event loop. A huge warehouse
// undo history cannot exhaust the HTTP process or indefinitely block logins.
export function replayArcadeIsolated(game,seed,steps,{timeoutMs=8000}={}){
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL(import.meta.url),{workerData:{kind:'loopuff-arcade-replay',game,seed,steps},execArgv:[],resourceLimits:{maxOldGenerationSizeMb:96,maxYoungGenerationSizeMb:16,stackSizeMb:4}});
    let settled=false;
    const finish=(error,result)=>{
      if(settled)return;settled=true;clearTimeout(timer);
      // Keep the global slot until the actual worker exits, including timeout.
      void worker.terminate().then(()=>{if(error)reject(error);else resolve(result);},()=>reject(new ArcadeError('REPLAY_FAILED',422)));
    };
    const timer=setTimeout(()=>finish(new ArcadeError('REPLAY_TIMEOUT',422)),timeoutMs);
    worker.once('message',message=>message.ok?finish(null,message.result):finish(new ArcadeError(message.code||'INVALID_REPLAY',422)));
    worker.once('error',()=>finish(new ArcadeError('REPLAY_RESOURCE_LIMIT',422)));
    worker.once('exit',()=>finish(new ArcadeError('REPLAY_FAILED',422)));
  });
}
if(!isMainThread&&workerData?.kind==='loopuff-arcade-replay'){
  try{parentPort.postMessage({ok:true,result:replayArcade(workerData.game,workerData.seed,workerData.steps)});}
  catch(error){parentPort.postMessage({ok:false,code:error instanceof ArcadeError?error.code:'INVALID_REPLAY'});}
}

export function inspectArcadeLesson(lessonId,source){
  if(typeof lessonId!=='string'||typeof source!=='string'||source.length>4096)throw new ArcadeError('INVALID_LESSON');
  const lesson=course.find(item=>item.id===lessonId);
  if(lesson)return gradeTask(source,lesson.independent).ok;
  if(lessonId.startsWith('start:')&&startSteps.some(item=>item.id===lessonId.slice(6)))return inspectStartStep(lessonId.slice(6),source).ok;
  if(lessonId.startsWith('diagnostic:')&&diagnosticIds.includes(lessonId.slice(11)))return inspectDiagnostic(DIAGNOSTIC_SEED,lessonId.slice(11),source).ok;
  if(lessonId.startsWith('arcade:')&&arcadeNewStepIds.includes(lessonId.slice(7)))return inspectArcadeLearning(lessonId.slice(7),source).ok;
  throw new ArcadeError('INVALID_LESSON');
}
function fields(input,allowed){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!allowed.includes(key)))throw new ArcadeError();
}

// The host supplies its existing BetterAuth session resolver, origin set,
// durable limiter, streaming JSON reader and response/cookie helpers.
export function createArcadeService({store,session,origins,limiter,address,readJSON,respond,replay=replayArcadeIsolated}){
  let pending=inFlightReplays.get(store);
  if(!pending){pending=new Map();inFlightReplays.set(store,pending);}
  function finish(userId,run,steps){
    // Ownership was checked by getRun before consulting this private map.
    if(pending.has(run.id))return pending.get(run.id);
    const {totalUs}=validateArcadeSteps(run.game,steps);
    if(totalUs>Math.max(0,store.now()-run.startedAt+5000)*1000)throw new ArcadeError('RUN_TIME_EXCEEDED');
    if(activeReplays>=2)throw new ArcadeError('REPLAY_BUSY',429);
    limiter('arcade-replay',userId,60,8);
    activeReplays++;
    const task=Promise.resolve().then(()=>replay(run.game,run.seed,steps)).then(result=>store.finishRun(userId,run.id,result)).finally(()=>{
      activeReplays--;pending.delete(run.id);
    });
    pending.set(run.id,task);return task;
  }
  return async request=>{
    if(!['GET','POST'].includes(request.method))return respond(405,{error:{code:'METHOD_NOT_ALLOWED'}});
    const origin=request.headers.get('origin');
    if((request.method==='POST'&&!origin)||(origin&&!origins.has(origin)))return respond(403,{error:{code:'FORBIDDEN'}});
    try{
      limiter('arcade-ip',address(request),60,60);
      const account=await session(request),userId=account?.userId,cookies=account?.cookies||[];
      if(request.method==='GET'){
        const game=new URL(request.url).searchParams.get('game')||'blocks';
        return respond(200,{game,leaderboard:store.leaderboard(game),profile:userId?store.profile(userId):null},cookies);
      }
      if(!userId)throw new ArcadeError('AUTH_REQUIRED',401);
      limiter('arcade-user',userId,60,30);
      const input=await readJSON(request,arcadeBodyBytes);
      if(input?.action==='profile'){
        fields(input,['action','nickname']);
        return respond(200,{profile:input.nickname===undefined?store.profile(userId):store.setNickname(userId,input.nickname)},cookies);
      }
      if(input?.action==='start'){
        fields(input,['action','game']);
        return respond(200,store.startRun(userId,input.game),cookies);
      }
      if(input?.action==='finish'){
        fields(input,['action','runId','steps']);
        if(typeof input.runId!=='string'||input.runId.length>80)throw new ArcadeError('INVALID_RUN');
        const run=store.getRun(userId,input.runId);
        if(run.result!==null)return respond(200,run.result,cookies);
        return respond(200,await finish(userId,run,input.steps),cookies);
      }
      if(input?.action==='claim'){
        fields(input,['action','lessonId','source']);
        if(!inspectArcadeLesson(input.lessonId,input.source))throw new ArcadeError('LESSON_NOT_PASSED',422);
        const hash=createHash('sha256').update(input.source).digest('hex');
        return respond(200,store.claimLesson(userId,input.lessonId,hash),cookies);
      }
      throw new ArcadeError('INVALID_ACTION');
    }catch(error){
      const status=error instanceof ArcadeError?error.status:[400,413,429].includes(error?.status)?error.status:503;
      return respond(status,{error:{code:status===503?'ARCADE_UNAVAILABLE':error.code||'INVALID_REQUEST'}});
    }
  };
}
