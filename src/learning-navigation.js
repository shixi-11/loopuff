const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function actionAttribute(action){
 if(action===undefined||action===null||action==='')return '';
 return ` data-action="${esc(action)}"`;
}

export function renderLearningNavigation({label,shortLabel=label,href,active=false,items=[]}={}){
 const menuItems=(Array.isArray(items)?items:[]).map(item=>`<a class="learning-navigation-item${item.active?' is-active':''}" href="${esc(item.href)}"${actionAttribute(item.action)}${item.active?' aria-current="page"':''}>${esc(item.label)}</a>`).join('');
 return `<div class="learning-navigation${active?' is-active':''}"><a class="learning-navigation-parent" data-action="open-guide" href="${esc(href)}"${active?' aria-current="page"':''}><span class="nav-label-full">${esc(label)}</span><span class="nav-label-short">${esc(shortLabel)}</span></a><button class="learning-navigation-caret" type="button" data-learning-menu aria-expanded="false" aria-controls="learning-navigation-panel" aria-label="${esc(label)}">⌄</button><div class="learning-navigation-panel" id="learning-navigation-panel" hidden>${menuItems}</div></div>`;
}

export function mountLearningNavigation(root){
 let disposed=false;
 const nav=root?.querySelector?.('.learning-navigation');
 const caret=nav?.querySelector?.('[data-learning-menu]');
 const panel=nav?.querySelector?.('#learning-navigation-panel');
 if(!nav||!caret||!panel)return {dispose(){disposed=true;}};
 const setOpen=open=>{
  if(disposed)return;
  panel.hidden=!open;
  caret.setAttribute('aria-expanded',String(open));
  nav.classList.toggle('is-menu-open',open);
 };
 const toggle=()=>setOpen(panel.hidden);
 const close=()=>setOpen(false);
 const onCaretClick=event=>{event.preventDefault();event.stopPropagation();toggle();};
 const onPanelClick=event=>{if(event.target?.closest?.('a'))close();};
 const onDocumentClick=event=>{if(!nav.contains(event.target))close();};
 const onKeyDown=event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault?.();event.stopPropagation?.();close();caret.focus?.({preventScroll:true});}};
 caret.addEventListener('click',onCaretClick);
 panel.addEventListener('click',onPanelClick);
 const ownerDocument=root.ownerDocument||globalThis.document;
 ownerDocument?.addEventListener?.('click',onDocumentClick);
 ownerDocument?.addEventListener?.('keydown',onKeyDown,true);
 return {dispose(){
  if(disposed)return;
  disposed=true;caret.removeEventListener('click',onCaretClick);panel.removeEventListener('click',onPanelClick);ownerDocument?.removeEventListener?.('click',onDocumentClick);ownerDocument?.removeEventListener?.('keydown',onKeyDown,true);
 }};
}
