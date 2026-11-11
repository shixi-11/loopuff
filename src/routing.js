import { course, locales } from './course.js';
const ids=new Set(locales.map(([id])=>id));
export function localeId(value){
  if(typeof value!=='string')return null;
  if(ids.has(value))return value;
  const tag=value.toLowerCase();
  if(/^zh-(?:hant|tw|hk|mo)(?:-|$)/.test(tag))return 'zh-Hant';
  if(tag==='zh'||tag.startsWith('zh-'))return 'zh';
  const short=tag.split('-')[0];return ids.has(short)?short:null;
}
export function gamePrefix(pathname){return /^\/games\/loopuff(?:\/|$)/.test(pathname)?'/games/loopuff':'';}
export function pathLocale(pathname){
  return parseRoute(pathname)?.locale||null;
}
export function parseRoute(pathname){
  const suffix=pathname.slice(gamePrefix(pathname).length).split('/').filter(Boolean);
  const locale=localeId(suffix[0]);if(!locale)return null;
  if(suffix.length===1)return {locale,view:'home'};
  if(suffix.length===2&&suffix[1]==='levels')return {locale,view:'levels'};
  if(suffix.length===2&&suffix[1]==='account')return {locale,view:'account'};
  if(suffix.length===2&&suffix[1]==='saves')return {locale,view:'saves'};
  if(suffix.length===2&&suffix[1]==='guide')return {locale,view:'guide'};
  if(suffix.length===3&&suffix[1]==='guide'&&['start','advance'].includes(suffix[2]))return {locale,view:suffix[2]};
  if(suffix.length===3&&suffix[1]==='guide'&&suffix[2]==='compare')return {locale,view:'compare'};
  if(suffix.length===3&&suffix[1]==='guide'&&suffix[2]==='check')return {locale,view:'check'};
  if(suffix.length===3&&suffix[1]==='guide'&&suffix[2]==='map')return {locale,view:'map'};
  if(suffix.length===2&&suffix[1]==='play')return {locale,view:'play'};
  if(suffix.length===3&&suffix[1]==='play'&&suffix[2]==='vault')return {locale,view:'vault'};
  if(suffix.length===3&&suffix[1]==='play'&&suffix[2]==='chase')return {locale,view:'chase'};
  if(suffix.length===3&&suffix[1]==='play'&&suffix[2]==='dispatch')return {locale,view:'dispatch'};
  if(suffix.length===3&&suffix[1]==='play'&&suffix[2]==='heist')return {locale,view:'heist'};
  if(suffix[1]==='learn'&&course.some(lesson=>lesson.id===suffix[2])){
    if(suffix.length===3)return {locale,view:'lesson',lessonId:suffix[2]};
    if(suffix.length===4&&suffix[3]==='result')return {locale,view:'result',lessonId:suffix[2]};
  }
  return null;
}
export function selectedLocale(input,saved,browser=[]){
  const url=new URL(input);
  const explicit=pathLocale(url.pathname);if(explicit)return explicit;
  return localeId(saved)||browser.map(localeId).find(Boolean)||'en';
}
export function languageUrl(input,locale){
  const url=new URL(input),route=parseRoute(url.pathname);
  return routeUrl(input,locale,route?.view||'home',route?.lessonId);
}
export function learningRouteUrl(input,locale,view='lesson',lessonId){
 const path=new URL(input).searchParams.get('path'),url=routeUrl(input,locale,view,lessonId);url.search='';url.hash='';
 if(['start','advance'].includes(path))url.searchParams.set('path',path);
 return url.href;
}
export function routeUrl(input,locale,view='home',lessonId){
  const id=localeId(locale);if(!id)throw Error('Unsupported language');
  if(!['home','levels','guide','start','advance','compare','map','check','lesson','result','play','vault','chase','dispatch','heist','account','saves'].includes(view))throw Error('Unsupported page');
  if(['lesson','result'].includes(view)&&!course.some(lesson=>lesson.id===lessonId))throw Error('Unknown lesson');
  const url=new URL(input),suffix=view==='heist'?'play/heist/':view==='check'?'guide/check/':view==='map'?'guide/map/':view==='compare'?'guide/compare/':view==='saves'?'saves/':view==='dispatch'?'play/dispatch/':view==='chase'?'play/chase/':view==='account'?'account/':view==='levels'?'levels/':view==='guide'?'guide/':view==='play'?'play/':view==='vault'?'play/vault/':['lesson','result'].includes(view)?`learn/${lessonId}/${view==='result'?'result/':''}`:'';
  url.pathname=`${gamePrefix(url.pathname)}/${id}/${['start','advance'].includes(view)?`guide/${view}/`:suffix}`;
  url.searchParams.delete('lang');return url;
}
