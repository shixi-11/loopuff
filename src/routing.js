import { locales } from './course.js';
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
  const suffix=pathname.slice(gamePrefix(pathname).length).split('/').filter(Boolean);
  return suffix.length===1?localeId(suffix[0]):null;
}
export function selectedLocale(input,saved,browser=[]){
  const url=new URL(input);
  const explicit=pathLocale(url.pathname);if(explicit)return explicit;
  return localeId(saved)||browser.map(localeId).find(Boolean)||'en';
}
export function languageUrl(input,locale){
  const id=localeId(locale);if(!id)throw Error('Unsupported language');
  const url=new URL(input);url.pathname=`${gamePrefix(url.pathname)}/${id}/`;
  url.searchParams.delete('lang');return url;
}
