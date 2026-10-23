// A hand-drawn spacecraft using the same triangular silhouette as the mark.
// Canvas paths stay sharp at every display size and need no image download.
export function whenPlaneReady(redraw){redraw();return ()=>{};}
export function drawPlane(ctx,x,y,size=110,time=0,angle=0){
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(size/86,size/86);
 const breathing=Math.sin(time*8)*2;
 // A gentle thrust trail and banking carry the motion.
 ctx.fillStyle='#edbd73';ctx.beginPath();ctx.moveTo(-6,22);ctx.quadraticCurveTo(-7,33,0,43+breathing);ctx.quadraticCurveTo(7,33,6,22);ctx.closePath();ctx.fill();
 ctx.fillStyle='#fff0c7';ctx.beginPath();ctx.moveTo(-2.5,23);ctx.quadraticCurveTo(-3,29,0,35+breathing*.5);ctx.quadraticCurveTo(3,29,2.5,23);ctx.closePath();ctx.fill();
 // Broad, gently curved wings retain the early aircraft silhouette.
 ctx.fillStyle='#a9c3ad';ctx.beginPath();ctx.moveTo(0,-41);ctx.bezierCurveTo(6,-28,14,-5,36,18);ctx.quadraticCurveTo(41,25,33,23);ctx.lineTo(12,17);ctx.quadraticCurveTo(0,30,-12,17);ctx.lineTo(-33,23);ctx.quadraticCurveTo(-41,25,-36,18);ctx.bezierCurveTo(-14,-5,-6,-28,0,-41);ctx.closePath();ctx.fill();
 ctx.fillStyle='#f5efd9';ctx.beginPath();ctx.moveTo(0,-41);ctx.bezierCurveTo(4,-26,7,0,13,19);ctx.quadraticCurveTo(0,30,-13,19);ctx.bezierCurveTo(-7,0,-4,-26,0,-41);ctx.closePath();ctx.fill();
 ctx.fillStyle='#e2e3cc';ctx.beginPath();ctx.moveTo(0,-41);ctx.bezierCurveTo(-4,-26,-7,0,-13,19);ctx.quadraticCurveTo(-8,25,0,26);ctx.closePath();ctx.fill();
 ctx.fillStyle='#345a56';ctx.beginPath();ctx.ellipse(0,-10,5,9,0,0,Math.PI*2);ctx.fill();
 ctx.restore();
}
