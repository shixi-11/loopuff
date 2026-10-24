// Choose the closest clear landing position, including the full aircraft footprint.
export function landPlane(point, bounds, obstacles, width, height, gap=12){
 const halfW=width/2,halfH=height/2;
 const minX=bounds.left+halfW,maxX=bounds.right-halfW;
 const minY=bounds.top+halfH,maxY=bounds.bottom-halfH;
 if(![point?.x,point?.y,minX,maxX,minY,maxY,width,height,gap].every(Number.isFinite)||width<=0||height<=0||gap<0||minX>maxX||minY>maxY)return null;
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 const clear=p=>obstacles.every(r=>p.x+halfW+gap<=r.left||p.x-halfW-gap>=r.right||p.y+halfH+gap<=r.top||p.y-halfH-gap>=r.bottom);
 const start={x:clamp(point.x,minX,maxX),y:clamp(point.y,minY,maxY)};
 if(clear(start))return start;
 const xs=[start.x,minX,maxX,...obstacles.flatMap(r=>[r.left-halfW-gap,r.right+halfW+gap])].map(x=>clamp(x,minX,maxX));
 const ys=[start.y,minY,maxY,...obstacles.flatMap(r=>[r.top-halfH-gap,r.bottom+halfH+gap])].map(y=>clamp(y,minY,maxY));
 let best=null,distance=Infinity;
 for(const x of xs)for(const y of ys){const p={x,y},d=(x-point.x)**2+(y-point.y)**2;if(clear(p)&&d<distance){best=p;distance=d;}}
 return best;
}

export function mountHomePlane(field,button,slot){
 let position=null,relative=null,geometry=null,drag=null,resizeObserver=null;
 const localRect=element=>{const r=element.getBoundingClientRect(),f=field.getBoundingClientRect();return {left:r.left-f.left,right:r.right-f.left,top:r.top-f.top,bottom:r.bottom-f.top};};
 const obstacleSelectors='[data-plane-obstacle],.welcome .eyebrow,.welcome h1,.welcome-copy,.welcome-actions,.first-command,#welcome-foot';
 function measure(){
  const f=field.getBoundingClientRect(),b=button.getBoundingClientRect();
  geometry={width:b.width,height:b.height,bounds:{left:12,right:f.width-12,top:12,bottom:f.height-12},obstacles:[...field.querySelectorAll(obstacleSelectors)].filter(e=>!e.hidden).map(localRect)};
 }
 function place(p){position=p;if(p){button.style.left=p.x+'px';button.style.top=p.y+'px';button.style.visibility='';}else button.style.visibility='hidden';}
 function refresh(){
  if(button.hidden||field.hidden)return;
  measure();
  const s=localRect(slot),home={x:(s.left+s.right)/2,y:(s.top+s.bottom)/2};
  const wanted=relative?{x:relative.x*field.clientWidth,y:relative.y*field.clientHeight}:home;
  place(landPlane(wanted,geometry.bounds,geometry.obstacles,geometry.width,geometry.height));
  if(position)relative={x:position.x/field.clientWidth,y:position.y/field.clientHeight};
 }
 function settle(){
  if(!geometry||!position)return;
  const p=landPlane(position,geometry.bounds,geometry.obstacles,geometry.width,geometry.height);
  place(p);
  relative=p?{x:p.x/field.clientWidth,y:p.y/field.clientHeight}:null;
 }
 button.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;
  refresh();if(!position)return;
  drag={id:event.pointerId,x:event.clientX,y:event.clientY,origin:{...position}};
  button.setPointerCapture(event.pointerId);button.dataset.dragging='true';event.preventDefault();
 });
 button.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.id)return;
  refresh();if(!position)return;
  const origin=drag.origin;
  measure();
  const p=landPlane({x:origin.x+event.clientX-drag.x,y:origin.y+event.clientY-drag.y},geometry.bounds,geometry.obstacles,geometry.width,geometry.height);
  if(p){place(p);relative={x:p.x/field.clientWidth,y:p.y/field.clientHeight};}
  // Keep the drag anchor current, so repeated moves never accumulate an invalid position.
  drag.origin={...position};drag.x=event.clientX;drag.y=event.clientY;
 });
 function release(event){if(!drag||event.pointerId!==drag.id)return;drag=null;delete button.dataset.dragging;settle();}
 button.addEventListener('pointerup',release);
 button.addEventListener('pointercancel',release);
 button.addEventListener('lostpointercapture',release);
 button.addEventListener('keydown',event=>{
  if(event.key==='Home'||event.key==='Enter'){event.preventDefault();relative=null;refresh();return;}
  const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
  if(!delta)return;
  event.preventDefault();if(!position)return;
  measure();const step=event.shiftKey?48:24;
  const p=landPlane({x:position.x+delta[0]*step,y:position.y+delta[1]*step},geometry.bounds,geometry.obstacles,geometry.width,geometry.height);
  if(p){place(p);relative={x:p.x/field.clientWidth,y:p.y/field.clientHeight};}
 });
 button.addEventListener('dblclick',()=>{relative=null;refresh();});
 if(typeof ResizeObserver!=='undefined'){resizeObserver=new ResizeObserver(()=>refresh());resizeObserver.observe(field);}
 if(typeof document!=='undefined'&&document.fonts?.ready)document.fonts.ready.then(()=>refresh());
 return {refresh,get position(){return position;},get dragging(){return !!drag;},disconnect(){resizeObserver?.disconnect();}};
}
