// Original geometric tank game. No ROM, sprites or third-party game code.
const COLS=20,ROWS=14,TILE=16,DIR=[[0,-1],[1,0],[0,1],[-1,0]];
function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
function arena(){
 const map=Array.from({length:ROWS},()=>Array(COLS).fill(0));
 for(let y=3;y<11;y+=3)for(let x=1;x<19;x++)if(x%5!==0&&x!==9&&x!==10)map[y][x]=(x+y)%7===0?2:1;
 for(const [x,y]of [[8,12],[8,13],[9,12],[10,12],[11,12],[11,13]])map[y][x]=1;
 return map;
}
export function createTanks(seed=1){return {seed:seed>>>0,map:arena(),player:{x:120,y:216,dir:0,health:3,cooldown:0,shield:2},base:{x:160,y:216,health:3},enemies:[],bullets:[],effects:[],score:0,wave:1,kills:0,spawned:0,spawnTimer:1,time:0,over:false,won:false};}
function clear(s,x,y,r=6,ignore=null){
 if(x-r<0||x+r>COLS*TILE||y-r<0||y+r>ROWS*TILE)return false;
 for(let ty=Math.floor((y-r)/16);ty<=Math.floor((y+r-.01)/16);ty++)for(let tx=Math.floor((x-r)/16);tx<=Math.floor((x+r-.01)/16);tx++)if(s.map[ty][tx])return false;
 if(Math.abs(x-s.base.x)<r+7&&Math.abs(y-s.base.y)<r+7)return false;
 for(const tank of [s.player,...s.enemies])if(tank!==ignore&&tank.health>0&&Math.abs(x-tank.x)<r+6&&Math.abs(y-tank.y)<r+6)return false;
 return true;
}
function move(s,t,dir,dt,speed){t.dir=dir;const [dx,dy]=DIR[dir];if(clear(s,t.x+dx*speed*dt,t.y+dy*speed*dt,6,t)){t.x+=dx*speed*dt;t.y+=dy*speed*dt;return true;}return false;}
function fire(s,t,team){if(t.cooldown>0)return;const [dx,dy]=DIR[t.dir];s.bullets.push({x:t.x+dx*9,y:t.y+dy*9,dir:t.dir,team});t.cooldown=team==='player'?.32:1.4;}
function flash(s,x,y,color){s.effects.push({x,y,color,life:.22});}
function tick(s,dt,actions){
 s.time+=dt;s.player.cooldown=Math.max(0,s.player.cooldown-dt);s.player.shield=Math.max(0,s.player.shield-dt);
 const direction=actions.findLast(a=>a>=1&&a<=4);if(direction)move(s,s.player,direction-1,dt,58);if(actions.includes(5))fire(s,s.player,'player');
 s.spawnTimer-=dt;
 if(s.spawned<4+s.wave*2&&s.enemies.length<Math.min(4,s.wave+1)&&s.spawnTimer<=0){
  const x=[24,152,296][Math.floor(random(s)*3)];
  if(clear(s,x,8)){s.enemies.push({x,y:8,dir:2,health:s.wave===3?2:1,cooldown:1.5,think:.3});s.spawned++;s.spawnTimer=2.2;}else s.spawnTimer=.35;
 }
 for(const enemy of s.enemies){
  enemy.cooldown=Math.max(0,enemy.cooldown-dt);enemy.think-=dt;
  if(enemy.think<=0){enemy.think=.5+random(s)*.7;const target=random(s)<.65?s.base:s.player;enemy.dir=random(s)<.25?Math.floor(random(s)*4):Math.abs(target.x-enemy.x)>Math.abs(target.y-enemy.y)?(target.x>enemy.x?1:3):(target.y>enemy.y?2:0);}
  if(!move(s,enemy,enemy.dir,dt,22+s.wave*3)){enemy.think=0;enemy.dir=Math.floor(random(s)*4);}
  fire(s,enemy,'enemy');
 }
 const remaining=[];
 for(const bullet of s.bullets){
  const [dx,dy]=DIR[bullet.dir];bullet.x+=dx*110*dt;bullet.y+=dy*110*dt;
  if(bullet.x<0||bullet.x>=320||bullet.y<0||bullet.y>=224)continue;
  const tx=Math.floor(bullet.x/16),ty=Math.floor(bullet.y/16),wall=s.map[ty][tx];
  if(wall){if(wall===1)s.map[ty][tx]=0;flash(s,bullet.x,bullet.y,wall===1?'#e9a65c':'#c0d0d8');continue;}
  if(Math.abs(bullet.x-s.base.x)<8&&Math.abs(bullet.y-s.base.y)<8){s.base.health--;flash(s,bullet.x,bullet.y,'#ffb852');if(s.base.health<=0)s.over=true;continue;}
  const target=bullet.team==='player'?s.enemies.find(e=>e.health>0&&Math.abs(bullet.x-e.x)<7&&Math.abs(bullet.y-e.y)<7):(s.player.health>0&&Math.abs(bullet.x-s.player.x)<7&&Math.abs(bullet.y-s.player.y)<7?s.player:null);
  if(target){if(target!==s.player||target.shield<=0){target.health--;flash(s,target.x,target.y,'#ffd16a');if(target===s.player){target.shield=1.6;if(target.health<=0)s.over=true;}else if(target.health<=0){s.score+=100*s.wave;s.kills++;}}continue;}
  remaining.push(bullet);
 }
 s.bullets=remaining;s.enemies=s.enemies.filter(e=>e.health>0);s.effects=s.effects.filter(e=>(e.life-=dt)>0);
 if(!s.over&&s.spawned>=4+s.wave*2&&s.enemies.length===0){if(s.wave===3){s.won=true;s.over=true;}else{s.wave++;s.spawned=0;s.spawnTimer=2.5;s.bullets=[];s.player.shield=2;flash(s,160,100,'#a1e4ba');}}
}
// Actions apply for this interval only; callers must repeat held controls.
export function stepTanks(state,dtSeconds,actions=[]){
 if(state.over||!Number.isFinite(dtSeconds)||dtSeconds<=0)return state;
 const accepted=Array.isArray(actions)?actions.filter(Number.isInteger):[];
 let remaining=Math.min(dtSeconds,2);while(remaining>1e-9&&!state.over){const dt=Math.min(remaining,1/120);tick(state,dt,accepted);remaining-=dt;}return state;
}
export function observeTanks(s){
 const enemy=s.enemies.reduce((best,e)=>!best||Math.abs(e.x-s.player.x)+Math.abs(e.y-s.player.y)<Math.abs(best.x-s.player.x)+Math.abs(best.y-s.player.y)?e:best,null);
 return {x:Math.floor(s.player.x/16),y:Math.floor(s.player.y/16),enemyX:enemy?Math.floor(enemy.x/16):-1,enemyY:enemy?Math.floor(enemy.y/16):-1,danger:s.bullets.some(b=>b.team==='enemy'&&Math.hypot(b.x-s.player.x,b.y-s.player.y)<64)?1:0,score:s.score,health:s.player.health};
}
function tank(ctx,t,color){ctx.fillStyle='#1a242c';ctx.fillRect(t.x-7,t.y-7,4,14);ctx.fillRect(t.x+3,t.y-7,4,14);ctx.fillStyle=color;ctx.fillRect(t.x-4,t.y-6,8,12);ctx.fillStyle='#e3ead5';ctx.fillRect(t.x-3,t.y-3,6,6);const [dx,dy]=DIR[t.dir];ctx.fillStyle=color;ctx.fillRect(t.x+Math.min(0,dx*10)-1,t.y+Math.min(0,dy*10)-1,dx?12:3,dy?12:3);}
export function drawTanks(ctx,s,w,h){
 ctx.save();ctx.scale(w/320,h/240);ctx.imageSmoothingEnabled=false;ctx.fillStyle='#0b171d';ctx.fillRect(0,0,320,240);ctx.fillStyle='#afc6bc';ctx.font='8px monospace';ctx.fillText(`↑${s.wave}  ${s.score}   ♥ ${s.player.health}   ⌂ ${s.base.health}`,5,11);ctx.translate(0,16);
 for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const wall=s.map[y][x];if(!wall)continue;ctx.fillStyle=wall===1?'#a66c43':'#8a9da3';ctx.fillRect(x*16,y*16,16,16);ctx.fillStyle=wall===1?'#4c342c':'#42565e';ctx.fillRect(x*16,y*16+7,16,2);ctx.fillRect(x*16+7,y*16,2,16);}
 ctx.fillStyle=s.base.health>0?'#e5c26b':'#574438';ctx.fillRect(s.base.x-7,s.base.y-7,14,14);ctx.fillStyle='#473d2a';ctx.fillRect(s.base.x-3,s.base.y-4,6,8);
 if(s.player.health>0){tank(ctx,s.player,'#8cddaa');if(s.player.shield>0){ctx.strokeStyle='#bce8ea';ctx.strokeRect(s.player.x-9,s.player.y-9,18,18);}}
 for(const e of s.enemies)tank(ctx,e,'#d6a076');for(const b of s.bullets){ctx.fillStyle=b.team==='player'?'#f7f3bb':'#ffb879';ctx.fillRect(Math.round(b.x)-1,Math.round(b.y)-1,3,3);}for(const e of s.effects){ctx.fillStyle=e.color;const r=3+(1-e.life/.22)*8;ctx.fillRect(e.x-r,e.y-2,r*2,4);ctx.fillRect(e.x-2,e.y-r,4,r*2);}
 if(s.over){ctx.fillStyle='#08151de6';ctx.fillRect(55,84,210,42);ctx.fillStyle='#e2eddb';ctx.font='bold 14px monospace';ctx.textAlign='center';ctx.fillText(s.won?'★ ★ ★':'×',160,111);}ctx.restore();
}
