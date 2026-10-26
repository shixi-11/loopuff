const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const ease=t=>t*t*(3-2*t);
const assets={police:'chase-police.webp?v=39bc4f5601',thief:'chase-thief.webp?v=9403edfa76',props:'chase-props.webp?v=b6866b67ec',street:'chase-street.webp?v=195a74ab0d'};
let assetPromise;
export function validateChaseArt(art){
  for(const [kind,count] of [['police',8],['thief',8],['props',2]]){
    const a=art.atlas[kind],image=art[kind];
    if(!a||a.width!==image.width||a.height!==image.height||a.frames?.length!==count)throw Error('Invalid chase atlas');
    for(const r of a.frames)if(!Array.isArray(r)||r.length!==4||r.some(n=>!Number.isInteger(n))||r[0]<0||r[1]<0||r[2]<=0||r[3]<=0||r[0]+r[2]>a.width||r[1]+r[3]>a.height)throw Error('Invalid chase pose');
  }
  return art;
}
function loadAssets(){
  if(assetPromise)return assetPromise;
  const controller=new AbortController(),images=[];let timer;
  const pending=Promise.all([
    fetch(new URL('../assets/chase-sprites.json',import.meta.url),{signal:controller.signal,priority:'high'}).then(r=>{if(!r.ok)throw Error('atlas');return r.json();}),
    ...Object.values(assets).map(file=>new Promise((resolve,reject)=>{
      const img=new Image();images.push(img);img.fetchPriority='high';img.decoding='async';img.onload=()=>resolve(img);img.onerror=()=>reject(Error(file));img.src=new URL(`../assets/${file}`,import.meta.url).href;
    }))
  ]).then(([atlas,police,thief,props,street])=>validateChaseArt({atlas,police,thief,props,street}));
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Chase assets timed out')),45000);});
  assetPromise=Promise.race([pending,timeout]).catch(error=>{
    controller.abort();for(const img of images){img.onload=img.onerror=null;img.src='';}assetPromise=null;throw error;
  }).finally(()=>clearTimeout(timer));
  return assetPromise;
}

// The player moves before the rival. Sampling changes only presentation, never
// the rules or saved outcome. Both endpoints are exact, including blocked moves.
export function chaseMotion(from,to,role,progress){
  const p=clamp(progress,0,1),player=clamp(p/.72,0,1),rival=clamp((p-.72)/.28,0,1);
  const other=role==='police'?'thief':'police',values={...from};
  values[role]=to.blocked?from[role]+(player===0||player===1?0:Math.sin(Math.PI*player)*.27):from[role]+(to[role]-from[role])*ease(player);
  values[other]=from[other]+(to[other]-from[other])*ease(rival);
  const moving=player>0&&player<1,run=1+Math.floor(p*12)%4;
  const jumping=moving&&!to.blocked&&to.signal>1;
  const poses={police:0,thief:0};
  if(moving)poses[role]=to.blocked?(player>.3?6:run):jumping&&player>.2&&player<.8?5:run;
  if(rival>0&&rival<1&&to[other]!==from[other])poses[other]=run;
  if(p===1&&to.outcome==='caught'){poses.police=7;poses.thief=6;}
  if(p===1&&to.outcome==='escaped')poses.thief=7;
  return {police:values.police,thief:values.thief,poses,lift:jumping?Math.sin(Math.PI*player):0,player};
}

export function mountChaseScene(root,{role,puzzle,reduced,text,onError=()=>{}}){
  const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d');
  let art=null,width=0,height=0,raf=0,disposed=false,paused=false,animation=null,playVersion=0;
  let state={police:0,thief:puzzle.gap,poses:{police:0,thief:0},lift:0};
  const ready=loadAssets().then(value=>{if(disposed)return false;art=value;root.dataset.scene='ready';draw();return true;}).catch(()=>{if(!disposed){root.dataset.scene='error';onError();}return false;});
  function size(){
    width=Math.max(1,root.clientWidth);height=clamp(width*.43,290,470);
    const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    canvas.style.height=`${height}px`;ctx.setTransform(dpr,0,0,dpr,0,0);draw();
  }
  function sprite(kind,index,x,ground,scale,flip=false){
    const r=art.atlas[kind].frames[index];ctx.save();ctx.translate(x,ground);if(flip)ctx.scale(-1,1);
    ctx.drawImage(art[kind],...r,-r[2]*scale/2,-r[3]*scale,r[2]*scale,r[3]*scale);ctx.restore();
  }
  function draw(){
    if(disposed)return;ctx.clearRect(0,0,width,height);if(!art)return;
    const unit=Math.min(108,width/7.5),targetHeight=clamp(height*.39,105,178);
    const margin=Math.max(unit*.9,targetHeight*.85),world=puzzle.finish*unit+margin*2;
    const middle=(state.police+state.thief)/2*unit+margin,follow=state[role]*unit+margin;
    const followWeight=clamp((Math.abs(state.police-state.thief)*unit-width*.7)/(width*.2),0,1);
    const camera=clamp(middle*(1-followWeight)+follow*followWeight-width*.45,0,Math.max(0,world-width));
    const x=n=>margin+n*unit-camera,ground=height*.735;
    const bgScale=Math.max(width/art.street.width,height/art.street.height)*1.14;
    const bw=art.street.width*bgScale,bh=art.street.height*bgScale;
    const pan=(camera/Math.max(1,world-width))*(bw-width);
    // The painted sidewalk's walking line is 70% down the original plate.
    // Register feet to it instead of letting cover-cropping move the ground.
    ctx.drawImage(art.street,-pan,ground-bh*.70,bw,bh);
    // Paving marks and numbered route stones stay in world space as the camera follows.
    ctx.font=`600 ${width<600?11:13}px ui-monospace,monospace`;ctx.textAlign='center';
    for(let n=0;n<=puzzle.finish;n++){
      const sx=x(n);if(sx<-30||sx>width+30)continue;
      ctx.strokeStyle='#e6d5a76b';ctx.beginPath();ctx.moveTo(sx,ground+10);ctx.lineTo(sx,ground+16);ctx.stroke();
      ctx.fillStyle='#f4e8c9';ctx.fillText(String(n),sx,ground+33);
    }
    const gateHeight=targetHeight*1.45,gate=art.atlas.props.frames[1];
    sprite('props',1,x(puzzle.finish),ground+3,gateHeight/gate[3]);
    for(const n of puzzle.blocks){
      const r=art.atlas.props.frames[0];sprite('props',0,x(n),ground+3,(targetHeight*.40)/r[3]);
    }
    for(const kind of ['police','thief']){
      const actorScale=targetHeight/art.atlas[kind].frames[0][3];
      const lift=kind===role?state.lift*targetHeight*.55:0;
      const captured=state.poses.police===7&&state.poses.thief===6;
      const sx=x(state[kind])+(captured?(kind==='police'?-.22:.15)*targetHeight:0);
      ctx.fillStyle='#090f1b66';ctx.beginPath();ctx.ellipse(sx,ground+3,targetHeight*.19*(1-lift/targetHeight*.4),4,0,0,Math.PI*2);ctx.fill();
      sprite(kind,state.poses[kind],sx,ground-lift,actorScale);
      ctx.fillStyle=kind===role?'#fff0bc':'#d6e4ff';ctx.font='600 12px system-ui,sans-serif';
      const head=ground-targetHeight-lift-17;
      ctx.shadowColor='#080f21';ctx.shadowBlur=4;ctx.fillText(text[kind],sx,Math.max(20,head));ctx.shadowBlur=0;
      if(kind===role){ctx.fillStyle='#f0cf82';ctx.beginPath();ctx.moveTo(sx-4,head+5);ctx.lineTo(sx+4,head+5);ctx.lineTo(sx,head+10);ctx.fill();}
    }
    // Mini route map keeps both actors and offscreen roadblocks observable.
    const mapWidth=Math.min(260,width-40),mx=width-mapWidth-20,my=height-27;
    ctx.fillStyle='#0c1425d9';ctx.fillRect(mx-8,my-13,mapWidth+16,27);
    ctx.strokeStyle='#7a8eae';ctx.beginPath();ctx.moveTo(mx,my);ctx.lineTo(mx+mapWidth,my);ctx.stroke();
    for(const n of puzzle.blocks){ctx.fillStyle='#cba764';ctx.fillRect(mx+n/puzzle.finish*mapWidth-2,my-4,4,8);}
    for(const kind of ['police','thief']){ctx.fillStyle=kind==='police'?'#c8dcff':'#f0cf82';ctx.beginPath();ctx.arc(mx+state[kind]/puzzle.finish*mapWidth,my,4,0,Math.PI*2);ctx.fill();}
  }
  function cancel(){
    playVersion++;
    cancelAnimationFrame(raf);raf=0;
    if(animation){const resolve=animation.resolve;animation=null;resolve(false);}
  }
  function tick(time){
    if(disposed||paused||!animation)return;
    if(animation.last!==null)animation.elapsed+=Math.min(80,Math.max(0,time-animation.last));
    animation.last=time;
    const progress=animation.duration===0?1:clamp(animation.elapsed/animation.duration,0,1);
    state=chaseMotion(animation.from,animation.to,role,progress);draw();
    if(progress===1){const resolve=animation.resolve;animation=null;raf=0;resolve(true);}
    else raf=requestAnimationFrame(tick);
  }
  const observer=new ResizeObserver(size);observer.observe(root);size();
  return {
    ready,
    reset(){cancel();paused=false;state={police:0,thief:puzzle.gap,poses:{police:0,thief:0},lift:0};draw();},
    show(frame){cancel();paused=false;state=chaseMotion(frame,frame,role,1);draw();},
    async play(from,to){
      cancel();paused=false;
      const version=playVersion;
      if(!await ready||disposed||version!==playVersion)return false;
      if(reduced.matches&&!paused){state=chaseMotion(from,to,role,1);draw();return true;}
      return new Promise(resolve=>{animation={from,to,duration:reduced.matches?0:1180,elapsed:0,last:null,resolve};if(!paused)raf=requestAnimationFrame(tick);});
    },
    pause(value){paused=value;if(value){cancelAnimationFrame(raf);raf=0;}else if(animation){animation.last=null;raf=requestAnimationFrame(tick);}},
    dispose(){disposed=true;cancel();observer.disconnect();}
  };
}
