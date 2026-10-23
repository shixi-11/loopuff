// Original Loopuff aircraft, shared by the flight and distance missions.
export function drawPlane(ctx,x,y,size=86,time=0,angle=0){
 ctx.save();ctx.translate(x,y);ctx.scale(size/86,size/86);ctx.rotate(angle);
 const glow=ctx.createRadialGradient(0,22,2,0,28,49);glow.addColorStop(0,'#e7b77155');glow.addColorStop(1,'#e7b77100');ctx.fillStyle=glow;ctx.fillRect(-50,-5,100,90);
 ctx.fillStyle='#edbb78';ctx.beginPath();ctx.moveTo(-8,22);ctx.lineTo(0,47+(Math.sin(time*22)*6));ctx.lineTo(8,22);ctx.closePath();ctx.fill();
 ctx.fillStyle='#bdcdb7';ctx.beginPath();ctx.moveTo(0,-43);ctx.lineTo(38,21);ctx.lineTo(12,15);ctx.lineTo(0,26);ctx.lineTo(-12,15);ctx.lineTo(-38,21);ctx.closePath();ctx.fill();
 ctx.fillStyle='#ede7d2';ctx.beginPath();ctx.moveTo(0,-43);ctx.lineTo(12,17);ctx.lineTo(0,25);ctx.lineTo(-12,17);ctx.closePath();ctx.fill();
 ctx.fillStyle='#345d5b';ctx.beginPath();ctx.ellipse(0,-9,6,14,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#92b7a0';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-22,12);ctx.lineTo(-12,-7);ctx.moveTo(22,12);ctx.lineTo(12,-7);ctx.stroke();ctx.restore();
}
