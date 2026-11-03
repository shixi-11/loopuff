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
  const all=await loadChaseAssets();assert.ok(all.police&&all.thief&&all.props&&all.street);assert.equal(validateChaseArt(all),all);assert.equal(requests.length,8);assert.equal(await loadChaseActors(),actors);
 }finally{globalThis.fetch=oldFetch;if(oldImage)Object.defineProperty(globalThis,'Image',oldImage);else delete globalThis.Image;}
});
