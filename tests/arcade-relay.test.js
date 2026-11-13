import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcadeRelay,filterArcade} from '../api/arcade.js';
import {parseRoute,routeUrl,languageUrl} from '../src/routing.js';
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},getHeader(k){return this.headers[k];},status(n){this.statusCode=n;return this;},json(value){this.body=value;return this;}});
test('arcade relay forwards game selection and only Loopuff cookies, never public identities',async()=>{
 const relay=createArcadeRelay({fetchImpl:async(url,options)=>{
  assert.equal(new URL(url).searchParams.get('game'),'snake');assert.equal(options.headers.Cookie,'loopuff.session_token=abc');
  return Response.json({game:'snake',leaderboard:[{rank:1,nickname:'Visitor',score:10,durationMs:20000,won:false,email:'private@invalid',userId:'hidden'}],profile:null,token:'private'});
 }}),res=response();
 await relay({url:'/api/arcade?game=snake',method:'GET',headers:{cookie:'other=secret; loopuff.session_token=abc'}},res);
 assert.equal(res.statusCode,200);assert.deepEqual(Object.keys(res.body.leaderboard[0]),['rank','nickname','score','durationMs','won']);assert.equal(JSON.stringify(res.body).includes('private'),false);
});
test('arcade relay rejects cross-site, oversized and malformed payloads without upstream contact',async()=>{
 let called=0;const relay=createArcadeRelay({fetchImpl:async()=>{called++;throw Error();}});
 for(const [method,origin,body,status]of [['POST','https://evil.invalid','{}',403],['POST','https://shixilin.com','x'.repeat(2*1024*1024+1),413],['POST','https://shixilin.com','{',400],['DELETE',undefined,'',405]]){
  const res=response();await relay({method,headers:{origin},body},res);assert.equal(res.statusCode,status);
 }assert.equal(called,0);
 assert.throws(()=>filterArcade({profile:{nickname:'x',coins:-1,achievements:[]}}));
});
test('leaderboard has normal locale routes and preserves game selection when switching language',()=>{
 const source='https://shixilin.com/games/loopuff/zh/leaderboard/?game=flight';
 assert.deepEqual(parseRoute(new URL(source).pathname),{locale:'zh',view:'leaderboard'});
 assert.equal(routeUrl(source,'en','leaderboard').pathname,'/games/loopuff/en/leaderboard/');
 assert.equal(languageUrl(source,'en').searchParams.get('game'),'flight');
});
