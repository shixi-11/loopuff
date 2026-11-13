import test from 'node:test';
import assert from 'node:assert/strict';
import {districtBuildings,districtPosition,districtClear,districtStep,districtCamera,districtPoint,districtShopAt,districtNear,districtPath} from '../src/district.js';
import {mountDistrict} from '../src/district-ui.js';
import {districtCatalog,districtSigns} from '../src/district-catalog.js';

function node(){return {handlers:new Map(),style:{},dataset:{},className:'',hidden:false,textContent:'',addEventListener(k,v){this.handlers.set(k,v);},removeEventListener(k,v){if(this.handlers.get(k)===v)this.handlers.delete(k);},setAttribute(k,v){this.attributes??={};this.attributes[k]=String(v);},getAttribute(k){return this.attributes?.[k];},focus(){this.focused=true;},contains(value){return value===this||this.childNodes?.includes(value);}};}
function fixture(model={},width=480,{autoLoad=true}={}){
 const queue=new Map(),images=[],intersections=[];let next=0,cancelled=0,disconnects=0;
 const win={...node(),devicePixelRatio:1,getComputedStyle(){return {getPropertyValue(){return 'system-ui';}}},requestAnimationFrame(fn){queue.set(++next,fn);return next;},cancelAnimationFrame(id){cancelled++;queue.delete(id);},ResizeObserver:class{observe(){}disconnect(){disconnects++;}},IntersectionObserver:class{constructor(callback){this.callback=callback;this.disconnected=false;intersections.push(this);}observe(){}disconnect(){this.disconnected=true;}},Image:class{constructor(){Object.assign(this,node());this.naturalWidth=0;images.push(this);}set src(value){this._src=value;}get src(){return this._src;}}};
 const doc={...node(),defaultView:win,hidden:false,documentElement:{dir:'ltr'},fonts:{ready:Promise.resolve()}},canvas=node(),stage=node(),loading=node(),status=node(),links=node(),root=node(),draws=[];
 canvas.getContext=()=>new Proxy({},{get:(_,key)=>(...args)=>draws.push([key,...args]),set:(_,key,value)=>{draws.push(['property',key,value]);return true;}});
 canvas.getBoundingClientRect=()=>({left:10,top:20,width,height:parseFloat(canvas.style.height)});root.getBoundingClientRect=()=>({width});root.ownerDocument=doc;root.childNodes=[stage,canvas,status,links];
 root.querySelector=selector=>({canvas,stage,status,links,'.district-stage':stage,'.district-loading':loading,'.district-near':status,'.district-shops':links}[selector]??null);
 stage.dataset={ready:'false'};stage.setAttribute('aria-busy','true');stage.childNodes=[canvas,loading];links.childNodes=[];
 const entered=[],shops=districtCatalog.map(item=>({id:item.id,title:item.id,era:item.era,accent:item.accent})),text={title:'街区',intro:'走走看看',move:'方向键行走',enter:'Enter进店',near:'进入{name}',shops:'商店',loading:'载入中',unavailable:'暂时无法载入'};
 const view=mountDistrict(root,{text,shops,model,onEnter:id=>entered.push(id)});
 links.childNodes=shops.map((shop,index)=>{const button=node();button.dataset={districtShop:String(index)};button.parent=links;button.closest=selector=>selector==='[data-district-shop]'?button:null;return button;});
 root.contains=value=>value===root||value===canvas||value===stage||value===links||links.childNodes.includes(value);
 const completeImages=(widthValue=1536)=>{for(const image of images){image.naturalWidth=widthValue;image.handlers.get('load')?.();}};
 if(autoLoad)completeImages();
 const frame=now=>{assert.ok(queue.size,'expected a scheduled frame');const [id,fn]=queue.entries().next().value;queue.delete(id);fn(now);draws.length=0;};
 const key=value=>({key:value,target:canvas,preventDefault(){}});
 const clickShop=index=>root.handlers.get('click')({target:links.childNodes[index]});
 return {win,doc,canvas,stage,loading,status,links,root,model,view,queue,entered,draws,frame,images,intersections,key,clickShop,completeImages,get cancelled(){return cancelled;},get disconnects(){return disconnects;}};
}

test('eight solid buildings occupy two rows; keyboard movement slides without crossing walls or world bounds',()=>{
 assert.equal(districtBuildings.length,8);assert.equal(districtBuildings[0].y,200);assert.equal(districtBuildings[4].y,710);
 assert.deepEqual(districtPosition({x:-100,y:10}),{x:90,y:180});assert.deepEqual(districtPosition({x:9999,y:9999}),{x:1830,y:1190});
 const p={x:120,y:350},slid=districtStep(p,{x:1,y:1},.05);assert.equal(slid.x,120);assert.ok(slid.y>300);assert.ok(districtClear(slid));
 let walked={x:320,y:620};for(let i=0;i<200;i++)walked=districtStep(walked,{x:0,y:-1},.05);assert.ok(walked.y>=572);assert.ok(districtClear(walked));assert.ok(districtClear(districtPosition({x:240,y:250})));
});
test('BFS walks around buildings between both rows and every travelled segment is collision-free',()=>{
 const start={x:320,y:600},end={x:320,y:1120},route=districtPath(start,end);assert.ok(route.length>10);assert.ok(route.some(p=>p.x>=525||p.x<=120));assert.deepEqual(route.at(-1),end);
 let previous=start;for(const point of route){const length=Math.hypot(point.x-previous.x,point.y-previous.y),steps=Math.max(1,Math.ceil(length/3));for(let i=0;i<=steps;i++){const t=i/steps;assert.ok(districtClear({x:previous.x+(point.x-previous.x)*t,y:previous.y+(point.y-previous.y)*t}));}previous=point;}
 assert.deepEqual(districtPath(start,{x:240,y:800}),[]);assert.equal(districtShopAt({x:755,y:850}),5);assert.equal(districtShopAt({x:540,y:640}),-1);assert.equal(districtNear({x:320,y:600}),0);assert.equal(districtNear({x:320,y:1120}),4);
});
test('camera mapping and catalogue ordering cover the two-row district',()=>{
 assert.deepEqual(districtCamera(1800,1200,800,600),{x:1120,y:680});assert.deepEqual(districtCamera(900,600,1920,1280),{x:0,y:0});
 assert.deepEqual(districtPoint({x:110,y:170},{left:10,top:20,width:400,height:200},{x:720,y:400},{width:1280,height:640}),{x:1040,y:880});
 assert.deepEqual(districtCatalog.map(item=>item.id),['snake','breakout','blocks','tanks','flight','sokoban','heist','chase']);
});
test('roaming is always enabled on entry and manual input pauses then resumes after three seconds',()=>{
 const f=fixture({roaming:false});assert.equal(f.model.roaming,true);let reachedBottom=false;
 for(let i=0;i<1800;i++){f.frame(i*50);assert.ok(districtClear(f.model));reachedBottom ||= f.model.y>=1000;if(f.model.walk>1000)break;}
 assert.ok(reachedBottom);assert.deepEqual(f.entered,[]);f.root.handlers.get('keydown')(f.key('d'));assert.equal(f.model.roaming,false);f.doc.handlers.get('keyup')(f.key('d'));const x=f.model.x;
 f.frame(100000);assert.equal(f.model.x,x);for(let i=1;i<=62;i++)f.frame(100000+i*50);assert.equal(f.model.roaming,true);f.view.dispose();
});
test('automatic roaming reaches all eight doorway stops without entering shops',()=>{
 const f=fixture(),visited=new Set();
 try{
  for(let i=0;i<4000&&visited.size<8;i++){f.frame(i*50);assert.ok(districtClear(f.model));for(const [index,building] of districtBuildings.entries())if(Math.hypot(f.model.x-building.doorX,f.model.y-building.doorY-40)<12)visited.add(index);}
  assert.deepEqual([...visited].sort((a,b)=>a-b),[0,1,2,3,4,5,6,7]);assert.deepEqual(f.entered,[]);
 }finally{f.view.dispose();}
});
test('pending background or signs draw no fallback and become ready only after both images load',()=>{
 const f=fixture({},480,{autoLoad:false});assert.equal(f.stage.getAttribute('aria-busy'),'true');assert.equal(f.draws.some(call=>['fillRect','fillText','drawImage'].includes(call[0])),false);
 f.images[0].naturalWidth=1536;f.images[0].handlers.get('load')();assert.equal(f.stage.getAttribute('aria-busy'),'true');assert.equal(f.draws.some(call=>['fillRect','fillText','drawImage'].includes(call[0])),false);
 f.images[1].naturalWidth=1536;f.images[1].handlers.get('load')();assert.equal(f.stage.getAttribute('aria-busy'),'false');assert.equal(f.draws.some(call=>call[0]==='drawImage'),true);f.view.dispose();
});
test('image failure exposes usable text links instead of drawing simplified buildings',()=>{
 const f=fixture({},480,{autoLoad:false}),image=f.images[0];image.handlers.get('error')();assert.equal(f.stage.dataset.ready,'false');assert.equal(f.loading.hidden,false);assert.equal(f.links.className,'district-shops');assert.equal(f.draws.some(call=>['fillRect','fillText','drawImage'].includes(call[0])),false);f.clickShop(2);assert.deepEqual(f.entered,['blocks']);f.view.dispose();
});
test('all eight signs follow shop ids rather than their physical positions',()=>{
 const f=fixture({},960);for(const item of districtCatalog){const sign=districtSigns[item.id];const call=f.draws.find(entry=>entry[0]==='drawImage'&&entry[1]===f.images[sign.image==='signs'?1:0]&&entry[2]===sign.rect[0]&&entry[3]===sign.rect[1]);assert.ok(call,`sign ${item.id} uses its catalog crop`);}f.view.dispose();
});
test('offscreen pause and disposal remove all active work',()=>{
 const f=fixture(),before=f.model.walk;f.doc.hidden=true;f.doc.handlers.get('visibilitychange')();assert.equal(f.queue.size,0);f.doc.hidden=false;f.doc.handlers.get('visibilitychange')();f.intersections[0].callback([{target:f.canvas,isIntersecting:false}]);assert.equal(f.queue.size,0);f.intersections[0].callback([{target:f.canvas,isIntersecting:true}]);f.view.dispose();f.view.dispose();assert.equal(f.intersections[0].disconnected,true);assert.equal(f.queue.size,0);assert.ok(f.model.walk>=before);for(const el of [f.root,f.canvas,f.doc,f.win,...f.images])assert.equal(el.handlers.size,0);
});
