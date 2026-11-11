import {replayPursuitPractice} from './pursuit-practice.js';
import {mountPursuitScene} from './pursuit-scene.js';
export function mountPursuitPracticeReplay(root,{world,item,text,sceneText,roles}){
 const replay=replayPursuitPractice(world,item);if(!replay)return;
 let index=0,disposed=false;
 root.innerHTML='<p data-replay-note></p><div class="pursuit-scene pursuit-practice-scene"><canvas aria-hidden="true"></canvas><p data-replay-loading></p></div><div class="pursuit-code-actions"><button type="button" data-replay="previous"></button><button type="button" data-replay="next"></button></div><p data-replay-status role="status" aria-live="polite"></p>';
 const el=selector=>root.querySelector(selector);
 el('[data-replay-note]').textContent=text.previewNote;el('[data-replay-loading]').textContent=sceneText.loading;
 el('[data-replay="previous"]').textContent=text.previousFrame;el('[data-replay="next"]').textContent=text.nextFrame;
 const scene=mountPursuitScene(el('.pursuit-scene'),{getState:()=>replay.frames[index],text:sceneText,roles,onError:()=>{el('[data-replay-loading]').textContent=sceneText.artError;}});
 function paint(){const state=replay.frames[index],actor=state.actors[state.role];el('[data-replay="previous"]').disabled=index===0;el('[data-replay="next"]').disabled=index===replay.frames.length-1;
  el('[data-replay-status]').textContent=`${(state.activeMs/1000).toFixed(1)} s · ${actor.collisions?text.previewBlocked:actor.clears?text.previewCleared:actor.jumpMs?text.previewJumping:text['action'+replay.action]}`;scene.draw();}
 function click(event){const action=event.target.closest('[data-replay]')?.dataset.replay;if(action==='next')index=Math.min(replay.frames.length-1,index+1);else if(action==='previous')index=Math.max(0,index-1);else return;paint();if(index===replay.frames.length-1)el('[data-replay="previous"]').focus({preventScroll:true});else if(index===0)el('[data-replay="next"]').focus({preventScroll:true});}
 root.addEventListener('click',click);scene.ready.then(ok=>{if(!disposed&&ok)el('[data-replay-loading]').hidden=true;});paint();
 return {dispose(){disposed=true;root.removeEventListener('click',click);scene.dispose();}};
}
