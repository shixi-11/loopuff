// Choose the closest clear landing position, including the full aircraft footprint.
export function landPlane(point, bounds, obstacles, width, height, gap=12){
 const halfW=width/2,halfH=height/2;
 const limit=(value,min,max)=>Math.max(min,Math.min(max,value));
 const clamp=p=>({x:limit(p.x,bounds.left+halfW,bounds.right-halfW),y:limit(p.y,bounds.top+halfH,bounds.bottom-halfH)});
 const clear=p=>obstacles.every(r=>p.x+halfW+gap<=r.left||p.x-halfW-gap>=r.right||p.y+halfH+gap<=r.top||p.y-halfH-gap>=r.bottom);
 const start=clamp(point);
 if(clear(start))return start;
 const xs=[start.x,bounds.left+halfW,bounds.right-halfW,...obstacles.flatMap(r=>[r.left-halfW-gap,r.right+halfW+gap])];
 const ys=[start.y,bounds.top+halfH,bounds.bottom-halfH,...obstacles.flatMap(r=>[r.top-halfH-gap,r.bottom+halfH+gap])];
 let best=null,distance=Infinity;
 for(const x of xs)for(const y of ys){const p=clamp({x,y}),d=(p.x-point.x)**2+(p.y-point.y)**2;if(clear(p)&&d<distance){best=p;distance=d;}}
 return best;
}

export function mountHomePlane(world,button,slot){
 let position=null,relative=null,geometry=null,drag=null;
 const localRect=element=>{const r=element.getBoundingClientRect(),w=world.getBoundingClientRect();return {left:r.left-w.left,right:r.right-w.left,top:r.top-w.top,bottom:r.bottom-w.top};};
 function place(p){position=p;button.style.left=p.x+'px';button.style.top=p.y+'px';}
 function refresh(){
  if(button.hidden||world.hidden)return;
  const w=world.getBoundingClientRect(),s=localRect(slot),b=button.getBoundingClientRect(),header=document.querySelector('.masthead').getBoundingClientRect();
  geometry={width:b.width,height:b.height,bounds:{left:12,right:w.width-12,top:header.bottom-w.top+12,bottom:w.height-16},obstacles:[...world.querySelectorAll('.welcome .eyebrow,.welcome h1,.welcome-copy,.welcome-actions,.first-command,#welcome-foot')].filter(e=>!e.hidden).map(localRect)};
  const home={x:(s.left+s.right)/2,y:(s.top+s.bottom)/2};
  const wanted=relative?{x:relative.x*w.width,y:relative.y*w.height}:home;
  place(landPlane(wanted,geometry.bounds,geometry.obstacles,b.width,b.height)||home);
 }
 function settle(){
  if(!geometry||!position)return;
  const p=landPlane(position,geometry.bounds,geometry.obstacles,geometry.width,geometry.height);
  if(p)place(p);else{relative=null;refresh();}
  relative={x:position.x/world.clientWidth,y:position.y/world.clientHeight};
 }
 button.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;
  refresh();drag={id:event.pointerId,x:event.clientX,y:event.clientY,origin:{...position}};
  button.setPointerCapture(event.pointerId);button.dataset.dragging='true';event.preventDefault();
 });
 button.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.id)return;
  const {bounds,width,height}=geometry;
  place({x:Math.max(bounds.left+width/2,Math.min(bounds.right-width/2,drag.origin.x+event.clientX-drag.x)),y:Math.max(bounds.top+height/2,Math.min(bounds.bottom-height/2,drag.origin.y+event.clientY-drag.y))});
 });
 function release(event){if(!drag||event.pointerId!==drag.id)return;drag=null;delete button.dataset.dragging;settle();}
 button.addEventListener('pointerup',release);
 button.addEventListener('pointercancel',release);
 button.addEventListener('lostpointercapture',release);
 button.addEventListener('keydown',event=>{
  if(event.key==='Home'||event.key==='Enter'){event.preventDefault();relative=null;refresh();return;}
  const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
  if(!delta)return;
  event.preventDefault();const step=event.shiftKey?48:24;
  place({x:position.x+delta[0]*step,y:position.y+delta[1]*step});settle();
 });
 button.addEventListener('dblclick',()=>{relative=null;refresh();});
 return {refresh,get position(){return position;},get dragging(){return !!drag;}};
}
