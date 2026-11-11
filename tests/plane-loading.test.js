import test from 'node:test';
import assert from 'node:assert/strict';
test('importing the common plane module does not download unused artwork',async t=>{
 const previous=globalThis.Image;let created=0;
 globalThis.Image=class{constructor(){created++;}addEventListener(){}removeEventListener(){}};
 t.after(()=>{if(previous===undefined)delete globalThis.Image;else globalThis.Image=previous;});
 const plane=await import('../src/plane.js?lazy-test');assert.equal(created,0);
 plane.whenPlaneReady(()=>{});assert.equal(created,1);plane.whenPlaneReady(()=>{});assert.equal(created,1);
});
