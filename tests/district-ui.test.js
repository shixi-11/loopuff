import test from 'node:test';
import assert from 'node:assert/strict';
import {districtBuildings,districtPosition,districtClear,districtStep,districtCamera,districtPoint,districtShopAt,districtNear,districtPath} from '../src/district.js';
import {mountDistrict} from '../src/district-ui.js';
function node(){return {handlers:new Map(),style:{},dataset:{},textContent:'',addEventListener(k,v){this.handlers.set(k,v);},removeEventListener(k,v){if(this.handlers.get(k)===v)this.handlers.delete(k);},setAttribute(){},focus(){this.focused=true;},contains(){return true;}};}
function fixture(model={},width=480){
 const queue=new Map(),images=[],intersections=[];let next=0,cancelled=0,disconnects=0;
 const win={...node(),devicePixelRatio:1,requestAnimationFrame(fn){queue.set(++next,fn);return next;},cancelAnimationFrame(id){cancelled++;queue.delete(id);},ResizeObserver:class{observe(){}disconnect(){disconnects++;}},IntersectionObserver:class{constructor(callback){this.callback=callback;this.disconnected=false;intersections.push(this);}observe(){}disconnect(){this.disconnected=true;}},Image:class{constructor(){Object.assign(this,node());this.naturalWidth=0;images.push(this);}}};
 const doc={...node(),defaultView:win,hidden:false},canvas=node(),status=node(),roam=node(),root=node(),draws=[];
 canvas.getContext=()=>new Proxy({},{get:(_,key)=>(...args)=>draws.push([key,...args]),set:(_,key,value)=>{draws.push(['property',key,value]);return true;}});
 canvas.getBoundingClientRect=()=>({left:10,top:20,width,height:parseFloat(canvas.style.height)});root.getBoundingClientRect=()=>({width});
 root.ownerDocument=doc;root.querySelector=selector=>selector==='canvas'?canvas:selector==='[data-district-roam]'?roam:status;
 const entered=[],shops=['blocks','tanks','flight','start','snake','breakout','sokoban','map'].map((id,i)=>({id,title:id,era:i<3?'1980s':'TOLANG'})),text={title:'街区',intro:'走走看看',move:'方向键行走',enter:'Enter进店',near:'进入{name}',shops:'商店',autoWalk:'自动散步',manualWalk:'手动行走'};
 const view=mountDistrict(root,{text,shops,model,onEnter:id=>entered.push(id)});
 const frame=now=>{assert.ok(queue.size);const [id,fn]=queue.entries().next().value;queue.delete(id);fn(now);draws.length=0;};
 const key=value=>({key:value,target:canvas,preventDefault(){}});
 const clickShop=index=>root.handlers.get('click')({target:{closest:selector=>selector==='[data-district-shop]'?{dataset:{districtShop:String(index)}}:null}});
 const toggle=()=>root.handlers.get('click')({target:{closest:selector=>selector==='[data-district-roam]'?{}:null}});
 return {win,doc,canvas,status,root,model,view,queue,entered,draws,frame,images,intersections,key,clickShop,toggle,get cancelled(){return cancelled;},get disconnects(){return disconnects;}};
}
test('eight solid buildings occupy two rows; keyboard movement slides without crossing walls or world bounds',()=>{
 assert.equal(districtBuildings.length,8);assert.equal(districtBuildings[0].y,200);assert.equal(districtBuildings[4].y,710);
 assert.deepEqual(districtPosition({x:-100,y:10}),{x:90,y:180});assert.deepEqual(districtPosition({x:9999,y:9999}),{x:1830,y:1190});
 const p={x:120,y:350},slid=districtStep(p,{x:1,y:1},.05);assert.equal(slid.x,120);assert.ok(slid.y>300);assert.ok(districtClear(slid));
 let walked={x:320,y:620};for(let i=0;i<200;i++)walked=districtStep(walked,{x:0,y:-1},.05);assert.ok(walked.y>=572);assert.ok(districtClear(walked));
 assert.ok(districtClear(districtPosition({x:240,y:250})),'old positions inside new buildings recover onto a road');
});
test('BFS walks around buildings between both rows and every travelled segment is collision-free',()=>{
 const start={x:320,y:600},end={x:320,y:1120},route=districtPath(start,end);assert.ok(route.length>10);assert.ok(route.some(p=>p.x>=525||p.x<=120),'route uses a side alley instead of crossing the lower building');assert.deepEqual(route.at(-1),end);
 let previous=start;for(const point of route){const length=Math.hypot(point.x-previous.x,point.y-previous.y),steps=Math.max(1,Math.ceil(length/3));for(let i=0;i<=steps;i++){const t=i/steps;assert.ok(districtClear({x:previous.x+(point.x-previous.x)*t,y:previous.y+(point.y-previous.y)*t}));}previous=point;}
 assert.deepEqual(districtPath(start,{x:240,y:800}),[]);assert.equal(districtShopAt({x:755,y:850}),5);assert.equal(districtShopAt({x:540,y:640}),-1);assert.equal(districtNear({x:320,y:600}),0);assert.equal(districtNear({x:320,y:1120}),4);
});
test('camera and click mapping follow both axes on mobile while desktop shows the whole two-row world',()=>{
 assert.deepEqual(districtCamera(1800,1200,800,600),{x:1120,y:680});assert.deepEqual(districtCamera(900,600,1920,1280),{x:0,y:0});
 assert.deepEqual(districtPoint({x:110,y:170},{left:10,top:20,width:400,height:200},{x:720,y:400},{width:1280,height:640}),{x:1040,y:880});
 const desktop=fixture({roaming:false},960);assert.equal(desktop.canvas.style.height,'640px');assert.ok(desktop.root.innerHTML.includes('aria-label="商店"'));assert.equal((desktop.root.innerHTML.match(/data-district-shop=/g)||[]).length,8);desktop.clickShop(6);desktop.clickShop(7);assert.deepEqual(desktop.entered,['sokoban','map']);desktop.clickShop(8);assert.deepEqual(desktop.entered,['sokoban','map']);desktop.view.dispose();
 const mobile=fixture({x:320,y:600,roaming:false});mobile.root.handlers.get('keydown')(mobile.key('Enter'));assert.deepEqual(mobile.entered,['blocks']);
 // 480px viewport uses scale .5; world camera y=82. Hit lower second building (755,800).
 const camera=districtCamera(320,600,960,816),rect=mobile.canvas.getBoundingClientRect();mobile.canvas.handlers.get('pointerdown')({button:0,clientX:rect.left+755*.5,clientY:rect.top+(800-camera.y)*.5,preventDefault(){}});assert.deepEqual(mobile.entered,['blocks','breakout']);mobile.view.dispose();
});
test('automatic roaming moves through both rows without entering shops; manual input stops it and toggle restarts it',()=>{
 const f=fixture();assert.equal(f.model.roaming,true);let reachedBottom=false;
 for(let i=0;i<800;i++){f.frame(i*50);assert.ok(districtClear(f.model));reachedBottom ||= f.model.y>=1000;}
 assert.ok(reachedBottom);assert.ok(f.model.walk>1000);assert.deepEqual(f.entered,[]);
 f.root.handlers.get('keydown')(f.key('d'));assert.equal(f.model.roaming,false);f.frame(40000);f.doc.handlers.get('keyup')(f.key('d'));const x=f.model.x;f.frame(40050);assert.equal(f.model.x,x);f.toggle();assert.equal(f.model.roaming,true);f.view.dispose();
});

test('automatic roaming reaches the doorway stops of all eight shops without entering any',()=>{
 const f=fixture(),visited=new Set();
 try{
  for(let i=0;i<4000&&visited.size<8;i++){
   f.frame(i*50);assert.ok(districtClear(f.model));
   for(const [index,building]of districtBuildings.entries())if(Math.hypot(f.model.x-building.doorX,f.model.y-building.doorY-40)<12)visited.add(index);
  }
  assert.deepEqual([...visited].sort((a,b)=>a-b),[0,1,2,3,4,5,6,7]);
  assert.deepEqual(f.entered,[]);
 }finally{f.view.dispose();}
});
test('road clicks disable roaming and use a route; background pauses and disposal cancels all work',()=>{
 const f=fixture({x:320,y:600}),rect=f.canvas.getBoundingClientRect(),camera=districtCamera(320,600,960,816);
 // Click the open central intersection rather than a shop.
 f.canvas.handlers.get('pointerdown')({button:0,clientX:rect.left+540*.5,clientY:rect.top+(640-camera.y)*.5,preventDefault(){}});assert.equal(f.model.roaming,false);f.frame(0);f.frame(50);assert.ok(f.model.walk>0);const before={x:f.model.x,y:f.model.y};
 f.doc.hidden=true;f.doc.handlers.get('visibilitychange')();assert.equal(f.queue.size,0);assert.deepEqual({x:f.model.x,y:f.model.y},before);f.doc.hidden=false;f.doc.handlers.get('visibilitychange')();f.frame(100000);assert.deepEqual({x:f.model.x,y:f.model.y},before,'no catch-up after returning');
 f.intersections[0].callback([{target:f.canvas,isIntersecting:false}]);assert.equal(f.queue.size,0);const outside={x:f.model.x,y:f.model.y};f.intersections[0].callback([{target:f.canvas,isIntersecting:true}]);f.frame(200000);assert.deepEqual({x:f.model.x,y:f.model.y},outside,'no catch-up when scrolled back into view');f.view.dispose();f.view.dispose();assert.equal(f.intersections[0].disconnected,true);assert.equal(f.queue.size,0);assert.equal(f.disconnects,1);for(const el of [f.root,f.canvas,f.doc,f.win,...f.images])assert.equal(el.handlers.size,0);assert.ok(f.cancelled>=2);
});
test('image failure leaves the two-row fallback interactive; image success redraws and no late listeners survive',()=>{
 const f=fixture(),image=f.images[0];assert.ok(image.src.includes('/assets/pixel-district.webp?v=eight-stores-20261113'));assert.ok(f.draws.some(c=>c[0]==='fillRect'&&c[3]===1920&&c[4]===1280));image.handlers.get('error')();f.frame(0);f.frame(50);assert.ok(f.model.walk>0);image.naturalWidth=1920;f.draws.length=0;image.handlers.get('load')();assert.ok(f.draws.some(c=>c[0]==='drawImage'&&c[4]===1920&&c[5]===1280));assert.ok(f.draws.some(c=>c[0]==='fillText'&&c[1]==='1980s'),'era comes from the supplied shop');assert.ok(!f.draws.some(c=>c[0]==='translate'&&c[1]===320&&c[2]===266),'loaded artwork receives no replacement shop icon');assert.ok(!f.draws.some(c=>c[0]==='fillRect'&&c[1]===297&&c[2]===500&&c[3]===46&&c[4]===60),'loaded artwork receives no replacement door');f.clickShop(7);assert.deepEqual(f.entered,['map']);f.view.dispose();assert.equal(image.handlers.size,0);
});

test('fallback signs follow blocks, tanks, flight, start, snake, breakout, sokoban and map street order',()=>{
 const f=fixture({roaming:false},960);
 try{
  // The eight silhouettes identify six games, the code terminal and the map.
  const firstRects=[[-16,0,6,6],[-16,-4,32,12],[-4,-16,8,32],[-16,-12,32,24],[-16,4,8,8],[-16,-16,6,4],[-12,-12,24,24],[-16,-12,32,24]];
  const colors=['#e2ba73','#8ed4b1','#8db8e0','#bc9cdb','#8ed4b1','#e2ba73','#bc9cdb','#c9d88b'];
  for(const [i,building]of districtBuildings.entries()){
   const at=f.draws.findIndex(draw=>draw[0]==='translate'&&draw[1]===building.doorX&&draw[2]===building.y+66);
   assert.ok(at>=0,`fallback icon ${i} exists`);
   assert.deepEqual(f.draws[at+1],['property','fillStyle',colors[i]]);
   const rectangle=f.draws.slice(at+1).find(draw=>draw[0]==='fillRect');
   assert.deepEqual(rectangle.slice(1),firstRects[i]);
  }
 }finally{f.view.dispose();}
});

test('shop captions keep full CSS-size glyphs after the map scale, without compressed text',()=>{
 const f=fixture();const calls=f.draws,lastScale=calls.findLastIndex(c=>c[0]==='scale');
 const labels=calls.slice(lastScale+1).filter(c=>c[0]==='fillText');assert.ok(labels.length>0);assert.ok(labels.every(c=>c.length===4),'no maxWidth resampling');
 assert.ok(calls.some(c=>c[0]==='property'&&c[1]==='font'&&c[2]==='14px system-ui, sans-serif'));
 assert.ok(calls.some(c=>c[0]==='fillRect'&&c[4]===54),'caption reserves vertical glyph padding');f.view.dispose();
});

test('updated game signs reuse generated textures while the approved eight-shop background stays the base',()=>{
 const f=fixture(),base=f.images[0],sign=f.images[1];assert.ok(sign.src.endsWith('/assets/pixel-game-signs.webp'));
 base.naturalWidth=1536;base.handlers.get('load')();sign.naturalWidth=1536;f.draws.length=0;sign.handlers.get('load')();
 assert.ok(f.draws.some(c=>c[0]==='drawImage'&&c[1]===base&&c.length===6),'whole approved scene');
 assert.equal(f.draws.filter(c=>c[0]==='drawImage'&&c[1]===sign).length,2,'only snake and brick-breaking sign screens');
 assert.ok(f.draws.some(c=>c[0]==='drawImage'&&c[1]===base&&c.length===10),'crate sign is reused for box pushing');
 f.view.dispose();assert.equal(sign.handlers.size,0);
});
