const allowed=new Set(['https://shixilin.com','https://www.shixilin.com','https://loopuff.vercel.app','http://127.0.0.1:8773','http://localhost:8773','http://127.0.0.1:8775','http://localhost:8775']);
export function createLoopuffRelay({target,bodyLimit,filter,unavailable,fetchImpl=fetch,checkGetOrigin=false}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Cookie, Origin');
  const send=(status,value)=>res.status(status).json(value);
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return send(405,{error:{code:'METHOD_NOT_ALLOWED'}});}
  if((req.method==='POST'&&!allowed.has(req.headers?.origin))||(checkGetOrigin&&req.headers?.origin&&!allowed.has(req.headers.origin)))return send(403,{error:{code:'FORBIDDEN'}});
  let body;
  if(req.method==='POST'){
   try{body=typeof req.body==='string'?req.body:JSON.stringify(req.body??{});if(Buffer.byteLength(body)>bodyLimit)return send(413,{error:{code:'BODY_TOO_LARGE'}});JSON.parse(body);}
   catch{return send(400,{error:{code:'INVALID_JSON'}});}
  }
  const cookie=String(req.headers?.cookie||'').split(';').map(item=>item.trim()).filter(item=>/^(?:__Secure-)?loopuff[._-]/.test(item)).join('; ');
  try{
   const response=await fetchImpl(target,{method:req.method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{...(body?{'Content-Type':'application/json'}:{}),...(req.headers?.origin?{Origin:req.headers.origin}:{}),...(cookie?{Cookie:cookie}:{}),...(req.headers?.['x-real-ip']?{'X-Forwarded-For':req.headers['x-real-ip']}:{})},...(body?{body}:{})});
   const data=await response.json(),value=filter(data);
   for(const item of response.headers.getSetCookie())if(/^(?:__Secure-)?loopuff[._-]/.test(item))res.setHeader('Set-Cookie',[...(res.getHeader('Set-Cookie')||[]),item]);
   return send(response.status,value);
  }catch{return send(503,unavailable);}
 };
}
