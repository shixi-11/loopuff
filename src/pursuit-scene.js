import {loadChaseAssets} from './chase-scene.js';
import {pursuitSegment,pursuitPosition,pursuitJumpHeight} from './pursuit.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const sharedStreet=(a,b)=>a.road===b.road&&a.section===b.section&&a.path===b.path;
export function mountPursuitScene(root,{getState,text,roles,onError=()=>{}}){
 const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d');let art=null,disposed=false,width=0,height=0;
 const ready=loadChaseAssets().then(value=>{if(disposed)return false;art=value;root.dataset.scene='ready';draw();return true;}).catch(()=>{if(!disposed){root.dataset.scene='error';onError();}return false;});
 function size(){width=Math.max(1,root.clientWidth);height=clamp(Math.min(width*.46,innerHeight-300),280,610);if(root.closest('.is-expanded'))height=Math.max(180,root.clientHeight);const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.height=`${height}px`;ctx.setTransform(dpr,0,0,dpr,0,0);draw();}
 function sprite(kind,index,x,ground,scale,flip=false){const frame=art.atlas[kind].frames[index];ctx.save();ctx.translate(x,ground);if(flip)ctx.scale(-1,1);ctx.drawImage(art[kind],...frame,-frame[2]*scale/2,-frame[3]*scale,frame[2]*scale,frame[3]*scale);ctx.restore();}
 function person(state,role,x,ground,targetHeight,label=true){
  const a=state.actors[role],lift=pursuitJumpHeight(a)*targetHeight*.32;
  const pose=state.outcome==='caught'?(role==='police'?7:6):state.outcome==='escaped'&&role==='thief'?7:a.delayMs?6:a.jumpMs?5:state.status==='running'?1+Math.floor(a.travelled*2)%4:0;
  ctx.fillStyle='#070f1f77';ctx.beginPath();ctx.ellipse(x,ground+3,targetHeight*.17,5,0,0,Math.PI*2);ctx.fill();sprite(role,pose,x,ground-lift,targetHeight/art.atlas[role].frames[0][3],a.direction===-1);
  if(label&&state.status!=='finished'){ctx.fillStyle=role===state.role?'#f4d888':'#c7dbff';ctx.font=`600 ${width<600?12:14}px system-ui,sans-serif`;ctx.textAlign='center';ctx.shadowColor='#081120';ctx.shadowBlur=5;ctx.fillText(roles[role],x,Math.max(22,ground-targetHeight-lift-14));ctx.shadowBlur=0;}
 }
 function draw(){
  if(disposed||!width)return;ctx.clearRect(0,0,width,height);if(!art)return;
  const state=getState(),role=state.role,other=role==='police'?'thief':'police',a=state.actors[role],b=state.actors[other],route=pursuitSegment(state,role);
  const ground=height*.77,targetHeight=clamp(height*.36,112,205),unit=width<600?13:17,anchor=width*.44,x=n=>anchor+(n-a.distance)*unit;
  const scale=Math.max(width/art.street.width,height/art.street.height)*1.12,bw=art.street.width*scale,bh=art.street.height*scale;
  const pan=(Math.sin(pursuitPosition(state,role)/700)+1)/2*(bw-width);ctx.drawImage(art.street,-pan,ground-bh*.7,bw,bh);
  if(route.terrain===1){ctx.fillStyle='#b5cafa10';ctx.fillRect(0,0,width,height);}
  if(route.terrain===3){ctx.fillStyle='#1d3c2c12';ctx.fillRect(0,0,width,height);}
  ctx.textAlign='center';ctx.font='12px ui-monospace,monospace';
  const first=Math.max(0,Math.floor((a.distance-anchor/unit)/10)*10),last=Math.min(route.length,a.distance+(width-anchor)/unit);
  for(let n=first;n<=last;n+=10){ctx.strokeStyle='#e4d5ad66';ctx.beginPath();ctx.moveTo(x(n),ground+10);ctx.lineTo(x(n),ground+19);ctx.stroke();ctx.fillStyle='#d9e2f1';ctx.fillText(`${n}m`,x(n),ground+36);}
  for(const point of route.obstacles){const sx=x(point);if(sx< -100||sx>width+100)continue;sprite('props',0,sx,ground+3,targetHeight*.39/art.atlas.props.frames[0][3]);}
  for(const [i,point]of route.pickups.entries()){
   if(a.collected.includes(`${a.road}:${a.section}:${a.path}:${i}`))continue;
   const sx=x(point);if(sx< -30||sx>width+30)continue;
   ctx.fillStyle='#b4d5ee';ctx.fillRect(sx-10,ground-34,20,26);ctx.fillStyle='#183853';ctx.fillRect(sx-6,ground-24,12,3);ctx.fillRect(sx-1.5,ground-28,3,12);
  }
  if(a.road==='exit'&&x(200)<width+200)sprite('props',1,x(200),ground+3,targetHeight*1.4/art.atlas.props.frames[1][3]);
  else if(x(route.length)>-30&&x(route.length)<width+30){ctx.strokeStyle='#d7dce4aa';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x(route.length),ground+5);ctx.lineTo(x(route.length),ground-60);ctx.stroke();ctx.fillStyle='#b9d0f5';ctx.fillRect(x(route.length),ground-60,27,16);}
  person(state,role,anchor,ground,targetHeight);
  const same=sharedStreet(a,b)||state.outcome==='caught',otherX=sharedStreet(a,b)?x(b.distance):anchor+(pursuitPosition(state,other)-pursuitPosition(state,role))*unit;
  if(same&&otherX>-targetHeight&&otherX<width+targetHeight)person(state,other,otherX,ground,targetHeight);
  else{
   const insetW=Math.min(245,width*.43),insetH=width<600?116:154,left=width-insetW-14,top=14;
   ctx.save();ctx.beginPath();ctx.rect(left,top,insetW,insetH);ctx.clip();ctx.fillStyle='#0b1526ec';ctx.fillRect(left,top,insetW,insetH);
   ctx.fillStyle='#b6c9e5';ctx.font=`${width<600?10:12}px system-ui,sans-serif`;ctx.textAlign='center';ctx.fillText(text.rivalStreet,left+insetW/2,top+19,insetW-14);
   ctx.font='11px system-ui,sans-serif';ctx.fillText(`${roles[other]} · ${Math.min(21,b.section+1)} / 20 · ${b.path===1?text.alley:text.wide}`,left+insetW/2,top+36,insetW-14);
   person(state,other,left+insetW/2,top+insetH-5,insetH*.54,false);ctx.restore();ctx.strokeStyle='#8aa6cc55';ctx.strokeRect(left,top,insetW,insetH);
  }
  const mapLeft=24,mapRight=width-24,mapY=height-25;
  for(const [i,kind]of ['police','thief'].entries()){
   const y=mapY+i*7;ctx.strokeStyle='#8496b855';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(mapLeft,y);ctx.lineTo(mapRight,y);ctx.stroke();
   for(let n=0;n<=20;n++){const sx=mapLeft+n/20*(mapRight-mapLeft);ctx.fillStyle='#7b92b266';ctx.fillRect(sx,y-2,1,4);}
   ctx.fillStyle=kind==='police'?'#c8dcff':'#f0cf82';ctx.beginPath();ctx.arc(mapLeft+clamp(pursuitPosition(state,kind)/4720,0,1)*(mapRight-mapLeft),y,4,0,Math.PI*2);ctx.fill();
  }
 }
 const observer=new ResizeObserver(size);observer.observe(root);window.addEventListener('resize',size);size();
 return {ready,draw,resize:size,dispose(){disposed=true;observer.disconnect();window.removeEventListener('resize',size);}};
}
