// Approved 2.5D aircraft. The PNG master stays in art/; this is a light runtime sprite.
const readyListeners=new Set();
const aircraft=typeof Image==='undefined'?null:new Image();
if(aircraft){
 aircraft.decoding='async';
 aircraft.onload=()=>{for(const redraw of readyListeners)redraw();readyListeners.clear();};
 aircraft.src=new URL('../assets/aircraft.webp',import.meta.url).href;
}
export function whenPlaneReady(redraw){
 if(aircraft?.complete&&aircraft.naturalWidth)redraw();else readyListeners.add(redraw);
 return ()=>readyListeners.delete(redraw);
}
export function drawPlane(ctx,x,y,size=110,time=0,angle=0){
 if(!aircraft?.complete||!aircraft.naturalWidth)return;
 ctx.save();ctx.translate(x,y);ctx.rotate(angle+2.15);
 const width=size,height=width*aircraft.naturalHeight/aircraft.naturalWidth;
 ctx.drawImage(aircraft,-width/2,-height/2,width,height);
 // Engine highlights breathe very gently; time=0 freezes them for reduced motion.
 const pulse=.09+(Math.sin(time*2.2)+1)*.035;
 for(const [px,py] of [[.19,.39],[.53,.58]]){
  const ex=(px-.5)*width,ey=(py-.5)*height,r=width*.045;
  const light=ctx.createRadialGradient(ex,ey,0,ex,ey,r);
  light.addColorStop(0,`rgba(255,217,145,${pulse})`);light.addColorStop(1,'rgba(255,217,145,0)');
  ctx.fillStyle=light;ctx.fillRect(ex-r,ey-r,r*2,r*2);
 }
 ctx.restore();
}
