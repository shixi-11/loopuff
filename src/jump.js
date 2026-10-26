import { drawPlane, whenPlaneReady } from './plane.js';
// The game interprets one displayed integer as a jump distance. It is not a
// Tolang built-in operation and never changes the runner's language semantics.
export function jumpOutcome(logs,target,maximum=12){
  if(logs.length!==1||!/^\d+$/.test(String(logs[0])))return {valid:false};
  const distance=Number(logs[0]);
  if(!Number.isSafeInteger(distance)||distance>maximum)return {valid:false};
  return {valid:true,distance,target,landed:distance===target,
    direction:distance<target?'short':distance>target?'long':'landed'};
}
export function jumpPosition(progress,distance){
  const t=Math.max(0,Math.min(1,progress));
  return {forward:distance*t,height:Math.sin(Math.PI*t)};
}

export function drawExplorer(ctx,x,y,size,time=0,jumping=false){
  drawPlane(ctx,x,y,size,time,jumping?Math.PI/3:0);
}

export function mountJumpLab(root,{target,text,reduced}){
  const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d'),status=root.querySelector('[role=status]');
  let width=800,height=320,frameId=0,disposed=false,outcome=null,start=null,lastProgress=0;
  const fill=(key,number)=>text[key].replace('{n}',String(number));
  const position=n=>36+(width-72)*n/12;
  function platform(at,goal=false){
    const x=position(at),y=height*.72,w=Math.min(84,width*.14);
    ctx.fillStyle='#2a3858';ctx.beginPath();ctx.moveTo(x-w/2,y);ctx.lineTo(x+w/2,y);ctx.lineTo(x+w*.28,y+32);ctx.lineTo(x-w*.16,y+53);ctx.lineTo(x-w*.44,y+27);ctx.closePath();ctx.fill();
    const top=ctx.createLinearGradient(x-w/2,y-8,x+w/2,y+6);top.addColorStop(0,goal?'#e8cf87':'#8da3c9');top.addColorStop(1,'#4b638d');
    ctx.fillStyle=top;ctx.beginPath();ctx.ellipse(x,y,w/2,10,0,0,Math.PI*2);ctx.fill();
    if(goal){ctx.strokeStyle='#edd68d';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y-4,w*.28,5,0,0,Math.PI*2);ctx.stroke();}
  }
  function draw(progress=0){
    if(disposed)return;
    lastProgress=progress;
    ctx.clearRect(0,0,width,height);
    const sky=ctx.createLinearGradient(0,0,width,height);sky.addColorStop(0,'#0c142b');sky.addColorStop(1,'#252747');
    ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
    ctx.fillStyle='#bed1f099';
    for(let i=0;i<22;i++){const x=((i*137+43)%997)/997*width,y=((i*71+19)%211)/211*height;ctx.beginPath();ctx.arc(x,y,i%5===0?1.2:.65,0,Math.PI*2);ctx.fill();}
    const ground=height*.72;
    ctx.strokeStyle='#a7beeb52';ctx.setLineDash([3,7]);ctx.beginPath();ctx.moveTo(position(0),ground+65);ctx.lineTo(position(12),ground+65);ctx.stroke();ctx.setLineDash([]);
    ctx.textAlign='center';ctx.font='12px monospace';ctx.fillStyle='#d7e0f3';
    for(let n=0;n<=12;n++){const x=position(n);ctx.fillText(String(n),x,ground+84);}
    platform(0);platform(target,true);
    ctx.fillStyle='#f3d99f';ctx.font='600 15px monospace';ctx.fillText(String(target),position(target),ground-25);
    const motion=jumpPosition(progress,outcome?.distance||0),finished=outcome&&progress===1;
    const falling=finished&&!outcome.landed;
    const x=position(motion.forward),size=Math.max(34,Math.min(62,width*.11));
    const y=ground-size*.46-motion.height*Math.min(95,height*.32)+(falling?48:0);
    if(outcome){
      ctx.strokeStyle='#f0cf8b99';ctx.lineWidth=2;ctx.setLineDash([2,6]);ctx.beginPath();
      for(let i=0;i<=40;i++){const t=progress*i/40,p=jumpPosition(t,outcome.distance),px=position(p.forward),py=ground-size*.46-p.height*Math.min(95,height*.32);if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.stroke();ctx.setLineDash([]);
    }
    drawExplorer(ctx,x,y,size,0,!!outcome&&progress<1);
  }
  function animate(now){
    if(disposed)return;
    if(start===null)start=now;
    const progress=Math.min((now-start)/950,1);draw(progress);
    if(progress<1)frameId=requestAnimationFrame(animate);
    else if(outcome)status.textContent=fill(outcome.direction,outcome.distance);
  }
  function resize(){
    width=root.clientWidth;height=width<500?290:340;
    const dpr=Math.min(devicePixelRatio||1,1.6);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.height=height+'px';ctx.setTransform(dpr,0,0,dpr,0,0);draw(lastProgress);
  }
  const observer=new ResizeObserver(resize);observer.observe(root);
  const detachPlane=whenPlaneReady(()=>draw(lastProgress));
  const onMotion=()=>{if(reduced.matches&&outcome){cancelAnimationFrame(frameId);draw(1);status.textContent=fill(outcome.direction,outcome.distance);}};
  reduced.addEventListener('change',onMotion);status.textContent=fill('ready',target);resize();
  return {
    reset(){cancelAnimationFrame(frameId);outcome=null;draw();status.textContent=fill('ready',target);delete root.dataset.outcome;delete root.dataset.distance;},
    play(logs){
      cancelAnimationFrame(frameId);const next=jumpOutcome(logs,target);outcome=next.valid?next:null;start=null;
      if(!next.valid){draw();status.textContent=text.invalid;delete root.dataset.outcome;delete root.dataset.distance;return next;}
      status.textContent=fill('running',next.distance);
      if(reduced.matches){draw(1);status.textContent=fill(next.direction,next.distance);}else frameId=requestAnimationFrame(animate);
      root.dataset.outcome=next.direction;root.dataset.distance=String(next.distance);return next;
    },
    error(){cancelAnimationFrame(frameId);outcome=null;draw();status.textContent=text.codeError;delete root.dataset.outcome;delete root.dataset.distance;},
    dispose(){disposed=true;cancelAnimationFrame(frameId);observer.disconnect();reduced.removeEventListener('change',onMotion);detachPlane();}
  };
}
