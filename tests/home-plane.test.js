import {test} from 'node:test';
import assert from 'node:assert/strict';
import {landPlane,mountHomePlane} from '../src/home-plane.js';

const bounds={left:0,right:600,top:0,bottom:620};
const inside=(p,b,w,h)=>!!p&&p.x-w/2>=b.left&&p.x+w/2<=b.right&&p.y-h/2>=b.top&&p.y+h/2<=b.bottom;
const clear=(p,obstacles,w,h,gap=12)=>!!p&&obstacles.every(r=>p.x+w/2+gap<=r.left||p.x-w/2-gap>=r.right||p.y+h/2+gap<=r.top||p.y-h/2-gap>=r.bottom);

test('the complete plane stays inside the field after an out-of-range request',()=>{
 const p=landPlane({x:900,y:-20},bounds,[],100,140);
 assert.deepEqual(p,{x:550,y:70});assert.ok(inside(p,bounds,100,140));
});
test('dropping over an obstacle finds the nearest clear edge',()=>{
 const obstacle={left:200,right:400,top:280,bottom:340};
 const p=landPlane({x:300,y:300},bounds,[obstacle],100,100);
 assert.deepEqual(p,{x:300,y:218});assert.ok(clear(p,[obstacle],100,100));
});
test('a fully blocked field and a field smaller than the aircraft have no legal point',()=>{
 const fieldBounds={left:0,right:100,top:0,bottom:100};
 assert.equal(landPlane({x:50,y:50},fieldBounds,[{left:-20,right:120,top:-20,bottom:120}],40,40),null);
 assert.equal(landPlane({x:50,y:50},{left:0,right:39,top:0,bottom:100},[],40,40),null);
 assert.equal(landPlane({x:50,y:50},{left:0,right:100,top:0,bottom:39},[],40,40),null);
});
test('no legal point is returned when obstacles cover all possible positions',()=>{
 const obstacles=[{left:-100,right:700,top:-100,bottom:250},{left:-100,right:700,top:250,bottom:800}];
 assert.equal(landPlane({x:300,y:300},bounds,obstacles,80,80),null);
});

class Element{
 constructor(rect={left:0,top:0,right:0,bottom:0}){this.rect=rect;this.style={};this.hidden=false;this.dataset={};this.listeners={};}
 getBoundingClientRect(){const left=Number.parseFloat(this.style.left),top=Number.parseFloat(this.style.top);if(Number.isFinite(left)&&Number.isFinite(top)){const w=this.rect.right-this.rect.left,h=this.rect.bottom-this.rect.top;return {left:this.parent.rect.left+left-w/2,top:this.parent.rect.top+top-h/2,right:this.parent.rect.left+left+w/2,bottom:this.parent.rect.top+top+h/2,width:w,height:h};}return {...this.rect,width:this.rect.right-this.rect.left,height:this.rect.bottom-this.rect.top};}
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
 fire(type,event={}){for(const fn of this.listeners[type]??[])fn({preventDefault(){},...event});}
 setPointerCapture(){}
}
function setup({fieldWidth=600,fieldHeight=500,obstacles=[]}={}){
 const field=new Element({left:120,top:210,right:120+fieldWidth,bottom:210+fieldHeight});field.clientWidth=fieldWidth;field.clientHeight=fieldHeight;field.obstacles=obstacles;
 field.querySelectorAll=()=>field.obstacles;
 const button=new Element({left:0,top:0,right:80,bottom:60});button.parent=field;
 const slot=new Element({left:field.rect.left+300,top:field.rect.top+230,right:field.rect.left+340,bottom:field.rect.top+270});
 const controller=mountHomePlane(field,button,slot);return {field,button,slot,controller};
}
function assertLegal({field,controller},obstacles){const p=controller.position;const w=80,h=60;const b={left:12,right:field.clientWidth-12,top:12,bottom:field.clientHeight-12};const local=obstacles.map(e=>{const r=e.getBoundingClientRect();return {left:r.left-field.rect.left,right:r.right-field.rect.left,top:r.top-field.rect.top,bottom:r.bottom-field.rect.top};});assert.ok(inside(p,b,w,h),'plane must stay inside the flight field');assert.ok(clear(p,local,w,h),'plane must clear every marked obstacle');}

test('mount uses the flight field origin and keeps the initial position clear',()=>{
 const obstacles=[{get hidden(){return false;},getBoundingClientRect(){return {left:120,top:310,right:720,bottom:710};}}];
 const mounted=setup({obstacles});mounted.controller.refresh();assertLegal(mounted,obstacles);
 assert.ok(mounted.controller.position.y<190,'placement must use the field top rather than the page masthead');
});
test('every pointer movement is constrained and avoids marked obstacles',()=>{
 const obstacles=[{hidden:false,getBoundingClientRect(){return {left:320,top:350,right:500,bottom:430};}}];
 const mounted=setup({obstacles});mounted.controller.refresh();
 mounted.button.fire('pointerdown',{button:0,pointerId:1,clientX:320,clientY:440});
 for(const [x,y] of [[340,420],[380,400],[430,380],[900,-100],[250,460],[400,410]]){
  mounted.button.fire('pointermove',{pointerId:1,clientX:x,clientY:y});assertLegal(mounted,obstacles);
 }
 mounted.button.fire('pointerup',{pointerId:1});assertLegal(mounted,obstacles);
});
test('keyboard moves cannot enter obstacles or leave the field',()=>{
 const obstacles=[{hidden:false,getBoundingClientRect(){return {left:320,top:350,right:500,bottom:430};}}];
 const mounted=setup({obstacles});mounted.controller.refresh();
 for(let i=0;i<20;i++){mounted.button.fire('keydown',{key:'ArrowRight'});assertLegal(mounted,obstacles);}
 for(let i=0;i<20;i++){mounted.button.fire('keydown',{key:'ArrowDown'});assertLegal(mounted,obstacles);}
});
test('an undersized field hides the plane instead of falling back onto the slot',()=>{
 const mounted=setup({fieldWidth:60,fieldHeight:50});mounted.controller.refresh();
 assert.equal(mounted.controller.position,null);assert.equal(mounted.button.style.visibility,'hidden');
});
test('the plane reappears inside the field after a temporary size constraint is removed',()=>{
 const mounted=setup();mounted.controller.refresh();assertLegal(mounted,[]);
 mounted.field.clientWidth=60;mounted.field.clientHeight=50;
 mounted.field.rect.right=mounted.field.rect.left+60;mounted.field.rect.bottom=mounted.field.rect.top+50;
 mounted.controller.refresh();
 assert.equal(mounted.controller.position,null);assert.equal(mounted.button.style.visibility,'hidden');
 mounted.field.clientWidth=600;mounted.field.clientHeight=500;
 mounted.field.rect.right=mounted.field.rect.left+600;mounted.field.rect.bottom=mounted.field.rect.top+500;
 mounted.controller.refresh();
 assert.ok(mounted.controller.position);assert.notEqual(mounted.button.style.visibility,'hidden');assertLegal(mounted,[]);
});
