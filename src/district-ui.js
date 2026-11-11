import {districtSize,districtBuildings,districtPosition,districtStep,districtCamera,districtPoint,districtShopAt,districtNear,districtPath} from './district.js';
const backgroundUrl=new URL('../assets/pixel-district.webp',import.meta.url).href;
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const keyDirection={ArrowLeft:[-1,0],a:[-1,0],ArrowRight:[1,0],d:[1,0],ArrowUp:[0,-1],w:[0,-1],ArrowDown:[0,1],s:[0,1]};
const palettes=['#e2ba73','#8ed4b1','#8db8e0','#bc9cdb','#d8b484','#82bfc0','#d49699','#a5bc80'];
function icon(ctx,index,x,y){
 ctx.save();ctx.translate(x,y);ctx.fillStyle=palettes[index];
 const pixel=(a,b,w=1,h=1)=>ctx.fillRect(a*4,b*4,w*4,h*4);
 if(index===0){pixel(-3,-2,2,2);pixel(-1,-2,2,2);pixel(-1,0,2,2);pixel(1,0,2,2);}
 else if(index===1){pixel(-4,-2,2,5);pixel(2,-2,2,5);pixel(-2,-1,4,3);pixel(-1,-4,2,4);}
 else if(index===2){pixel(-1,-4,2,8);pixel(-4,0,8,2);pixel(-2,3,4,1);}
 else if(index===3){pixel(-4,-3,8,6);ctx.fillStyle='#182532';pixel(-2,-1,4,2);ctx.fillStyle=palettes[index];pixel(0,-2,1,4);}
 else if(index===4){pixel(-4,-1,8,3);pixel(-2,-3,4,2);pixel(-3,2,2,1);pixel(2,2,2,1);}
 else if(index===5){pixel(-4,-3,3,3);pixel(1,0,3,3);pixel(-1,-1,3,1);pixel(0,0,1,2);}
 else if(index===6){pixel(-3,-2,6,5);pixel(-2,-4,4,2);ctx.fillStyle='#182532';pixel(-1,-1,2,2);}
 else{pixel(-4,2,3,1);pixel(1,-1,3,1);pixel(-1,-4,2,2);pixel(-2,-2,4,1);}
 ctx.restore();
}
// Whole integer pixels: hood, face, both hands, torso, legs and feet.
function hacker(ctx,model,moving){
 const x=Math.round(model.x),y=Math.round(model.y),stride=moving?Math.floor(model.walk/6)%2:0;
 ctx.save();ctx.translate(x,y);if(model.facing<0)ctx.scale(-1,1);
 ctx.fillStyle='#0b111c';ctx.fillRect(-16,-52,32,24);ctx.fillRect(-20,-44,40,24);ctx.fillRect(-12,-28,24,28);
 ctx.fillStyle='#34424d';ctx.fillRect(-12,-48,24,4);ctx.fillRect(-16,-44,4,20);ctx.fillRect(12,-44,4,20);
 ctx.fillStyle='#121d29';ctx.fillRect(-12,-40,24,16);ctx.fillStyle='#d5e9da';ctx.fillRect(-8,-36,4,4);ctx.fillRect(4,-36,4,4);
 ctx.fillStyle='#25313e';ctx.fillRect(-12,-24,24,20);ctx.fillRect(-20,-24,8,16);ctx.fillRect(12,-24,8,16);
 ctx.fillStyle='#abb6b4';ctx.fillRect(-20,-8,8,4);ctx.fillRect(12,-8,8,4);
 ctx.fillStyle='#d2ac63';ctx.fillRect(4,-20,4,4);ctx.fillStyle='#101824';ctx.fillRect(-12,-4,8,12-stride*4);ctx.fillRect(4,-4,8,8+stride*4);
 ctx.fillStyle='#53616a';ctx.fillRect(-16,4-stride*4,12,4);ctx.fillRect(4,4+stride*4,12,4);ctx.restore();
}
function fallback(ctx){
 ctx.fillStyle='#233745';ctx.fillRect(0,0,1920,1280);ctx.fillStyle='#344a55';
 for(let x=0;x<1920;x+=80)for(let y=0;y<1280;y+=80)ctx.fillRect(x,y,76,76);
 for(let i=0;i<8;i++){const b=districtBuildings[i];ctx.fillStyle='#101c2b';ctx.fillRect(b.x+14,b.y+14,b.w,b.h);ctx.fillStyle=i%2?'#293447':'#263e4b';ctx.fillRect(b.x,b.y,b.w,b.h);ctx.fillStyle='#101d2b';ctx.fillRect(b.x+20,b.y+114,b.w-40,136);ctx.fillStyle='#4a616a';ctx.fillRect(b.x-8,b.y+b.h-8,b.w+16,8);ctx.fillStyle=palettes[i];ctx.fillRect(b.x,b.y,b.w,12);for(let j=0;j<5;j++)ctx.fillRect(b.x+28+j*56,b.y+44,24,28);}
 ctx.fillStyle='#788681';for(let x=80;x<1920;x+=120){ctx.fillRect(x,580,48,4);ctx.fillRect(x,1140,48,4);}
}
export function mountDistrict(root,{text:t,shops,model={},onEnter}){
 const entries=shops.slice(0,8),doc=root.ownerDocument||document,win=doc.defaultView||window;
 Object.assign(model,districtPosition(model));model.facing=model.facing===-1?-1:1;model.walk=Number.isFinite(model.walk)?model.walk:0;model.roaming=model.roaming!==false;
 root.innerHTML=`<section class="pixel-district"><header><h2>${esc(t.title)}</h2><p>${esc(t.intro)}</p></header><canvas class="district-canvas" tabindex="0" role="img" aria-label="${esc(t.move+' '+t.enter)}" style="display:block;width:100%;touch-action:pan-y;outline-offset:4px"></canvas><p class="district-instructions">${esc(t.move)} ${esc(t.enter)}</p><button type="button" class="district-roam" data-district-roam aria-pressed="${model.roaming}">${esc(model.roaming?t.manualWalk:t.autoWalk)}</button><p class="district-near" role="status" aria-live="polite"></p><nav class="district-shops" aria-label="${esc(t.shops)}">${entries.map((shop,index)=>`<button type="button" data-district-shop="${index}">${esc(shop.title)}</button>`).join('')}</nav></section>`;
 const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d'),status=root.querySelector('.district-near'),roamButton=root.querySelector('[data-district-roam]');
 let disposed=false,visible=true,raf=null,last=null,keys=new Set(),route=[],camera={x:0,y:0},viewport={width:1920,height:1280},scale=1,pixelRatio=1,near=-2,image=null,imageReady=false,observer=null,intersection=null,roamIndex=0;
 const stops=[0,4,1,5,2,6,3,7].map(i=>({x:districtBuildings[i].doorX,y:districtBuildings[i].doorY+40})).concat([{x:480,y:560},{x:960,y:1100},{x:1440,y:560}]);
 function roaming(value){model.roaming=value;route=[];keys.clear();roamButton.textContent=value?t.manualWalk:t.autoWalk;roamButton.setAttribute('aria-pressed',String(value));}
 function enter(index){if(!disposed&&entries[index])onEnter(entries[index].id);}
 function draw(){
  if(disposed||!visible||!ctx)return;
  ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);ctx.clearRect(0,0,canvas.width/pixelRatio,canvas.height/pixelRatio);ctx.scale(scale,scale);ctx.translate(-camera.x,-camera.y);ctx.imageSmoothingEnabled=false;
  if(imageReady)ctx.drawImage(image,0,0,1920,1280);else fallback(ctx);
  const current=districtNear(model,entries.length);
  for(let i=0;i<entries.length;i++){
   const b=districtBuildings[i],x=b.doorX,y=b.doorY;
   // Keep every approved coloured shop sign and doorway intact when art loads.
   if(!imageReady){icon(ctx,i,x,b.y+66);ctx.fillStyle='#101c2a';ctx.fillRect(x-23,y-60,46,60);ctx.fillStyle=palettes[i];ctx.fillRect(x-25,y-64,50,4);ctx.fillRect(x-27,y-64,4,64);ctx.fillRect(x+23,y-64,4,64);}
   ctx.fillStyle='#0c1d2bdc';ctx.fillRect(x-145,y+24,290,entries[i].era?72:48);ctx.fillStyle=palettes[i];ctx.font='bold 22px system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.direction=doc.documentElement?.dir==='rtl'?'rtl':'ltr';ctx.fillText(entries[i].title,x,y+48,274);
   if(entries[i].era){ctx.font='14px system-ui, sans-serif';ctx.fillStyle='#d3d9d8';ctx.fillText(entries[i].era,x,y+78,274);}
   if(current===i){ctx.fillStyle='#ead39c';ctx.fillRect(x-22,y+12,44,4);ctx.fillRect(x-14,y+18,28,4);}
  }
  hacker(ctx,model,keys.size>0||route.length>0);
  if(current!==near){near=current;status.textContent=near>=0?t.near.replace('{name}',entries[near].title):'';}
 }
 function resize(){
  if(disposed)return;const width=Math.max(1,root.getBoundingClientRect().width||640),height=width>=800?width*2/3:Math.max(320,width*.85);
  canvas.style.height=height+'px';pixelRatio=Math.min(2,win.devicePixelRatio||1);canvas.width=Math.round(width*pixelRatio);canvas.height=Math.round(height*pixelRatio);scale=width>=800?width/1920:width/Math.min(960,Math.max(640,width*2));viewport={width:width/scale,height:Math.min(1280,height/scale)};camera=districtCamera(model.x,model.y,viewport.width,viewport.height);draw();
 }
 function schedule(){if(!disposed&&visible&&!doc.hidden&&raf===null)raf=win.requestAnimationFrame(frame);}
 function frame(now){
  raf=null;if(disposed||!visible||doc.hidden){last=null;return;}
  const dt=last===null?0:Math.min(.05,Math.max(0,(now-last)/1000));last=now;
  let dx=0,dy=0;for(const key of keys){const d=keyDirection[key];if(d){dx+=d[0];dy+=d[1];}}
  if(dx||dy)route=[];
  else{
   if(!route.length&&model.roaming){for(let i=0;i<stops.length&&!route.length;i++){route=districtPath(model,stops[roamIndex%stops.length]);roamIndex++;}}
   if(route.length){const point=route[0],distance=Math.hypot(point.x-model.x,point.y-model.y);dx=point.x-model.x;dy=point.y-model.y;if(distance<=180*dt){dx=dt?dx/(180*dt):0;dy=dt?dy/(180*dt):0;route.shift();}else{dx/=distance;dy/=distance;}}
  }
  const before={x:model.x,y:model.y};Object.assign(model,districtStep(model,{x:dx,y:dy},dt));
  const moved=Math.hypot(model.x-before.x,model.y-before.y);if(moved){model.walk+=moved;if(dx)model.facing=dx<0?-1:1;}
  camera=districtCamera(model.x,model.y,viewport.width,viewport.height);draw();schedule();
 }
 const key=event=>event.key.length===1?event.key.toLowerCase():event.key;
 function keydown(event){
  if(doc.hidden||event.ctrlKey||event.metaKey||event.altKey||event.target!==canvas)return;
  const value=key(event);if(keyDirection[value]){if(model.roaming)roaming(false);keys.add(value);event.preventDefault();}
  else if(value==='Enter'){event.preventDefault();if(!event.repeat)enter(districtNear(model,entries.length));}
 }
 function keyup(event){keys.delete(key(event));}
 function pointer(event){
  if(doc.hidden||event.button!==0)return;canvas.focus({preventScroll:true});
  const point=districtPoint({x:event.clientX,y:event.clientY},canvas.getBoundingClientRect(),camera,viewport),shop=districtShopAt(point,entries.length);
  roaming(false);if(shop>=0){enter(shop);return;}if(point.y>=0&&point.y<=districtSize.height){route=districtPath(model,point);}event.preventDefault();
 }
 function click(event){const toggle=event.target.closest('[data-district-roam]');if(toggle&&root.contains(toggle)){roaming(!model.roaming);return;}const button=event.target.closest('[data-district-shop]');if(button&&root.contains(button))enter(Number(button.dataset.districtShop));}
 function clear(){keys.clear();last=null;}
 function visibility(){clear();if(doc.hidden){if(raf!==null)win.cancelAnimationFrame(raf);raf=null;}else schedule();}
 function intersectionChanged(records){
  if(disposed)return;const record=records.find(entry=>entry.target===canvas);if(!record)return;visible=record.isIntersecting;clear();
  if(!visible){if(raf!==null)win.cancelAnimationFrame(raf);raf=null;}else{draw();schedule();}
 }
 function loaded(){if(disposed)return;imageReady=image.naturalWidth>0;draw();}
 function failed(){imageReady=false;if(!disposed)draw();}
 root.addEventListener('keydown',keydown);root.addEventListener('click',click);canvas.addEventListener('pointerdown',pointer);canvas.addEventListener('blur',clear);doc.addEventListener('keyup',keyup);doc.addEventListener('visibilitychange',visibility);win.addEventListener('blur',clear);
 if(win.ResizeObserver){observer=new win.ResizeObserver(resize);observer.observe(root);}else win.addEventListener('resize',resize);
 if(win.IntersectionObserver){intersection=new win.IntersectionObserver(intersectionChanged);intersection.observe(canvas);}
 if(win.Image){image=new win.Image();image.addEventListener('load',loaded);image.addEventListener('error',failed);image.src=backgroundUrl;}
 resize();schedule();
 return {dispose(){
  if(disposed)return;disposed=true;if(raf!==null)win.cancelAnimationFrame(raf);raf=null;clear();observer?.disconnect();intersection?.disconnect();
  root.removeEventListener('keydown',keydown);root.removeEventListener('click',click);canvas.removeEventListener('pointerdown',pointer);canvas.removeEventListener('blur',clear);doc.removeEventListener('keyup',keyup);doc.removeEventListener('visibilitychange',visibility);win.removeEventListener('blur',clear);if(!observer)win.removeEventListener('resize',resize);image?.removeEventListener('load',loaded);image?.removeEventListener('error',failed);
 }};
}
