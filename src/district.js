export const districtSize={width:1920,height:1280};
// Measured against the approved 1536×1024 street artwork, at world scale 1.25.
const columns=[{x:140,w:365,door:320},{x:575,w:365,door:755},{x:1000,w:365,door:1180},{x:1425,w:355,door:1600}];
export const districtBuildings=Array.from({length:8},(_,i)=>({x:columns[i%4].x,y:i<4?200:710,w:columns[i%4].w,h:360,doorX:columns[i%4].door,doorY:i<4?560:1070}));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const bounded=p=>({x:clamp(Number.isFinite(p.x)?p.x:320,90,1830),y:clamp(Number.isFinite(p.y)?p.y:620,180,1190)});
// The solid footprint is around the feet, not the hood above them.
export function districtClear(p){return p.x>=90&&p.x<=1830&&p.y>=180&&p.y<=1190&&districtBuildings.every(b=>p.x+20<=b.x||p.x-20>=b.x+b.w||p.y+12<=b.y||p.y-12>=b.y+b.h);}
function segmentClear(a,b){const steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/6);for(let i=0;i<=steps;i++){const t=steps?i/steps:0;if(!districtClear({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}))return false;}return true;}
const GRID=20,COLS=96,ROWS=64;
const cells=Array.from({length:COLS*ROWS},(_,i)=>({x:(i%COLS)*GRID,y:Math.floor(i/COLS)*GRID}));
function nearest(p){let index=-1,best=Infinity;for(let i=0;i<cells.length;i++){const c=cells[i],d=(c.x-p.x)**2+(c.y-p.y)**2;if(d<best&&districtClear(c)){index=i;best=d;}}return index;}
export function districtPosition(point={}){const p=bounded(point);return districtClear(p)?p:{...cells[nearest(p)]};}
export function districtStep(position,direction,seconds){
 const p=districtPosition(position),length=Math.hypot(direction.x,direction.y);if(!length||!Number.isFinite(seconds)||seconds<=0)return p;
 const distance=180*Math.min(seconds,.05)/Math.max(1,length),dx=direction.x*distance,dy=direction.y*distance;
 // Separate axes let diagonal input slide along a building edge.
 if(districtClear({x:p.x+dx,y:p.y}))p.x+=dx;if(districtClear({x:p.x,y:p.y+dy}))p.y+=dy;return p;
}
export function districtCamera(x,y,width,height){return {x:clamp(x-width/2,0,Math.max(0,1920-width)),y:clamp(y-height/2,0,Math.max(0,1280-height))};}
export function districtPoint(client,rect,camera,viewport){return {x:camera.x+(client.x-rect.left)*viewport.width/rect.width,y:camera.y+(client.y-rect.top)*viewport.height/rect.height};}
export function districtShopAt(point,count=8){return districtBuildings.slice(0,count).findIndex(b=>point.x>=b.x&&point.x<=b.x+b.w&&point.y>=b.y&&point.y<=b.doorY);}
export function districtNear(position,count=8){return districtBuildings.slice(0,count).findIndex(b=>Math.abs(position.x-b.doorX)<=70&&position.y>=b.doorY-10&&position.y<=b.doorY+80);}
// Four-neighbour BFS. Its segments share keyboard movement's collision rules.
export function districtPath(start,end){
 const a=districtPosition(start),b=bounded(end);if(!districtClear(b))return [];
 function endpoint(p){let best=-1,distance=Infinity;for(let i=0;i<cells.length;i++){const c=cells[i],d=(c.x-p.x)**2+(c.y-p.y)**2;if(d<distance&&districtClear(c)&&segmentClear(p,c)){best=i;distance=d;}}return best;}
 const first=endpoint(a),last=endpoint(b);if(first<0||last<0)return [];
 const previous=new Int32Array(cells.length).fill(-1),queue=[first];previous[first]=first;
 for(let head=0;head<queue.length&&previous[last]<0;head++){
  const current=queue[head],col=current%COLS,row=Math.floor(current/COLS);
  for(const [dc,dr]of [[1,0],[-1,0],[0,1],[0,-1]]){
   const nx=col+dc,ny=row+dr;if(nx<0||nx>=COLS||ny<0||ny>=ROWS)continue;const next=ny*COLS+nx;
   if(previous[next]<0&&districtClear(cells[next])&&segmentClear(cells[current],cells[next])){previous[next]=current;queue.push(next);}
  }
 }
 if(previous[last]<0)return [];
 const route=[];for(let i=last;;i=previous[i]){route.push({...cells[i]});if(i===first)break;}route.reverse();route.push(b);
 return route.filter((p,i)=>Math.hypot(p.x-(i?route[i-1].x:a.x),p.y-(i?route[i-1].y:a.y))>.1);
}
