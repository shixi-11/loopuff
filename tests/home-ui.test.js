import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mountHomeDemo,homeSections} from '../src/home-ui.js';
import {locales} from '../src/course.js';
const catalog=locale=>JSON.parse(fs.readFileSync(new URL(`../public/locales/${locale}.json`,import.meta.url)));
function node(){const nodes=new Map();return {innerHTML:'',dataset:{},handlers:{},querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{textContent:''});return nodes.get(selector);},addEventListener(type,handler){this.handlers[type]=handler;},removeEventListener(type){delete this.handlers[type];}};}
test('the home experiment runs actual code, invalidates edited output and keeps its value across locales',()=>{
 const model={},root=node(),view=mountHomeDemo(root,{text:catalog('zh').homeExperience,model});
 root.handlers.submit({target:{id:'home-demo-form'},preventDefault(){}});assert.equal(root.querySelector('output').textContent,'7');
 root.handlers.input({target:{id:'home-number',value:'12'}});assert.equal(root.querySelector('output').textContent,'—');
 view.dispose();mountHomeDemo(root,{text:catalog('ar').homeExperience,model});assert.ok(root.innerHTML.includes('value="12"'));
 root.handlers.submit({target:{id:'home-demo-form'},preventDefault(){}});assert.equal(root.querySelector('output').textContent,'12');assert.equal(model.completed,undefined);
});
test('all home catalogs contain translated sections, six supplied cartridges and their actual destinations',()=>{
 const shape=v=>Array.isArray(v)?v.map(shape):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,shape(v[k])])):typeof v;
 const expected=shape(catalog('en').homeExperience);
 for(const [locale]of locales){
  const c=catalog(locale),urls={play:`/${locale}/play/`,map:`/${locale}/guide/map/`,compare:`/${locale}/guide/compare/`};
  const ids=['blocks','tanks','flight','snake','breakout','sokoban'];
  const games=ids.map((id,index)=>({id,title:c.handheld.games[index],art:'',note:c.handheld.short[index],href:urls.play+'?game='+id}));
  const html=homeSections({text:c.homeExperience,paths:c.learningPaths,guide:{mapLabel:c.learningMap.title,compareLabel:c.guideStudio.compareTitle},urls,games});
  assert.deepEqual(shape(c.homeExperience),expected);
  for(const url of Object.values(urls))assert.ok(html.includes(`href="${url}"`));
  for(const game of games){assert.ok(html.includes(`href="${game.href}"`));assert.ok(html.includes(game.title));}
  assert.equal((html.match(/class="home-game"/g)||[]).length,6);
  assert.ok(!html.includes('undefined'));
 }
});
