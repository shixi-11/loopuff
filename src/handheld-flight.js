// Original geometric arcade art and deterministic simulation; no external assets.
const W=320,H=240,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
function wave(s){
 s.wave++;s.waveWait=0;
 for(let row=0;row<2;row++)for(let col=0;col<6;col++)s.enemies.push({x:40+col*47,y:25+row*28,homeX:40+col*47,homeY:25+row*28,phase:random(s)*6.28,dive:0,hp:s.wave>5?2:1,fire:1.8+random(s)*3});
}
export function createFlight(seed=1){
 const s={seed:Number(seed)>>>0,time:0,score:0,health:3,over:false,won:false,wave:0,waveWait:0,player:{x:160,y:208,shield:2,cooldown:0},enemies:[],bullets:[],effects:[],stars:[]};
 for(let i=0;i<48;i++)s.stars.push({x:random(s)*W,y:random(s)*H,speed:10+random(s)*30});
 wave(s);return s;
}
function burst(s,x,y,color){s.effects.push({x,y,color,life:.36});}
function hurt(s,x,y){if(s.player.shield>0)return;s.health--;s.player.shield=1.8;burst(s,x,y,'#ffca75');if(s.health<=0){s.health=0;s.over=true;}}
function tick(s,dt,actions){
 s.time+=dt;const p=s.player;
 p.cooldown=Math.max(0,p.cooldown-dt);p.shield=Math.max(0,p.shield-dt);
 const keys=new Set(actions),dx=Number(keys.has(2))-Number(keys.has(1)),dy=Number(keys.has(5))-Number(keys.has(4)),speed=dx&&dy?88:124;
 p.x=clamp(p.x+dx*speed*dt,9,W-9);p.y=clamp(p.y+dy*speed*dt,104,H-11);
 if(keys.has(3)&&p.cooldown<=0){s.bullets.push({x:p.x,y:p.y-10,vy:-220,enemy:false});p.cooldown=.18;}
 for(const star of s.stars)star.y=(star.y+star.speed*dt)%H;
 for(const fx of s.effects)fx.life-=dt;s.effects=s.effects.filter(f=>f.life>0);
 for(const e of s.enemies){
  e.phase+=dt;
  if(!e.dive&&s.time>3&&random(s)<dt*(.06+Math.min(s.wave,8)*.012))e.dive=1;
  if(e.dive){e.y+=(46+Math.min(s.wave,10)*4)*dt;e.x=clamp(e.x+Math.sin(e.phase*3)*40*dt,10,W-10);if(e.y>H+12){e.dive=0;e.y=e.homeY;}}
  else{e.x=e.homeX+Math.sin(e.phase*1.8)*12;e.y=e.homeY+Math.sin(e.phase)*3;}
  e.fire-=dt;if(e.fire<=0){e.fire=2.5+random(s)*2;s.bullets.push({x:e.x,y:e.y+9,vy:55+Math.min(s.wave,10)*4,enemy:true});}
  if(Math.abs(e.x-p.x)<12&&Math.abs(e.y-p.y)<13){hurt(s,p.x,p.y);e.hp=0;burst(s,e.x,e.y,'#ff777d');}
 }
 for(const b of s.bullets){
  b.y+=b.vy*dt;
  if(b.enemy){if(Math.abs(b.x-p.x)<7&&Math.abs(b.y-p.y)<8){hurt(s,p.x,p.y);b.dead=true;}}
  else for(const e of s.enemies)if(e.hp>0&&Math.abs(b.x-e.x)<11&&Math.abs(b.y-e.y)<10){b.dead=true;e.hp--;burst(s,b.x,b.y,'#9fffee');if(e.hp===0)s.score+=100;break;}
 }
 s.bullets=s.bullets.filter(b=>!b.dead&&b.y>-12&&b.y<H+12);s.enemies=s.enemies.filter(e=>e.hp>0);
 if(!s.enemies.length){s.waveWait+=dt;if(s.waveWait>1.1){s.bullets=s.bullets.filter(b=>!b.enemy);p.shield=Math.max(p.shield,1);wave(s);}}
}
// Substeps prevent tunnelling. Long suspended frames advance at most half a second.
export function stepFlight(s,dtSeconds,actions=[]){
 if(s.over||!Number.isFinite(dtSeconds)||dtSeconds<=0)return s;
 let remaining=Math.min(dtSeconds,.5);while(remaining>1e-8&&!s.over){const dt=Math.min(remaining,1/120);tick(s,dt,Array.isArray(actions)?actions:[]);remaining-=dt;}return s;
}
export function observeFlight(s){
 const p=s.player,enemies=s.enemies.filter(e=>e.hp>0),target=enemies.reduce((a,e)=>!a||Math.abs(e.x-p.x)<Math.abs(a.x-p.x)?e:a,null);
 const danger=s.bullets.some(b=>b.enemy&&Math.abs(b.x-p.x)<18&&b.y<p.y&&p.y-b.y<65)||enemies.some(e=>Math.abs(e.x-p.x)<22&&Math.abs(e.y-p.y)<48);
 return {x:Math.round(p.x),y:Math.round(p.y),enemyX:target?Math.round(target.x):-1,enemyY:target?Math.round(target.y):-1,danger:Number(danger),score:s.score,health:s.health};
}
function plane(c,x,y,enemy){
 x=Math.round(x);y=Math.round(y);c.fillStyle=enemy?'#c4a97b':'#dbe5dc';
 c.fillRect(x-2,y-8,4,16);c.fillRect(x-8,y-1,16,5);c.fillRect(x-5,y+6,10,3);
 c.fillStyle=enemy?'#e8d7b2':'#6f9999';c.fillRect(x-1,y-4,2,4);
}
export function drawFlight(ctx,s,w=W,h=H){
 ctx.save();ctx.scale(w/W,h/H);ctx.imageSmoothingEnabled=false;ctx.fillStyle='#090f29';ctx.fillRect(0,0,W,H);
 for(const star of s.stars){ctx.fillStyle=star.speed>25?'#a9bad1':'#435375';ctx.fillRect(Math.floor(star.x),Math.floor(star.y),1,star.speed>30?2:1);}
 for(const e of s.enemies)plane(ctx,e.x,e.y,true);
 for(const b of s.bullets){ctx.fillStyle=b.enemy?'#ffb45f':'#a2ffdd';ctx.fillRect(Math.round(b.x)-1,Math.round(b.y)-3,2,6);}
 if(!s.over&&(s.player.shield<=0||Math.floor(s.time*12)%2===0))plane(ctx,s.player.x,s.player.y,false);
 if(s.player.shield>0&&!s.over){ctx.strokeStyle='#76d9f9';ctx.strokeRect(Math.round(s.player.x)-11,Math.round(s.player.y)-12,22,25);}
 for(const fx of s.effects){const r=Math.floor((.36-fx.life)*35)+2;ctx.fillStyle=fx.color;for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.fillRect(Math.round(fx.x+Math.cos(a)*r),Math.round(fx.y+Math.sin(a)*r),3,3);}}
 ctx.fillStyle='#b3fff4';ctx.font='10px monospace';ctx.textAlign='left';ctx.fillText(String(s.score).padStart(6,'0'),7,12);ctx.textAlign='right';ctx.fillText('♥'.repeat(s.health),313,12);
 if(s.over){ctx.fillStyle='#090f29dd';ctx.fillRect(62,99,196,43);ctx.fillStyle='#e2fffa';ctx.textAlign='center';ctx.font='20px monospace';ctx.fillText('×',160,126);}
 ctx.restore();
}
