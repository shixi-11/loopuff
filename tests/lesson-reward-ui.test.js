import test from 'node:test';
import assert from 'node:assert/strict';
import {mountLessonReward} from '../src/lesson-reward-ui.js';
const text={coins:'Stars',rewardSaving:'Saving',claimed:'Claimed',rewardError:'Retry reward',rules:['First pass: 10'],login:'Sign in',signIn:'Sign in',retry:'Retry',claimReward:'Claim',title:'Board'};
const root=()=>({innerHTML:'',listeners:{},addEventListener(k,v){this.listeners[k]=v;},removeEventListener(k){delete this.listeners[k];}});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('lesson reward displays only the server receipt and sends the actual submitted program',async()=>{
 const el=root(),account={user:{id:'a'}};let done,request;
 const view=mountLessonReward(el,{account,text,lessonId:'branch',source:'if true then {1.log()}',client:{claim:(...args)=>{request=args;return new Promise(r=>done=r);}},accountUrl:'/account',boardUrl:'/leaderboard'});
 assert.deepEqual(request,['branch','if true then {1.log()}']);assert.ok(!el.innerHTML.includes('+10'));
 done({awarded:0});await flush();assert.match(el.innerHTML,/Claimed · \+0 Stars/);view.dispose();
});
test('failed rewards keep a retry action and an account change cannot show the previous receipt',async()=>{
 const el=root(),account={user:{id:'a'}};let settle,calls=0;
 const view=mountLessonReward(el,{account,text,lessonId:'signal',source:'7.log()',client:{claim:()=>{calls++;return calls===1?Promise.reject(Error('network')):new Promise(r=>settle=r);}},accountUrl:'/account',boardUrl:'/leaderboard'});
 await flush();assert.match(el.innerHTML,/Retry reward/);assert.match(el.innerHTML,/>Retry<\/button>/);
 el.listeners.click({target:{closest:()=>true}});account.user={id:'b'};view.refresh();settle({awarded:10});await flush();assert.ok(!el.innerHTML.includes('+10'));view.dispose();
});
