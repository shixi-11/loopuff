// Use the approved transparent artwork for both the home and flight-game aircraft.
const aircraft=typeof Image==='undefined'?null:new Image();
if(aircraft){
 aircraft.decoding='async';
 aircraft.src=new URL('../assets/aircraft-2d.png',import.meta.url).href;
}
export function whenPlaneReady(redraw){
 if(aircraft?.complete&&aircraft.naturalWidth){redraw();return ()=>{};}
 aircraft?.addEventListener('load',redraw,{once:true});
 return ()=>aircraft?.removeEventListener('load',redraw);
}
export function drawPlane(ctx,x,y,size=110,time=0,angle=0){
 if(!aircraft?.complete||!aircraft.naturalWidth)return;
 const height=size*1.15,width=height*aircraft.naturalWidth/aircraft.naturalHeight;
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);
 ctx.drawImage(aircraft,-width/2,-height/2,width,height);
 ctx.restore();
}
