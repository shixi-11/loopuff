// Aircraft silhouette with a quiet cockpit expression, shared by both flight modes.
export function drawPlane(ctx,x,y,size=86,time=0,angle=0){
 ctx.save();ctx.translate(x,y);ctx.scale(size/86,size/86);ctx.rotate(angle);
 const glow=ctx.createRadialGradient(0,22,2,0,28,49);glow.addColorStop(0,'#e7b77155');glow.addColorStop(1,'#e7b77100');ctx.fillStyle=glow;ctx.fillRect(-50,-5,100,90);
 ctx.fillStyle='#edbb78';ctx.beginPath();ctx.moveTo(-8,22);ctx.lineTo(0,47+(Math.sin(time*22)*6));ctx.lineTo(8,22);ctx.closePath();ctx.fill();
 ctx.fillStyle='#bdcdb7';ctx.beginPath();ctx.moveTo(0,-43);ctx.lineTo(38,21);ctx.lineTo(12,15);ctx.lineTo(0,26);ctx.lineTo(-12,15);ctx.lineTo(-38,21);ctx.closePath();ctx.fill();
 ctx.fillStyle='#ede7d2';ctx.beginPath();ctx.moveTo(0,-43);ctx.lineTo(12,17);ctx.lineTo(0,25);ctx.lineTo(-12,17);ctx.closePath();ctx.fill();
 const glass=ctx.createLinearGradient(-9,-21,9,3);glass.addColorStop(0,'#315b59');glass.addColorStop(1,'#173c3d');
 ctx.fillStyle=glass;ctx.beginPath();ctx.ellipse(0,-9,9.5,12.5,0,0,Math.PI*2);ctx.fill();
 const blink=time%5.8,eyeHeight=blink>5.55?Math.max(.45,3.1*Math.abs(blink-5.675)/.125):3.1;
 const gaze=Math.sin(time*.55)*.65;
 ctx.fillStyle='#e0edc7';for(const eye of [-3.8,3.8]){ctx.beginPath();ctx.ellipse(eye+gaze,-9,1.65,eyeHeight,0,0,Math.PI*2);ctx.fill();}
 ctx.strokeStyle='#92b7a0';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-22,12);ctx.lineTo(-12,-7);ctx.moveTo(22,12);ctx.lineTo(12,-7);ctx.stroke();ctx.restore();
}
