import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountRelay} from '../api/account.js';
function response(){return {headers:{},statusCode:0,setHeader(k,v){this.headers[k]=v;},getHeader(k){return this.headers[k];},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};}
test('relay rejects cross-site and oversized requests before contacting the Mac',async()=>{
 let calls=0;const handler=createAccountRelay({fetchImpl:()=>{calls++;}});
 for(const [origin,body,status] of [['https://evil.invalid','{}',403],['https://shixilin.com',JSON.stringify({password:'a'.repeat(5000)}),413]]){
  const res=response();await handler({method:'POST',headers:{origin},body},res);assert.equal(res.statusCode,status);
 }assert.equal(calls,0);
});
test('relay forwards only Loopuff cookies and strips provider tokens from results',async()=>{
 const handler=createAccountRelay({fetchImpl:async(url,options)=>{
  assert.equal(url,'https://games.tail1291c2.ts.net/loopuff/api/account');
  assert.equal(options.headers.Cookie,'loopuff.session_token=abc');
  return Response.json({user:{id:'pilot',email:'pilot@example.com',secret:'private'},token:'never expose'}, {headers:{'Set-Cookie':'loopuff.session_token=new; Path=/; Secure; HttpOnly; SameSite=Lax'}});
 }});
 const res=response();await handler({method:'GET',headers:{cookie:'other_account=private; loopuff.session_token=abc'}},res);
 assert.deepEqual(res.body,{available:true,user:{id:'pilot',email:'pilot@example.com'}});
 assert.equal(res.headers['Set-Cookie'].length,1);assert.equal(res.headers['Cache-Control'],'private, no-store');
});
test('an unreachable Mac gives a retryable error, never a fake login',async()=>{
 const handler=createAccountRelay({fetchImpl:async()=>{throw Error('offline')}}),res=response();
 await handler({method:'GET',headers:{}},res);assert.equal(res.statusCode,503);assert.equal(res.body.user,null);assert.equal(res.body.error.code,'AUTH_UNAVAILABLE');
});
