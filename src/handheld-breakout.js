// Original geometric arcade art and deterministic, serializable simulation.
// Actions: 0 wait, 1 left, 2 right, 3 serve (press, release before next serve).
const W=320,H=240,STEP=1/240,R=3,PADDLE_Y=216,PADDLE_HALF=25;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const COLORS=['#88b7b8','#d8bd78','#c38a80','#9cabce','#a6bc98'];
function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
function layout(s){
  s.bricks=[];
  for(let row=0;row<5;row++)for(let col=0;col<9;col++){
    const present=s.wave===1?row<4:s.wave===2?(row+col)%3!==0:Math.abs(col-4)+Math.abs(row-2)<5;
    if(present)s.bricks.push({x:17+col*32,y:40+row*15,w:30,h:11,hp:s.wave===3&&row===0?2:1,color:(row+s.wave-1)%COLORS.length});
  }
}
function attach(s){s.ball={x:s.paddle.x,y:PADDLE_Y-R-2,vx:0,vy:0,attached:true};}
export function createBreakout(seed=1){
  const s={seed:Number(seed)>>>0,time:0,ticks:0,accumulator:0,score:0,lives:3,wave:1,over:false,won:false,launchHeld:false,paddle:{x:160},ball:null,bricks:[],effects:[],stars:[]};
  for(let i=0;i<35;i++)s.stars.push({x:9+Math.floor(random(s)*302),y:24+Math.floor(random(s)*208),bright:random(s)>.8});
  s.serveDirection=random(s)<.5?-1:1;layout(s);attach(s);return s;
}
function clone(s){return {...s,paddle:{...s.paddle},ball:{...s.ball},bricks:s.bricks.map(b=>({...b})),effects:s.effects.map(e=>({...e})),stars:s.stars.map(t=>({...t}))};}
// Sweep the ball's centre through an expanded rectangle. Tied entry times
// reflect both axes, avoiding a corner response that points into the brick.
function sweep(b,box,dt){
  let enter=-Infinity,leave=Infinity,nx=0,ny=0;
  for(const [pos,vel,min,max,axis] of [[b.x,b.vx,box.x-R,box.x+box.w+R,0],[b.y,b.vy,box.y-R,box.y+box.h+R,1]]){
    if(Math.abs(vel)<1e-12){if(pos<min||pos>max)return null;continue;}
    const a=(min-pos)/vel,z=(max-pos)/vel,near=Math.min(a,z),far=Math.max(a,z),normal=vel>0?-1:1;
    if(near>enter+1e-10){enter=near;nx=axis===0?normal:0;ny=axis===1?normal:0;}
    else if(Math.abs(near-enter)<1e-10){if(axis===0)nx=normal;else ny=normal;}
    leave=Math.min(leave,far);
    if(enter>leave+1e-10)return null;
  }
  if(enter< -1e-10||leave<0||enter>dt+1e-10)return null;
  return {t:Math.max(0,enter),nx,ny};
}
function spark(s,x,y,color){s.effects.push({x,y,color,life:.28});}
function nextWave(s){
  if(s.wave===3){s.won=true;s.over=true;s.score+=500;return;}
  s.wave++;s.score+=200;layout(s);attach(s);
}
function advanceBall(s,dt){
  const b=s.ball;let left=dt;
  // Fixed ticks bound ordinary motion; continuous sweeps also catch unusually
  // fast balls. The cap stops pathological contact loops without tunnelling.
  for(let contact=0;left>1e-10&&contact<32;contact++){
    let hit=null;
    const offer=(candidate)=>{if(candidate&&candidate.t>=-1e-10&&candidate.t<=left+1e-10&&(!hit||candidate.t<hit.t-1e-10))hit=candidate;};
    if(b.vx<0)offer({t:(11-b.x)/b.vx,nx:1,ny:0});
    if(b.vx>0)offer({t:(309-b.x)/b.vx,nx:-1,ny:0});
    if(b.vy<0)offer({t:(25-b.y)/b.vy,nx:0,ny:1});
    if(b.vy>0){
      offer({t:(H+R-b.y)/b.vy,lose:true});
      const t=(PADDLE_Y-R-b.y)/b.vy,x=b.x+b.vx*t;
      if(t>=-1e-10&&x>=s.paddle.x-PADDLE_HALF-R&&x<=s.paddle.x+PADDLE_HALF+R)offer({t:Math.max(0,t),paddle:true,nx:0,ny:-1});
    }
    for(let i=0;i<s.bricks.length;i++){const collision=sweep(b,s.bricks[i],left);if(collision)offer({...collision,brick:i});}
    if(!hit){b.x+=b.vx*left;b.y+=b.vy*left;break;}
    b.x+=b.vx*hit.t;b.y+=b.vy*hit.t;left=Math.max(0,left-hit.t);
    if(hit.lose){s.lives--;spark(s,b.x,H-4,'#c38a80');if(s.lives===0)s.over=true;else attach(s);return;}
    if(hit.paddle){
      const offset=clamp((b.x-s.paddle.x)/PADDLE_HALF,-1,1),speed=Math.min(210,Math.hypot(b.vx,b.vy)+2);
      // A small sideways component prevents a centre hit from producing an
      // endless vertical channel; paddle position remains the main control.
      const direction=Math.abs(offset)<.08?(b.vx<0?-1:1)*.08:offset;
      b.vx=speed*Math.sin(direction*1.02);b.vy=-Math.sqrt(speed*speed-b.vx*b.vx);
      spark(s,b.x,PADDLE_Y,'#e8dfc8');
    }else{
      if(hit.nx)b.vx=-b.vx;if(hit.ny)b.vy=-b.vy;
      if(hit.brick!==undefined){
        const brick=s.bricks[hit.brick];brick.hp--;s.score+=brick.hp===0?50*s.wave:10;
        spark(s,brick.x+brick.w/2,brick.y+brick.h/2,COLORS[brick.color]);
        if(brick.hp===0)s.bricks.splice(hit.brick,1);
        if(s.bricks.length===0){nextWave(s);return;}
      }
    }
    b.x+=(hit.nx||0)*1e-7;b.y+=(hit.ny||0)*1e-7;
  }
}
function tick(s,actions){
  s.ticks++;s.time=s.ticks*STEP;
  for(const e of s.effects)e.life-=STEP;s.effects=s.effects.filter(e=>e.life>0);
  s.paddle.x=clamp(s.paddle.x+(Number(actions.includes(2))-Number(actions.includes(1)))*160*STEP,33,287);
  const serve=actions.includes(3);
  if(s.ball.attached){
    s.ball.x=s.paddle.x;
    if(serve&&!s.launchHeld){const speed=132+(s.wave-1)*14;s.ball.attached=false;s.ball.vx=s.serveDirection*40;s.ball.vy=-Math.sqrt(speed*speed-1600);s.serveDirection*=-1;}
  }
  s.launchHeld=serve;
  if(!s.ball.attached)advanceBall(s,STEP);
}
// Every call returns a new snapshot, including terminal and invalid-dt calls.
// No elapsed time is discarded: caller intervals split into fixed 240 Hz ticks.
export function stepBreakout(state,dt,actions=[]){
  const s=clone(state);
  if(s.over||!Number.isFinite(dt)||dt<=0)return s;
  const accepted=Array.isArray(actions)?actions:[];
  const elapsed=s.accumulator+dt,count=Math.floor((elapsed+1e-10)/STEP);
  s.accumulator=elapsed-count*STEP;if(Math.abs(s.accumulator)<1e-10)s.accumulator=0;
  for(let i=0;i<count&&!s.over;i++)tick(s,accepted);
  if(s.over)s.accumulator=0;return s;
}
export function observeBreakout(s){
  return {paddleX:Math.round(s.paddle.x),paddleY:PADDLE_Y,paddleHalf:PADDLE_HALF,ballX:Math.round(s.ball.x),ballY:Math.round(s.ball.y),ballVX:Math.round(s.ball.vx),ballVY:Math.round(s.ball.vy),lives:s.lives,remaining:s.bricks.length,attached:Number(s.ball.attached),wave:s.wave,score:s.score,over:Number(s.over),won:Number(s.won)};
}
export function drawBreakout(ctx,s,width=W,height=H){
  ctx.save();ctx.scale(width/W,height/H);ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#101d26';ctx.fillRect(0,0,W,H);
  for(const star of s.stars){ctx.fillStyle=star.bright?'#49656c':'#273d46';ctx.fillRect(star.x,star.y,1,1);}
  ctx.fillStyle='#3a535a';ctx.fillRect(7,22,2,218);ctx.fillRect(311,22,2,218);ctx.fillRect(7,22,306,2);
  for(const b of s.bricks){ctx.fillStyle='#09141c';ctx.fillRect(b.x,b.y+2,b.w,b.h);ctx.fillStyle=COLORS[b.color];ctx.fillRect(b.x,b.y,b.w,b.h-1);ctx.fillStyle='#e8dfc8';ctx.fillRect(b.x+2,b.y+1,b.w-4,1);if(b.hp>1){ctx.fillStyle='#42545a';ctx.fillRect(b.x+3,b.y+5,b.w-6,2);}}
  const px=Math.round(s.paddle.x);ctx.fillStyle='#425b60';ctx.fillRect(px-PADDLE_HALF,218,PADDLE_HALF*2,6);ctx.fillStyle='#e8dfc8';ctx.fillRect(px-PADDLE_HALF,216,PADDLE_HALF*2,4);ctx.fillStyle='#d8bd78';ctx.fillRect(px-3,216,6,2);
  if(!s.over||s.won){ctx.fillStyle='#f7efdc';ctx.fillRect(Math.round(s.ball.x)-2,Math.round(s.ball.y)-2,5,5);}
  for(const e of s.effects){const spread=Math.round((.28-e.life)*38);ctx.fillStyle=e.color;for(const [dx,dy]of [[-1,-1],[1,-1],[-1,1],[1,1]])ctx.fillRect(Math.round(e.x+dx*spread),Math.round(e.y+dy*spread),2,2);}
  ctx.fillStyle='#e8dfc8';ctx.font='10px monospace';ctx.textAlign='left';ctx.fillText(String(s.score).padStart(6,'0'),9,14);
  for(let i=0;i<s.lives;i++){ctx.fillStyle='#d8bd78';ctx.fillRect(282+i*9,7,5,5);}
  for(let i=0;i<3;i++){ctx.fillStyle=i<s.wave?'#88b7b8':'#344a52';ctx.fillRect(148+i*9,8,5,3);}
  if(s.ball.attached&&!s.over){ctx.fillStyle='#88b7b8';ctx.fillRect(px-1,199,2,5);ctx.fillRect(px-3,201,6,2);}
  if(s.over){ctx.fillStyle='#101d26df';ctx.fillRect(100,125,120,34);ctx.textAlign='center';ctx.fillStyle=s.won?'#d8bd78':'#c38a80';ctx.font='20px monospace';ctx.fillText(s.won?'★ ★ ★':'×',160,149);}
  ctx.restore();
}
