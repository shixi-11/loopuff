import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAccountService} from './account-service.mjs';
import {emptySave} from './save-format.mjs';
const origin='http://localhost:8773',baseURL='http://127.0.0.1:8773',secret='test-only-loopuff-cloud-secret-0123456789abcdef';
const cookie=response=>response.headers.getSetCookie().map(item=>item.split(';',1)[0]).join('; ');
const request=(service,method,body,cookies='',extra={})=>service(new Request(baseURL+'/api/progress',{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),Cookie:cookies,...extra},...(body?{body:JSON.stringify(body)}:{})}));
async function account(service,name){
 const response=await service(new Request(baseURL+'/api/account',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action:'sign-up',email:name+'@example.invalid',password:'Progress-test-password-2026'})}));
 assert.equal(response.status,200);const data=await response.json();return {id:data.user.id,cookies:cookie(response)};
}
async function serviceFor(t){const service=await createAccountService({databasePath:':memory:',baseURL,secret});t.after(()=>service.close());return service;}
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
 assert.equal((await request(service,'POST',{...input,expectedRevision:1,snapshot:{...emptySave(),version:2}},a.cookies)).status,400);
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
