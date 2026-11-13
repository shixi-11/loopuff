import {districtSize,districtBuildings,districtPosition,districtStep,districtCamera,districtPoint,districtShopAt,districtNear,districtPath} from './district.js';
import {districtSigns} from './district-catalog.js';
const backgroundUrl=new URL('../assets/pixel-district.webp?v=eight-stores-20261113',import.meta.url).href;
const signsUrl=new URL('../assets/pixel-game-signs.webp',import.meta.url).href;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const keyDirection={ArrowLeft:[-1,0],a:[-1,0],ArrowRight:[1,0],d:[1,0],ArrowUp:[0,-1],w:[0,-1],ArrowDown:[0,1],s:[0,1]};
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
export function mountDistrict(root,{text:t,shops,model={},onEnter}){
 const entries=shops.slice(0,districtBuildings.length),doc=root.ownerDocument||document,win=doc.defaultView||window;
 Object.assign(model,districtPosition(model));model.facing=model.facing===-1?-1:1;model.walk=Number.isFinite(model.walk)?model.walk:0;model.roaming=true;
 root.innerHTML=`<section class="pixel-district"><div class="district-stage" data-ready="false" aria-busy="true"><canvas class="district-canvas" tabindex="0" role="img" aria-label="${esc(t.move+' '+t.enter)}" style="display:block;width:100%;touch-action:pan-y;outline-offset:4px"></canvas><p class="district-loading" role="status">${esc(t.loading||t.title)}</p></div><p class="district-near sr-only" role="status" aria-live="polite"></p><nav class="district-shops sr-only" aria-label="${esc(t.shops)}">${entries.map((shop,index)=>`<button type="button" data-district-shop="${index}">${esc(shop.title)}</button>`).join('')}</nav></section>`;
 const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d'),status=root.querySelector('.district-near'),stage=root.querySelector('.district-stage'),loading=root.querySelector('.district-loading'),links=root.querySelector('.district-shops');
 let disposed=false,visible=true,raf=null,last=null,keys=new Set(),route=[],camera={x:0,y:0},viewport={width:1920,height:1280},scale=1,pixelRatio=1,near=-2,image=null,imageReady=false,signImage=null,signReady=false,observer=null,intersection=null,roamIndex=0,idle=0;
 const stops=[0,4,1,5,2,6,3,7].filter(i=>i<entries.length).map(i=>({x:districtBuildings[i].doorX,y:districtBuildings[i].doorY+40}));
 const ready=()=>imageReady&&signReady;
 function manual(){model.roaming=false;idle=0;route=[];keys.clear();}
 function enter(index){if(!disposed&&entries[index])onEnter(entries[index].id);}
 function draw(force=false){
  if(disposed||(!visible&&!force)||!ctx||!ready())return;
  ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);ctx.clearRect(0,0,canvas.width/pixelRatio,canvas.height/pixelRatio);ctx.scale(scale,scale);ctx.translate(-camera.x,-camera.y);ctx.imageSmoothingEnabled=false;
  ctx.drawImage(image,0,0,1920,1280);
  // Reorder only the screen textures; the approved eight buildings stay intact.
  for(let i=0;i<entries.length;i++){
   const b=districtBuildings[i],sign=districtSigns[entries[i].id];if(!sign)continue;
   const x=b.doorX-97,y=i<4?300:790;
   ctx.drawImage(sign.image==='signs'?signImage:image,...sign.rect,x,y,194,100);
  }
  const current=districtNear(model,entries.length);
  for(let i=0;i<entries.length;i++)if(current===i){const b=districtBuildings[i];ctx.fillStyle='#ead39c';ctx.fillRect(b.doorX-22,b.doorY+12,44,4);ctx.fillRect(b.doorX-14,b.doorY+18,28,4);}
  hacker(ctx,model,keys.size>0||route.length>0);
  ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.direction=doc.documentElement?.dir==='rtl'?'rtl':'ltr';
  const viewW=canvas.width/pixelRatio,viewH=canvas.height/pixelRatio,display=win.getComputedStyle?.(root).getPropertyValue('--display').trim()||'system-ui';
  for(let i=0;i<entries.length;i++){
   const b=districtBuildings[i],sx=(b.doorX-camera.x)*scale,doorY=(b.doorY-camera.y)*scale;
   if(sx<0||sx>viewW||doorY<0||doorY>viewH)continue;
   const width=Math.min(viewW-16,Math.max(176,b.w*scale-24)),x=Math.round(Math.max(width/2+8,Math.min(viewW-width/2-8,sx))),height=entries[i].era?54:32,y=Math.round(Math.min(viewH-height-4,doorY+8));
   ctx.fillStyle='#0b1a21ed';ctx.fillRect(Math.round(x-width/2),y,Math.round(width),height);ctx.fillStyle=entries[i].accent||'#cfad70';ctx.font='18px '+display;
   const measured=ctx.measureText(entries[i].title)?.width;if(measured>width-16){ctx.font='16px '+display;if(ctx.measureText(entries[i].title)?.width>width-16)ctx.font='14px '+display;}
   ctx.fillText(entries[i].title,x,y+22);
   if(entries[i].era){ctx.font='14px system-ui, sans-serif';ctx.fillStyle='#c7d7cf';ctx.fillText(entries[i].era,x,y+43);}
  }
  if(current!==near){near=current;status.textContent=near>=0?t.near.replace('{name}',entries[near].title):'';}
 }
 function resize(){
  if(disposed)return;const width=Math.max(1,root.getBoundingClientRect().width||640),height=width>=800?width*2/3:Math.max(320,width*.85);
  canvas.style.height=height+'px';pixelRatio=Math.min(2,win.devicePixelRatio||1);canvas.width=Math.round(width*pixelRatio);canvas.height=Math.round(height*pixelRatio);scale=width>=800?width/1920:width/Math.min(960,Math.max(640,width*2));viewport={width:width/scale,height:Math.min(1280,height/scale)};camera=districtCamera(model.x,model.y,viewport.width,viewport.height);draw();
 }
 function schedule(){if(!disposed&&ready()&&visible&&!doc.hidden&&raf===null)raf=win.requestAnimationFrame(frame);}
 function frame(now){
  raf=null;if(disposed||!visible||doc.hidden||!ready()){last=null;return;}
  const dt=last===null?0:Math.min(.05,Math.max(0,(now-last)/1000));last=now;
  let dx=0,dy=0;for(const key of keys){const d=keyDirection[key];if(d){dx+=d[0];dy+=d[1];}}
  if(dx||dy){route=[];idle=0;}
  else{
   if(!model.roaming&&!route.length){idle+=dt;if(idle>=3){model.roaming=true;idle=0;}}
   if(!route.length&&model.roaming){for(let i=0;i<stops.length&&!route.length;i++){route=districtPath(model,stops[roamIndex%stops.length]);roamIndex++;}}
   if(route.length){const point=route[0],distance=Math.hypot(point.x-model.x,point.y-model.y);dx=point.x-model.x;dy=point.y-model.y;if(distance<=180*dt){dx=dt?dx/(180*dt):0;dy=dt?dy/(180*dt):0;route.shift();}else{dx/=distance;dy/=distance;}}
  }
  const before={x:model.x,y:model.y};Object.assign(model,districtStep(model,{x:dx,y:dy},dt));
  const moved=Math.hypot(model.x-before.x,model.y-before.y);if(moved){model.walk+=moved;if(dx)model.facing=dx<0?-1:1;}
  camera=districtCamera(model.x,model.y,viewport.width,viewport.height);draw();schedule();
 }
 const key=event=>event.key.length===1?event.key.toLowerCase():event.key;
 function keydown(event){
  if(doc.hidden||!ready()||event.ctrlKey||event.metaKey||event.altKey||event.target!==canvas)return;
  const value=key(event);if(keyDirection[value]){if(model.roaming)manual();keys.add(value);event.preventDefault();}
  else if(value==='Enter'){event.preventDefault();if(!event.repeat)enter(districtNear(model,entries.length));}
 }
 function keyup(event){keys.delete(key(event));idle=0;}
 function pointer(event){
  if(doc.hidden||!ready()||event.button!==0)return;canvas.focus({preventScroll:true});
  const point=districtPoint({x:event.clientX,y:event.clientY},canvas.getBoundingClientRect(),camera,viewport),shop=districtShopAt(point,entries.length);
  manual();if(shop>=0){enter(shop);return;}if(point.y>=0&&point.y<=districtSize.height)route=districtPath(model,point);event.preventDefault();
 }
 function click(event){const button=event.target.closest('[data-district-shop]');if(button&&root.contains(button))enter(Number(button.dataset.districtShop));}
 function clear(){keys.clear();last=null;idle=0;}
 function visibility(){clear();if(doc.hidden){if(raf!==null)win.cancelAnimationFrame(raf);raf=null;}else schedule();}
 function intersectionChanged(records){
  if(disposed)return;const record=records.find(entry=>entry.target===canvas);if(!record)return;visible=record.isIntersecting;clear();
  if(!visible){if(raf!==null)win.cancelAnimationFrame(raf);raf=null;}else{draw();schedule();}
 }
 function present(){
  if(disposed||!ready())return;draw(true);stage.dataset.ready='true';stage.setAttribute('aria-busy','false');loading.hidden=true;links.className='district-shops sr-only';schedule();
 }
 function failed(){
  if(disposed)return;imageReady=false;signReady=false;if(raf!==null)win.cancelAnimationFrame(raf);raf=null;stage.dataset.ready='false';stage.setAttribute('aria-busy','false');loading.hidden=false;loading.textContent=t.unavailable||t.shops;links.className='district-shops';
 }
 function loaded(){if(disposed)return;imageReady=image.naturalWidth>0;if(imageReady)present();else failed();}
 function signsLoaded(){if(disposed)return;signReady=signImage.naturalWidth>0;if(signReady)present();else failed();}
 root.addEventListener('keydown',keydown);root.addEventListener('click',click);canvas.addEventListener('pointerdown',pointer);canvas.addEventListener('blur',clear);doc.addEventListener('keyup',keyup);doc.addEventListener('visibilitychange',visibility);win.addEventListener('blur',clear);
 if(win.ResizeObserver){observer=new win.ResizeObserver(resize);observer.observe(root);}else win.addEventListener('resize',resize);
 if(win.IntersectionObserver){intersection=new win.IntersectionObserver(intersectionChanged);intersection.observe(canvas);}
 if(win.Image){image=new win.Image();image.decoding='async';image.addEventListener('load',loaded);image.addEventListener('error',failed);image.src=backgroundUrl;signImage=new win.Image();signImage.decoding='async';signImage.addEventListener('load',signsLoaded);signImage.addEventListener('error',failed);signImage.src=signsUrl;}else failed();
 resize();doc.fonts?.ready.then(()=>{if(!disposed)draw();});
 return {dispose(){
  if(disposed)return;disposed=true;if(raf!==null)win.cancelAnimationFrame(raf);raf=null;clear();observer?.disconnect();intersection?.disconnect();
  root.removeEventListener('keydown',keydown);root.removeEventListener('click',click);canvas.removeEventListener('pointerdown',pointer);canvas.removeEventListener('blur',clear);doc.removeEventListener('keyup',keyup);doc.removeEventListener('visibilitychange',visibility);win.removeEventListener('blur',clear);if(!observer)win.removeEventListener('resize',resize);image?.removeEventListener('load',loaded);image?.removeEventListener('error',failed);signImage?.removeEventListener('load',signsLoaded);signImage?.removeEventListener('error',failed);
 }};
}
