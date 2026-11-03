import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAccountService} from './account-service.mjs';
import {emptySave} from './save-format.mjs';
import {heistWorld} from './heist-format.mjs';
const origin='http://localhost:8773',baseURL='http://127.0.0.1:8773',secret='test-only-loopuff-cloud-secret-0123456789abcdef';
const cookie=response=>response.headers.getSetCookie().map(item=>item.split(';',1)[0]).join('; ');
const request=(service,method,body,cookies='',extra={})=>service(new Request(baseURL+'/api/progress',{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),Cookie:cookies,...extra},...(body?{body:JSON.stringify(body)}:{})}));
async function account(service,name){
 const response=await service(new Request(baseURL+'/api/account',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action:'sign-up',email:name+'@example.invalid',password:'Progress-test-password-2026'})}));
 assert.equal(response.status,200);const data=await response.json();return {id:data.user.id,cookies:cookie(response)};
}
async function serviceFor(t){const service=await createAccountService({databasePath:':memory:',baseURL,secret});t.after(()=>service.close());return service;}

test('whole-program rewrites round-trip and older pages cannot silently erase them',async t=>{
 const service=await serviceFor(t),a=await account(service,'progress-rewrite'),snapshot=emptySave();
 const work={phase:'rewrite',draft:'12.log()',rewriteDraft:'',assessedSource:'12.log()'};
 snapshot.data.course={state:{lesson:0,...work,lessonWork:{signal:{...work}},grades:{signal:{score:100,best:100,attempts:1}}}};
 assert.equal((await request(service,'POST',{expectedAccountId:a.id,expectedRevision:0,snapshot},a.cookies)).status,200);
 const old=structuredClone(snapshot);delete old.data.course.state.rewriteDraft;delete old.data.course.state.lessonWork.signal.rewriteDraft;old.data.course.state.phase='independent';old.data.course.state.lessonWork.signal.phase='independent';
 const response=await request(service,'POST',{expectedAccountId:a.id,expectedRevision:1,snapshot:old},a.cookies);assert.equal(response.status,400);assert.equal((await response.json()).error.code,'SAVE_VERSION');
 assert.equal((await request(service,'POST',{expectedAccountId:a.id,expectedRevision:0,snapshot:old},a.cookies)).status,409);
 const result=await(await request(service,'GET',null,a.cookies)).json();assert.equal(result.revision,1);assert.deepEqual(result.snapshot,snapshot);
});

test('v1 and v2 account requests cannot omit an existing bank run even with a matching revision',async t=>{
 const service=await serviceFor(t),a=await account(service,'progress-bank'),snapshot=emptySave(),w=heistWorld(7);
 snapshot.data.heist={version:1,current:{version:1,seed:7,id:'bank-7',mode:'practice',status:'ready',activeMs:0,remainderMs:0,x:6000,guardX:w.guardStart,facing:w.guardFacing,energy:100000,alarm:0,peakAlarm:0,key:false,door:false,bag:false,useMs:0,command:3,nextDecisionMs:0,decisions:0,hidden:false,visible:false,blocked:false,strategy:'',draft:'',outcome:null,eventSerial:0,events:[]},history:[]};
 const body={expectedAccountId:a.id,expectedRevision:0,snapshot};assert.equal((await request(service,'POST',body,a.cookies)).status,200);
 for(const version of [1,2]){
  const old={format:'loopuff-save',version,data:Object.fromEntries(Object.entries(snapshot.data).slice(0,version===1?4:5))};
  const matching=await request(service,'POST',{...body,expectedRevision:1,snapshot:old},a.cookies);assert.equal(matching.status,400);assert.equal((await matching.json()).error.code,'SAVE_VERSION');
  assert.equal((await request(service,'POST',{...body,snapshot:old},a.cookies)).status,409);
 }
 const saved=await (await request(service,'GET',null,a.cookies)).json();assert.equal(saved.revision,1);assert.deepEqual(saved.snapshot,snapshot);
});
test('progress requires an account and rejects foreign origins or unknown write fields',async t=>{
 const service=await serviceFor(t);
 assert.equal((await request(service,'GET')).status,401);
 assert.equal((await request(service,'POST',{},'',{Origin:'https://foreign.invalid'})).status,403);
 assert.equal((await request(service,'DELETE')).status,405);
 const a=await account(service,'progress-a');
 const input={expectedAccountId:a.id,expectedRevision:0,snapshot:emptySave()};
 assert.equal((await request(service,'POST',{...input,userId:'someone-else'},a.cookies)).status,400);
 const initial=await (await request(service,'GET',null,a.cookies)).json();
 assert.equal(initial.account.id,a.id);assert.equal(initial.revision,0);assert.equal(initial.snapshot,null);
});
test('progress writes use both account identity and compare-and-swap revisions',async t=>{
 const service=await serviceFor(t),a=await account(service,'progress-a'),b=await account(service,'progress-b');
 const input={expectedAccountId:a.id,expectedRevision:0,snapshot:emptySave()};
 const written=await request(service,'POST',input,a.cookies);assert.equal(written.status,200);assert.equal((await written.json()).revision,1);
 const conflict=await request(service,'POST',input,a.cookies);assert.equal(conflict.status,409);assert.equal((await conflict.json()).error.code,'SAVE_CONFLICT');
 // B may have exactly the same revision. A's old preview still cannot write into B.
 await request(service,'POST',{...input,expectedAccountId:b.id},b.cookies);
 const switched=await request(service,'POST',{...input,expectedRevision:1},b.cookies);
 assert.equal(switched.status,409);assert.equal((await switched.json()).error.code,'ACCOUNT_CHANGED');
 const saved=emptySave();saved.data.course={lang:'zh',state:{completed:['signal'],guideWork:{signal:'',repeat:'for n in [3,5] { n.log() }'},guideSelected:'repeat'}};
 assert.equal((await request(service,'POST',{...input,expectedRevision:1,snapshot:saved},a.cookies)).status,200);
 const readA=await (await request(service,'GET',null,a.cookies)).json(),readB=await (await request(service,'GET',null,b.cookies)).json();
 assert.equal(readA.revision,2);assert.deepEqual(readA.snapshot,saved);assert.equal(readB.revision,1);assert.deepEqual(readB.snapshot,emptySave());
});
test('invalid or oversized progress cannot replace an existing snapshot',async t=>{
 const service=await serviceFor(t),a=await account(service,'progress-a'),input={expectedAccountId:a.id,expectedRevision:0,snapshot:emptySave()};
 await request(service,'POST',input,a.cookies);
 assert.equal((await request(service,'POST',{...input,expectedRevision:1,snapshot:{...emptySave(),version:4}},a.cookies)).status,400);
 assert.equal((await request(service,'POST',{...input,expectedRevision:1},a.cookies,{'Content-Length':'999999'})).status,413);
 const final=await (await request(service,'GET',null,a.cookies)).json();assert.equal(final.revision,1);assert.deepEqual(final.snapshot,emptySave());
});
test('saved progress and the same account session survive service restart',async t=>{
 const folder=await mkdtemp(join(tmpdir(),'loopuff-progress-'));t.after(()=>rm(folder,{recursive:true,force:true}));
 const databasePath=join(folder,'accounts.sqlite');let service=await createAccountService({databasePath,baseURL,secret});
 const a=await account(service,'progress-persist'),snapshot=emptySave();snapshot.data.course={state:{completed:['signal']}};
 await request(service,'POST',{expectedAccountId:a.id,expectedRevision:0,snapshot},a.cookies);service.close();
 service=await createAccountService({databasePath,baseURL,secret});t.after(()=>service.close());
 const response=await request(service,'GET',null,a.cookies);assert.equal(response.status,200);const result=await response.json();assert.equal(result.revision,1);assert.deepEqual(result.snapshot,snapshot);
});

test('v1 cloud writes migrate safely and cannot erase a pursuit even with the current revision',async t=>{
 const service=await serviceFor(t),a=await account(service,'progress-v2');
 const legacy={format:'loopuff-save',version:1,data:{course:null,vault:null,chase:null,dispatch:null}},input={expectedAccountId:a.id,expectedRevision:0,snapshot:legacy};
 assert.equal((await request(service,'POST',input,a.cookies)).status,200);
 const migrated=await (await request(service,'GET',null,a.cookies)).json();assert.equal(migrated.revision,1);assert.equal(migrated.snapshot.version,3);assert.equal(migrated.snapshot.data.pursuit,null);
 const actor=road=>({road,section:0,distance:0,path:0,direction:1,energy:100,delayMs:0,jumpMs:0,cooldownMs:0,recoverJump:false,pendingJump:false,obstacle:0,collected:[],travelled:0,collisions:0,clears:0});
 const snapshot=emptySave();snapshot.data.pursuit={version:1,current:{version:1,seed:7,id:'test-7',role:'police',difficulty:'standard',status:'ready',activeMs:0,remainderMs:0,nextRoute:0,actors:{police:actor('police'),thief:actor('thief')},strategy:'1.log()',draft:'1.log()',queue:[],mode:1,nextDecisionMs:0,events:[],eventSerial:0,outcome:null},history:[]};
 assert.equal((await request(service,'POST',{...input,expectedRevision:1,snapshot},a.cookies)).status,200);
 const refused=await request(service,'POST',{...input,expectedRevision:2},a.cookies);assert.equal(refused.status,400);assert.equal((await refused.json()).error.code,'SAVE_VERSION');
 assert.equal((await request(service,'POST',{...input,expectedRevision:1},a.cookies)).status,409);
 const final=await (await request(service,'GET',null,a.cookies)).json();assert.equal(final.revision,2);assert.deepEqual(final.snapshot,snapshot);
});

test('old v2 writers cannot erase diagnostic work through missing course, state or diagnostic fields',async t=>{
 const service=await serviceFor(t),a=await account(service,'progress-diagnostic');
 const ids=['names','branch','repeat','counter','function','reply','message','join','coordination'];
 const diagnostic={version:1,seed:42,selected:'names',drafts:Object.fromEntries(ids.map(id=>[id,id==='names'?'(cargo+reserve).log()':''])),submitted:Object.fromEntries(ids.map(id=>[id,null])),hints:Object.fromEntries(ids.map(id=>[id,id==='names'?1:0]))};
 const snapshot=emptySave();snapshot.data.course={state:{completed:['signal'],diagnostic}};
 const input={expectedAccountId:a.id,expectedRevision:0,snapshot};assert.equal((await request(service,'POST',input,a.cookies)).status,200);
 for(const course of [null,{}, {state:{}}, {state:{completed:['signal']}}]){
  const old=emptySave();old.data.course=course;
  const refused=await request(service,'POST',{...input,expectedRevision:1,snapshot:old},a.cookies);assert.equal(refused.status,400);assert.equal((await refused.json()).error.code,'SAVE_VERSION');
  assert.equal((await request(service,'POST',{...input,snapshot:old},a.cookies)).status,409);
 }
 let current=await (await request(service,'GET',null,a.cookies)).json();assert.equal(current.revision,1);assert.deepEqual(current.snapshot,snapshot);
 const updated=structuredClone(snapshot);updated.data.course.state.diagnostic.seed=43;updated.data.course.state.diagnostic.hints.names=0;
 assert.equal((await request(service,'POST',{...input,expectedRevision:1,snapshot:updated},a.cookies)).status,200);
 current=await (await request(service,'GET',null,a.cookies)).json();assert.equal(current.revision,2);assert.deepEqual(current.snapshot,updated);
});
