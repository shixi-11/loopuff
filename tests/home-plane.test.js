import {test} from 'node:test';
import assert from 'node:assert/strict';
import {landPlane} from '../src/home-plane.js';
const bounds={left:0,right:600,top:80,bottom:700};
test('the complete plane stays inside the playfield',()=>{
 assert.deepEqual(landPlane({x:900,y:-20},bounds,[],100,140),{x:550,y:150});
});
test('dropping over a control lands at the nearest clear edge',()=>{
 const obstacle={left:200,right:400,top:280,bottom:340};
 assert.deepEqual(landPlane({x:300,y:300},bounds,[obstacle],100,100),{x:300,y:218});
});
test('landing avoids multiple overlapping reading areas',()=>{
 const obstacles=[{left:100,right:500,top:100,bottom:400},{left:150,right:450,top:390,bottom:510}];
 const p=landPlane({x:300,y:300},bounds,obstacles,120,140);
 assert.ok(p);
 assert.ok(obstacles.every(r=>p.x+60+12<=r.left||p.x-60-12>=r.right||p.y+70+12<=r.top||p.y-70-12>=r.bottom));
});
