import { gamePrefix } from './routing.js';

export function createAccountClient({url,fetchImpl=fetch,onChange=()=>{}}){
  const endpoint=new URL(`${gamePrefix(new URL(url).pathname)}/api/account/`,url);
  const client={available:null,user:null,form:{mode:'login',email:'',password:''}};
  async function request(action,body){
    let response;
    try{response=await fetchImpl(endpoint,{method:body?'POST':'GET',credentials:'same-origin',signal:AbortSignal.timeout(15000),headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify({action,...body})}:{})});}
    catch{throw Object.assign(Error('NETWORK'),{code:'NETWORK'});}
    const data=await response.json().catch(()=>null);
    if(!response.ok||!data)throw Object.assign(Error(data?.error?.code||data?.code||'UNAVAILABLE'),{code:data?.error?.code||data?.code||'UNAVAILABLE'});
    return data;
  }
  client.load=async()=>{
    try{const data=await request('session');client.available=data.available!==false;client.user=data.user||null;}
    catch{client.available=false;client.user=null;}
    onChange(client);return client;
  };
  client.signIn=async()=>{
    const data=await request(client.form.mode==='register'?'sign-up':'sign-in',{email:client.form.email,password:client.form.password});
    if(!data.user?.id)throw Object.assign(Error('AUTH_FAILED'),{code:'AUTH_FAILED'});
    client.user=data.user;client.form.password='';onChange(client);
  };
  client.logout=async()=>{await request('logout',{});client.user=null;Object.assign(client.form,{mode:'login',email:'',password:''});onChange(client);};
  return client;
}

const html=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountAccount(root,{client,text:t,locale,saveNote,homeUrl}){
  let disposed=false,busy=false,message='',isError=false;
  const f=client.form;
  function render(){
    if(disposed)return;
    const signed=!!client.user;
    root.innerHTML=`<section class="account-page"><header><span class="eyebrow">${html(t.eyebrow)}</span><h1 id="learning-title">${html(signed?t.signed:f.mode==='register'?t.registerTitle:t.loginTitle)}</h1><p>${html(t.intro)}</p></header><div class="account-workspace"><aside class="account-story"><img src="${new URL('../assets/aircraft-2d.png',import.meta.url).href}" alt="" aria-hidden="true"><p>${html(saveNote)}</p><a data-action="home" href="${html(homeUrl)}">${html(t.guest)} <span aria-hidden="true">↗</span></a></aside><div class="account-form-area">${signed?`<p class="account-email" dir="ltr">${html(client.user.email||'')}</p><button type="button" class="text-button" data-account-action="logout">${html(t.logout)}</button>`:`<div class="account-tabs" role="group" aria-label="${html(t.entry)}"><button type="button" data-account-mode="login" aria-pressed="${f.mode==='login'}">${html(t.login)}</button><button type="button" data-account-mode="register" aria-pressed="${f.mode==='register'}">${html(t.register)}</button></div><form data-account-form><label for="account-email">${html(t.email)}</label><input id="account-email" type="email" name="email" autocomplete="email" maxlength="254" required dir="ltr" value="${html(f.email)}"><label for="account-password">${html(t.password)}</label><input id="account-password" type="password" name="password" autocomplete="${f.mode==='register'?'new-password':'current-password'}" minlength="${f.mode==='register'?10:1}" maxlength="128" required dir="ltr" value=""><small>${html(f.mode==='register'?t.passwordHint:'')}</small><button class="primary" type="submit">${html(f.mode==='register'?t.register:t.login)}</button></form>`}<p class="account-status" role="status" aria-live="polite" data-error="${isError}">${html(message||(!signed&&client.available===false?t.unavailable:''))}</p></div></div></section>`;
    const password=root.querySelector('#account-password');if(password)password.value=f.password;
    for(const control of root.querySelectorAll('button,input'))control.disabled=busy;
  }
  const input=event=>{if(event.target.id==='account-email')f.email=event.target.value.trim();if(event.target.id==='account-password')f.password=event.target.value;};
  async function perform(operation){
    if(busy)return;busy=true;message=t.busy;isError=false;render();
    try{await operation();message='';}
    catch(error){isError=true;message=['RATE_LIMITED','RATE_LIMIT','TOO_MANY_REQUESTS'].includes(error.code)?t.rate:['USER_ALREADY_EXISTS','USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL','SIGN_UP_REJECTED'].includes(error.code)?t.emailTaken:['PASSWORD_TOO_SHORT','INVALID_PASSWORD'].includes(error.code)?t.passwordHint:['INVALID_CREDENTIALS','AUTH_FAILED','INVALID_EMAIL_OR_PASSWORD'].includes(error.code)?t.invalidCredentials:error.code==='INVALID_EMAIL'?t.invalidEmail:error.code==='NETWORK'?t.network:t.unavailable;}
    finally{f.password='';busy=false;render();}
  }
  const submit=event=>{if(!event.target.matches('[data-account-form]'))return;event.preventDefault();perform(()=>client.signIn());};
  const click=event=>{
    const mode=event.target.closest('[data-account-mode]')?.dataset.accountMode;
    if(mode){f.mode=mode;f.password='';message='';render();return;}
    const action=event.target.closest('[data-account-action]')?.dataset.accountAction;
    if(action==='logout')perform(()=>client.logout());
  };
  root.addEventListener('input',input);root.addEventListener('submit',submit);root.addEventListener('click',click);render();
  return {refresh:render,dispose(){disposed=true;f.password='';root.removeEventListener('input',input);root.removeEventListener('submit',submit);root.removeEventListener('click',click);}};
}
