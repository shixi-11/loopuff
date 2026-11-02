import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudProgress} from '../src/cloud-progress.js';
import {createProgressRelay} from '../api/progress.js';
import {emptySave} from '../server/save-format.mjs';
const result=(id='a',revision=1)=>({account:{id,email:id+'@example.invalid'},revision,updatedAt:10,snapshot:emptySave()});
test('cloud requests use the same host prefix and an account-bound base revision',async()=>{
 let sent;
 const client=createCloudProgress({url:'https://shixilin.com/games/loopuff/zh/',getAccount:()=>({id:'a'}),fetchImpl:async(url,options)=>{sent={url:String(url),options};return Response.json(result('a',options.method==='POST'?2:1));}});
 const base=await client.read();await client.write(emptySave(),base);
 assert.equal(sent.url,'https://shixilin.com/games/loopuff/api/progress/');assert.equal(sent.options.credentials,'same-origin');
 assert.deepEqual(JSON.parse(sent.options.body),{expectedAccountId:'a',expectedRevision:1,snapshot:emptySave()});
});
test('account switches discard stale responses and cannot reuse another account base',async()=>{
 let account={id:'a'},resolve;
 const client=createCloudProgress({url:'https://example.com/zh/',getAccount:()=>account,fetchImpl:()=>new Promise(done=>resolve=done)});
 const loading=client.read();account={id:'b'};client.reset();resolve(Response.json(result('a')));
 await assert.rejects(loading,e=>e.code==='ACCOUNT_CHANGED');
 await assert.rejects(client.write(emptySave(),result('a')),e=>e.code==='ACCOUNT_CHANGED');
});
test('an interrupted cloud write is unconfirmed and never silently retried',async()=>{
 let calls=0;const client=createCloudProgress({url:'https://example.com/',getAccount:()=>({id:'a'}),fetchImpl:async()=>{calls++;throw Error('offline');}});
 await assert.rejects(client.write(emptySave(),result()),e=>e.code==='SAVE_UNCONFIRMED');assert.equal(calls,1);
});
test('an upstream commit with a lost relay reply remains unconfirmed to the browser',async()=>{
 let commits=0;
 const relay=createProgressRelay({fetchImpl:async()=>{commits++;throw Error('reset after commit');}});
 const client=createCloudProgress({url:'https://example.com/',getAccount:()=>({id:'a'}),fetchImpl:async(url,options)=>{
  const response={setHeader(){},getHeader(){},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};
  await relay({method:options.method,headers:{origin:'https://shixilin.com'},body:options.body},response);
  return Response.json(response.body,{status:response.statusCode});
 }});
 await assert.rejects(client.write(emptySave(),result()),e=>e.code==='SAVE_UNCONFIRMED');assert.equal(commits,1);
});
test('a successful write receipt must advance exactly one revision',async()=>{
 for(const revision of [0,1,999]){
  const client=createCloudProgress({url:'https://example.com/',getAccount:()=>({id:'a'}),fetchImpl:async()=>Response.json(result('a',revision))});
  await assert.rejects(client.write(emptySave(),result()),e=>e.code==='SAVE_UNCONFIRMED');
 }
});
test('cancelling a live request while switching accounts does not present its reply as current',async()=>{
 let actor={id:'a'};
 const client=createCloudProgress({url:'https://example.com/',getAccount:()=>actor,fetchImpl:async(url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted'))))});
 const pending=client.read();actor={id:'b'};client.reset();await assert.rejects(pending,e=>e.code==='ACCOUNT_CHANGED');
});
test('progress relay keeps unrelated cookies and provider fields out of the response',async()=>{
 const relay=createProgressRelay({fetchImpl:async(url,options)=>{
  assert.equal(url,'https://games.tail1291c2.ts.net/loopuff/api/progress');assert.equal(options.headers.Cookie,'loopuff.session_token=ok');
  return Response.json({...result(),token:'private',account:{...result().account,password:'private'}},{headers:{'Set-Cookie':'loopuff.session_token=next; Path=/; HttpOnly'}});
 }});
 const response={headers:{},setHeader(k,v){this.headers[k]=v;},getHeader(k){return this.headers[k];},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};
 await relay({method:'GET',headers:{cookie:'other=secret; loopuff.session_token=ok'}},response);
 assert.equal(response.statusCode,200);assert.deepEqual(response.body,result());assert.equal(response.headers['Set-Cookie'].length,1);
});
