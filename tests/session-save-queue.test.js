import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeistSession,heistKey} from '../src/heist-session.js';
import {createPursuitSession,pursuitKey} from '../src/pursuit-session.js';
for(const [name,create,key]of [['heist',createHeistSession,heistKey],['pursuit',createPursuitSession,pursuitKey]]){
 test(`${name}: a save requested as the previous write completes is included in its returned promise`,async()=>{
  const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};let release,writes=0;
  const access={write(operation){if(++writes===1)return new Promise(resolve=>{release=()=>{operation();resolve();};});operation();return Promise.resolve();}};
  const session=create({storage,access});session.world.draft='first';const first=session.persist();release();let last;
  queueMicrotask(()=>{session.world.draft='latest';last=session.persist();});await first;await last;
  assert.equal(JSON.parse(values.get(key)).current.draft,'latest');assert.equal(writes,2);assert.equal(session.saveFailed,false);
 });
 test(`${name}: an observer failure is reported and cannot strand the next save`,async()=>{
  const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},errors=[];
  const original=Object.getOwnPropertyDescriptor(globalThis,'reportError');Object.defineProperty(globalThis,'reportError',{configurable:true,value:error=>errors.push(error)});
  try{const session=create({storage,access:{write:async operation=>operation()}});let off=()=>{};off=session.subscribe(()=>{off();throw Error('view failed');});
   session.world.draft='first';assert.equal(await session.persist(),true);session.world.draft='next';assert.equal(await session.persist(),true);
   assert.equal(JSON.parse(values.get(key)).current.draft,'next');assert.equal(errors.length,1);assert.equal(errors[0].message,'view failed');
  }finally{if(original)Object.defineProperty(globalThis,'reportError',original);else delete globalThis.reportError;}
 });
}
