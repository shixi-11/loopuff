export function cartridgeArt(id){
 const head='<svg viewBox="0 0 160 100" shape-rendering="crispEdges" aria-hidden="true">',rect=(x,y,w,h,c)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
 if(id==='blocks')return head+[[40,38,12,12,'#ce947e'],[52,38,12,12,'#ce947e'],[52,26,12,12,'#ce947e'],[76,50,12,12,'#a69bca'],[88,50,12,12,'#a69bca'],[88,38,12,12,'#a69bca'],[100,62,12,12,'#d6b874'],[112,62,12,12,'#d6b874'],[100,74,12,12,'#d6b874'],[112,74,12,12,'#d6b874'],[40,62,12,12,'#8dbda9'],[52,62,12,12,'#8dbda9'],[64,62,12,12,'#8dbda9'],[52,74,12,12,'#8dbda9']].map(v=>rect(...v)).join('')+'</svg>';
 if(id==='tanks')return head+rect(44,30,12,48,'#72847f')+rect(104,30,12,48,'#72847f')+rect(56,34,48,38,'#c7ac70')+rect(68,24,24,36,'#e2c48a')+rect(76,12,8,32,'#c7ac70')+rect(72,50,16,8,'#384d4d')+'</svg>';
 if(id==='flight')return head+rect(76,20,8,60,'#b8d5e1')+rect(68,36,24,28,'#a0c1d2')+rect(52,52,56,12,'#b8d5e1')+rect(60,64,12,8,'#a0c1d2')+rect(88,64,12,8,'#a0c1d2')+rect(76,80,8,12,'#d6b874')+'</svg>';
 return head+rect(64,24,32,20,'#c68f7f')+rect(60,32,40,12,'#c68f7f')+rect(68,36,24,8,'#243c43')+rect(68,46,24,24,'#a37875')+rect(60,46,8,20,'#c68f7f')+rect(92,46,8,20,'#c68f7f')+rect(68,70,8,16,'#c68f7f')+rect(84,70,8,16,'#c68f7f')+'</svg>';
}
