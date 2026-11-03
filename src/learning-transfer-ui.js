import {dispatchIds} from './dispatch.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const protocol=value=>String(value).split(/(\b(?:cargo|threshold|docks|offset|fuel|reserve|west|east)\b)/).map((part,i)=>i%2?`<bdi dir="ltr">${esc(part)}</bdi>`:esc(part)).join('');
export function applicationPanel(mission,{text,titles,context,href}){
 if(!mission)return '';
 const index=dispatchIds.indexOf(mission);if(index<0)throw Error('Unknown dispatch mission');
 return `<aside class="learning-application"><span class="eyebrow">${esc(text.title)}</span><h3>${esc(titles[index])}</h3><p>${esc(text[context])}</p><p>${protocol(text.protocols[mission])}</p><a class="text-button" data-action="open-dispatch" data-mission="${mission}" href="${esc(href)}">${esc(text.apply.replace('{mission}',titles[index]))} <span aria-hidden="true">↗</span></a></aside>`;
}
