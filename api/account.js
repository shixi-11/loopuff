// Relay only the dedicated Loopuff account contract to the owner's Mac mini.
const upstream='https://games.tail1291c2.ts.net/loopuff/api/account';
const allowed=new Set(['https://shixilin.com','https://www.shixilin.com','https://loopuff.vercel.app','http://127.0.0.1:8773','http://localhost:8773']);
export function createAccountRelay({fetchImpl=fetch,target=upstream}={}){
  return async(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Cookie, Origin');
    const send=(status,data)=>res.status(status).json(data);
    if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return send(405,{error:{code:'METHOD_NOT_ALLOWED'}});}
    if(req.method==='POST'&&!allowed.has(req.headers?.origin))return send(403,{error:{code:'FORBIDDEN'}});
    let body;
    if(req.method==='POST'){
      try{body=typeof req.body==='string'?req.body:JSON.stringify(req.body??{});if(Buffer.byteLength(body)>4096)return send(413,{error:{code:'BODY_TOO_LARGE'}});JSON.parse(body);}
      catch{return send(400,{error:{code:'INVALID_JSON'}});}
    }
    const cookie=String(req.headers?.cookie||'').split(';').map(s=>s.trim()).filter(s=>/^(?:__Secure-)?loopuff[._-]/.test(s)).join('; ');
    try{
      const response=await fetchImpl(target,{method:req.method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{...(body?{'Content-Type':'application/json'}:{}),...(req.headers?.origin?{Origin:req.headers.origin}:{}),...(cookie?{Cookie:cookie}:{}),...(req.headers?.['x-real-ip']?{'X-Forwarded-For':req.headers['x-real-ip']}:{} )},...(body?{body}:{})});
      const data=await response.json();
      for(const item of response.headers.getSetCookie())if(/^(?:__Secure-)?loopuff[._-]/.test(item)){
        const cookies=res.getHeader('Set-Cookie')||[];res.setHeader('Set-Cookie',[...cookies,item]);
      }
      const value=data?.error?{error:{code:String(data.error.code||'AUTH_FAILED').slice(0,100)}}:{available:data?.available!==false,user:data?.user?{id:data.user.id,email:data.user.email}:null};
      return send(response.status,value);
    }catch{return send(503,{available:false,user:null,error:{code:'AUTH_UNAVAILABLE'}});}
  };
}
export default createAccountRelay();
