import {inspectHomeSignal} from './home.js';
import {pathEntrances} from './learning-paths-ui.js';
import {arcadeArt} from './arcade-art.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function homeSections({text:t,paths,guide,urls,games}){
 return `<section class="home-routes" aria-labelledby="home-routes-title"><header><h2 id="home-routes-title">${esc(t.routeTitle)}</h2><p>${esc(t.routeIntro)}</p></header>${pathEntrances(paths,urls)}</section>
 <section class="home-games" aria-labelledby="home-games-title"><header><div><h2 id="home-games-title">${esc(t.practiceTitle)}</h2><p>${esc(t.practiceIntro)}</p></div><a data-action="open-play" href="${esc(urls.play)}">${esc(t.allGames)} ↗</a></header><div class="home-game-grid">${games.map((game,index)=>`<a data-action="open-${game.id}" class="home-game" href="${esc(urls[game.id])}"><div class="home-game-art" aria-hidden="true">${game.id==='vault'?arcadeArt('vault'):game.art}</div><h3>${esc(game.title)} <span aria-hidden="true">↗</span></h3><p>${esc(t.gameNotes[index])}</p></a>`).join('')}</div></section>
 <section class="home-method" aria-labelledby="home-method-title"><h2 id="home-method-title">${esc(t.roadTitle)}</h2><ol>${t.roadSteps.map(([title,body],i)=>`<li><span aria-hidden="true">0${i+1}</span><h3>${esc(title)}</h3><p>${esc(body)}</p></li>`).join('')}</ol></section>
 <section class="home-help"><div><h2>${esc(t.helpTitle)}</h2><p>${esc(t.help)}</p></div><div><a data-action="open-map" href="${esc(urls.map)}">${esc(guide.mapLabel)} ↗</a><a data-action="open-compare" href="${esc(urls.compare)}">${esc(guide.compareLabel)} ↗</a></div></section>`;
}
export function mountHomeDemo(root,{text:t,model}){
 model.value??='7';
 root.innerHTML=`<header><span class="home-demo-dot" aria-hidden="true"></span><h2>${esc(t.demoTitle)}</h2></header><p>${esc(t.demoIntro)}</p><form id="home-demo-form"><label for="home-number">${esc(t.number)}</label><div class="home-demo-code" dir="ltr"><input id="home-number" type="text" inputmode="numeric" maxlength="2" pattern="[0-9]{1,2}" autocomplete="off" required value="${esc(model.value)}"><code>.log()</code></div><button class="primary" type="submit">${esc(t.run)} <span aria-hidden="true">▶</span></button></form><div class="home-demo-result"><span>${esc(t.result)}</span><output for="home-number" dir="ltr"></output><p role="status" aria-live="polite"></p></div><p class="home-demo-meaning">${esc(t.meaning).replaceAll('.log()','<bdi dir="ltr"><code>.log()</code></bdi>')}</p>`;
 function paint(){root.querySelector('output').textContent=model.report?.ok?model.report.logs.join(' → '):'—';root.querySelector('[role=status]').textContent=model.report?model.report.ok?'':t.invalid:model.changed?t.changed:t.ready;root.dataset.ran=String(!!model.report?.ok);}
 function input(event){if(event.target.id!=='home-number')return;model.value=event.target.value;model.report=null;model.changed=true;paint();}
 function submit(event){if(event.target.id!=='home-demo-form')return;event.preventDefault();model.report=inspectHomeSignal(model.value);model.changed=false;paint();}
 root.addEventListener('input',input);root.addEventListener('submit',submit);paint();
 return {dispose(){root.removeEventListener('input',input);root.removeEventListener('submit',submit);}};
}
