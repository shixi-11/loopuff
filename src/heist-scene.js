import {loadChaseAssets} from './chase-scene.js';
import {heistWorld,heistPhase,heistRules} from './heist.js';
export function mountHeistScene(root,{getState,text:t,onError=()=>{}}){
 const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d');let width=0,height=0,art=null,disposed=false;
 const ready=loadChaseAssets().then(value=>{if(disposed)return false;art=value;draw();return true;}).catch(()=>{if(!disposed)onError();return false;});
 function resize(){width=Math.max(1,root.clientWidth);height=root.closest('.is-expanded')?Math.max(240,root.clientHeight):Math.max(290,Math.min(480,width*.44));const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.height=`${height}px`;ctx.setTransform(dpr,0,0,dpr,0,0);draw();}
 function draw(){
  if(disposed||!width)return;const s=getState(),w=heistWorld(s.seed),ground=height*.76,unit=width<600?9:12,anchor=width*.35,x=n=>anchor+(n-s.x)/1000*unit;
  ctx.clearRect(0,0,width,height);const bg=ctx.createLinearGradient(0,0,0,height);bg.addColorStop(0,'#0a1427');bg.addColorStop(1,'#263b57');ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
  // Architecture follows world coordinates, so the corridor scrolls with motion.
  const first=Math.floor((s.x-anchor/unit*1000)/18000)*18000;
  for(let n=first;n<s.x+width/unit*1000;n+=18000){const a=x(n);ctx.fillStyle='#344761';ctx.fillRect(a,25,9,ground-25);ctx.fillStyle='#17273e';ctx.fillRect(a+12,52,18*unit-22,ground-87);ctx.strokeStyle='#5d719044';ctx.strokeRect(a+27,66,18*unit-52,ground-119);ctx.fillStyle='#c4d1e433';ctx.fillRect(a+34,66,18*unit-66,3);}
  for(const [left,right]of w.covers){const a=x(left),b=x(right);if(b<0||a>width)continue;ctx.fillStyle='#07101fe6';ctx.fillRect(a,30,b-a,ground-25);ctx.fillStyle='#a7c3ec';ctx.font='12px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText(t.cover,(a+b)/2,49,Math.max(30,b-a-8));ctx.strokeStyle='#7898c366';ctx.strokeRect(a,30,b-a,ground-25);}
  const gx=x(s.guardX);if(s.door||s.guardX>=w.door){const end=s.guardX+s.facing*heistRules.viewRange,clipped=!s.door&&end<w.door?w.door:end;ctx.fillStyle='#e5c78112';ctx.beginPath();ctx.moveTo(gx,ground-130);ctx.lineTo(x(clipped),ground-185);ctx.lineTo(x(clipped),ground);ctx.lineTo(gx,ground-22);ctx.closePath();ctx.fill();}
  ctx.fillStyle='#7186a34d';ctx.fillRect(0,ground,width,2);ctx.fillStyle='#0a1526';ctx.fillRect(0,ground+2,width,height-ground);
  ctx.textAlign='center';ctx.font='13px system-ui,sans-serif';
  for(const [i,n]of [w.key,w.door,w.safe,w.exit].entries()){
   const sx=x(n),done=[s.key,s.door,s.bag,false][i];if(sx<-70||sx>width+70)continue;
   ctx.fillStyle=done?'#91a9c355':'#e7ce8d';
   if(i===0){ctx.beginPath();ctx.arc(sx,ground-38,8,0,Math.PI*2);ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=3;ctx.stroke();ctx.fillRect(sx+5,ground-39,24,4);ctx.fillRect(sx+20,ground-39,4,11);}
   else if(i===1){ctx.fillStyle=s.door?'#8faed333':'#435a79';ctx.fillRect(sx-14,ground-180,28,180);ctx.strokeStyle='#b9cbee';ctx.strokeRect(sx-14,ground-180,28,180);if(!s.door){ctx.fillStyle='#e7ce8d';ctx.fillRect(sx-5,ground-88,10,15);}}
   else if(i===2){ctx.fillStyle=done?'#314b63':'#5b6f8b';ctx.fillRect(sx-25,ground-65,50,65);ctx.strokeStyle='#a5bad9';ctx.strokeRect(sx-25,ground-65,50,65);ctx.beginPath();ctx.arc(sx,ground-33,11,0,Math.PI*2);ctx.stroke();}
   else {ctx.fillStyle='#9fbbe333';ctx.fillRect(sx-24,ground-170,48,170);ctx.strokeStyle='#b8cdec';ctx.strokeRect(sx-24,ground-170,48,170);ctx.fillStyle='#c3d7f6';ctx.fillText('→',sx,ground-80);}
   ctx.fillStyle=i===heistPhase(s)?'#f7dc99':'#c2d1e8';ctx.fillText([t.key,t.door,t.safe,t.exit][i],sx,ground+25,100);
  }
  function person(kind,px,flip,hidden=false){if(!art||px<-100||px>width+100)return;const h=Math.min(150,height*.38),moving=s.status==='running'&&(kind==='police'||[1,2,5,6].includes(s.command)),frame=art.atlas[kind].frames[moving?1+Math.floor((kind==='police'?s.guardX:s.x)/900)%4:0],scale=h/frame[3];ctx.save();ctx.translate(px,ground);ctx.globalAlpha=hidden?.4:1;if(flip)ctx.scale(-1,1);ctx.drawImage(art[kind],...frame,-frame[2]*scale/2,-h,frame[2]*scale,h);ctx.restore();}
  person('police',gx,s.facing===-1);person('thief',anchor,s.command===5,s.hidden);
  if(s.bag){ctx.fillStyle='#e4ca87';ctx.fillRect(anchor-27,ground-46,15,22);ctx.strokeStyle='#705e38';ctx.strokeRect(anchor-27,ground-46,15,22);}
  ctx.fillStyle='#edf3ff';ctx.font='13px system-ui,sans-serif';ctx.fillText(t.player,anchor,ground-Math.min(150,height*.38)-13);if(gx>30&&gx<width-30)ctx.fillText(t.guard,gx,ground-Math.min(150,height*.38)-13);
  const left=24,right=width-24,y=height-23;ctx.strokeStyle='#92a9c75f';ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();
  for(const [n,color]of [[w.key,s.key?'#637c9a':'#e4cc8d'],[w.door,s.door?'#637c9a':'#e4cc8d'],[w.safe,s.bag?'#637c9a':'#e4cc8d'],[w.exit,'#bad1f7']]){ctx.fillStyle=color;ctx.fillRect(left+n/w.exit*(right-left)-2,y-5,4,10);}
  for(const [n,color]of [[s.guardX,'#e5c781'],[s.x,'#d0e1ff']]){ctx.fillStyle=color;ctx.beginPath();ctx.arc(left+n/w.exit*(right-left),y,4,0,Math.PI*2);ctx.fill();}
 }
 const observer=new ResizeObserver(resize);observer.observe(root);window.addEventListener('resize',resize);resize();return {ready,draw,resize,dispose(){disposed=true;observer.disconnect();window.removeEventListener('resize',resize);}};
}
