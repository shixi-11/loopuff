import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountClient} from '../src/account.js';
import {routeUrl,languageUrl,parseRoute} from '../src/routing.js';
test('account routes and endpoint retain the official game prefix',async()=>{
 for(const prefix of ['', '/games/loopuff']){
  const url=`https://example.com${prefix}/zh/account/`;
  assert.deepEqual(parseRoute(new URL(url).pathname),{locale:'zh',view:'account'});
  assert.equal(languageUrl(url,'ar').pathname,`${prefix}/ar/account/`);
  assert.equal(routeUrl(url,'en','account').pathname,`${prefix}/en/account/`);
  let called;const client=createAccountClient({url,fetchImpl:async(endpoint,options)=>{called={endpoint,options};return Response.json({available:true,user:null});}});
  await client.load();assert.equal(called.endpoint.pathname,`${prefix}/api/account/`);assert.equal(called.options.credentials,'same-origin');assert.equal(client.available,true);assert.equal(client.user,null);
 }
});
test('account client clears credentials after successful register and logout',async()=>{
 const calls=[];const client=createAccountClient({url:'https://example.com/en/',fetchImpl:async(_url,options)=>{const body=JSON.parse(options.body);calls.push(body);return Response.json(body.action==='logout'?{user:null}:{user:{id:'pilot',email:'pilot@example.com'}});}});
 client.form.email='pilot@example.com';client.form.mode='register';client.form.password='test-only-password';
 await client.signIn();assert.equal(calls[0].action,'sign-up');assert.equal(client.user.id,'pilot');assert.equal(client.form.password,'');
 await client.logout();assert.equal(client.user,null);assert.equal(client.form.email,'');
});
test('failed credentials do not become logged-in state',async()=>{
 const client=createAccountClient({url:'https://example.com/en/',fetchImpl:async()=>Response.json({error:{code:'AUTH_FAILED'}},{status:401})});
 await assert.rejects(client.signIn(),error=>error.code==='AUTH_FAILED');assert.equal(client.user,null);
});
