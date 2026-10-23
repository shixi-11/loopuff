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
  if(suffix.length===2&&suffix[1]==='guide')return {locale,view:'guide'};
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
export function routeUrl(input,locale,view='home',lessonId){
  const id=localeId(locale);if(!id)throw Error('Unsupported language');
  if(!['home','levels','guide','lesson','result'].includes(view))throw Error('Unsupported page');
  if(['lesson','result'].includes(view)&&!course.some(lesson=>lesson.id===lessonId))throw Error('Unknown lesson');
  const url=new URL(input),suffix=view==='levels'?'levels/':view==='guide'?'guide/':['lesson','result'].includes(view)?`learn/${lessonId}/${view==='result'?'result/':''}`:'';
  url.pathname=`${gamePrefix(url.pathname)}/${id}/${suffix}`;
  url.searchParams.delete('lang');return url;
}
