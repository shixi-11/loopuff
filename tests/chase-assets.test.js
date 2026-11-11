import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadChaseActors,loadChaseAssets,validateChaseArt} from '../src/chase-scene.js';
test('bank loads only its two actors; full chase keeps its complete validated artwork',async()=>{
 const atlas=JSON.parse(fs.readFileSync(new URL('../public/assets/chase-sprites.json',import.meta.url),'utf8')),requests=[],oldFetch=globalThis.fetch,oldImage=Object.getOwnPropertyDescriptor(globalThis,'Image');
 globalThis.fetch=async url=>{requests.push(String(url));return {ok:true,json:async()=>atlas};};
 class TestImage{set src(value){if(!value)return;requests.push(String(value));const kind=value.match(/chase-(police|thief|props|street)\.webp/)[1];this.width=atlas[kind]?.width||100;this.height=atlas[kind]?.height||100;queueMicrotask(()=>this.onload());}}
 Object.defineProperty(globalThis,'Image',{configurable:true,value:TestImage});
 try{
  const actors=await loadChaseActors();assert.ok(actors.police&&actors.thief);assert.equal(actors.props,undefined);assert.equal(actors.street,undefined);assert.equal(requests.length,3);assert.ok(!requests.some(s=>/chase-(?:street|props)/.test(s)));assert.throws(()=>validateChaseArt(actors));assert.equal(await loadChaseActors(),actors);assert.equal(requests.length,3);
  const all=await loadChaseAssets();assert.ok(all.police&&all.thief&&all.props&&all.street);assert.equal(validateChaseArt(all),all);assert.equal(requests.length,5,'full scene reuses the atlas and two actors');assert.equal(await loadChaseActors(),actors);
 }finally{globalThis.fetch=oldFetch;if(oldImage)Object.defineProperty(globalThis,'Image',oldImage);else delete globalThis.Image;}
});

test('simultaneous scene consumers share requests, and retry preserves successful resources',async t=>{
 const {loadChaseActors:actors,loadChaseAssets:full}=await import('../src/chase-scene.js?shared-retry');
 const atlas=JSON.parse(fs.readFileSync(new URL('../public/assets/chase-sprites.json',import.meta.url),'utf8')),requests=[],oldFetch=globalThis.fetch,oldImage=Object.getOwnPropertyDescriptor(globalThis,'Image');let fail=true;
 globalThis.fetch=async url=>{requests.push(String(url));return {ok:true,json:async()=>atlas};};
 Object.defineProperty(globalThis,'Image',{configurable:true,value:class{set src(value){if(!value)return;requests.push(String(value));const kind=value.match(/chase-(police|thief|props|street)\.webp/)[1];this.width=atlas[kind]?.width||100;this.height=atlas[kind]?.height||100;queueMicrotask(()=>{if(kind==='props'&&fail)this.onerror?.();else this.onload?.();});}}});
 t.after(()=>{globalThis.fetch=oldFetch;if(oldImage)Object.defineProperty(globalThis,'Image',oldImage);else delete globalThis.Image;});
 const first=await Promise.allSettled([actors(),full()]);assert.equal(first[0].status,'fulfilled');assert.equal(first[1].status,'rejected');assert.equal(requests.length,5);
 fail=false;const complete=await full();assert.equal(validateChaseArt(complete),complete);assert.equal(requests.length,6,'only the failed props image is requested again');assert.equal(complete.police,first[0].value.police);
});

test('a failed full scene does not cancel actors still needed by another consumer',async t=>{
 const {loadChaseActors:actors,loadChaseAssets:full}=await import('../src/chase-scene.js?shared-pending');
 const atlas=JSON.parse(fs.readFileSync(new URL('../public/assets/chase-sprites.json',import.meta.url),'utf8')),pending=[],oldFetch=globalThis.fetch,oldImage=Object.getOwnPropertyDescriptor(globalThis,'Image');let cancelled=0;
 globalThis.fetch=async()=>({ok:true,json:async()=>atlas});
 Object.defineProperty(globalThis,'Image',{configurable:true,value:class{set src(value){if(!value){if(this.kind==='police'||this.kind==='thief')cancelled++;return;}const kind=value.match(/chase-(police|thief|props|street)\.webp/)[1];this.kind=kind;this.width=atlas[kind]?.width||100;this.height=atlas[kind]?.height||100;if(kind==='props')queueMicrotask(()=>this.onerror?.());else if(kind==='street')queueMicrotask(()=>this.onload?.());else pending.push(()=>this.onload?.());}}});
 t.after(()=>{globalThis.fetch=oldFetch;if(oldImage)Object.defineProperty(globalThis,'Image',oldImage);else delete globalThis.Image;});
 const waiting=actors();await assert.rejects(full());assert.equal(cancelled,0,'shared pending actors must survive the unrelated props failure');
 for(const finish of pending)finish();assert.ok((await waiting).police);
});
