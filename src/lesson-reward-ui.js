const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountLessonReward(root,{client,account,text:t,lessonId,source,accountUrl,boardUrl}){
 let disposed=false,busy=false,done=false,amount=0,failed=false,version=0;
 const identity=account.user?.id;
 function render(){
  if(disposed)return;
  const signed=!!account.user?.id;
  root.innerHTML=`<section class="lesson-reward"><span>${esc(t.coins)}</span><p role="status">${esc(busy?t.rewardSaving:done?`${t.claimed} · +${amount} ${t.coins}`:failed?t.rewardError:signed?t.rules[0]:t.login)}</p>${!signed?`<a data-action="open-account" href="${esc(accountUrl)}">${esc(t.signIn)} ↗</a>`:!done?`<button type="button" data-reward${busy?' disabled':''}>${esc(failed?t.retry:t.claimReward)}</button>`:''}<a data-action="open-leaderboard" href="${esc(boardUrl)}">${esc(t.title)} ↗</a></section>`;
 }
 async function claim(){
  if(busy||done||!account.user?.id||account.user.id!==identity)return;
  const own=++version;busy=true;failed=false;render();
  try{const result=await client.claim(lessonId,source);if(disposed||own!==version||account.user?.id!==identity)return;amount=result.awarded;done=true;}
  catch{if(!disposed&&own===version)failed=true;}
  finally{if(!disposed&&own===version){busy=false;render();}}
 }
 const click=event=>{if(event.target.closest('[data-reward]'))void claim();};
 root.addEventListener('click',click);render();if(identity)void claim();
 return {refresh(){if(account.user?.id!==identity){version++;busy=false;done=false;amount=0;}render();},dispose(){disposed=true;version++;root.removeEventListener('click',click);}};
}
