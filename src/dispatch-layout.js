// A page-scrolling aid only. It never owns code, reports or saved progress.
export function mountDispatchLayout(root,{view=globalThis.window,Observer=globalThis.ResizeObserver,header=root.ownerDocument?.querySelector('.masthead')}={}){
 if(!view||!Observer)return ()=>{};
 const dock=root.querySelector('.dispatch-editing');if(!dock)return ()=>{};
 let active=true;
 const update=()=>{
  if(!active)return;
  const headerHeight=header?.getBoundingClientRect().height||0;
  root.style.setProperty('--dispatch-sticky-top',`${headerHeight+16}px`);
  dock.dataset.sticky=String(dock.getBoundingClientRect().height+headerHeight+32<=view.innerHeight);
 };
 const observer=new Observer(update);observer.observe(dock);if(header)observer.observe(header);
 view.addEventListener('resize',update);update();
 return ()=>{active=false;observer.disconnect();view.removeEventListener('resize',update);root.style.removeProperty('--dispatch-sticky-top');delete dock.dataset.sticky;};
}

// Removing a stale report shortens the review column. Keep an already-focused
// desktop editor in view at that transition, without moving focus or the caret.
export function keepDispatchEditorVisible(root,{view=globalThis.window,header=root.ownerDocument?.querySelector('.masthead')}={}){
 if(!view||view.innerWidth<=800)return;
 const editor=root.querySelector('#dispatch-editor');if(!editor||root.ownerDocument?.activeElement!==editor)return;
 const box=editor.getBoundingClientRect(),headerHeight=header?.getBoundingClientRect().height||0;
 if(box.height>view.innerHeight-headerHeight-32)return;
 if(box.top<headerHeight+16||box.bottom>view.innerHeight-16)editor.scrollIntoView({block:'nearest',behavior:'instant'});
}
