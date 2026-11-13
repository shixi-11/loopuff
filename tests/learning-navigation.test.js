import test from 'node:test';
import assert from 'node:assert/strict';
import {renderLearningNavigation,mountLearningNavigation} from '../src/learning-navigation.js';

test('renderLearningNavigation keeps the overview anchor and renders an independent menu',()=>{
 const html=renderLearningNavigation({label:'学习',shortLabel:'学',href:'/guide',active:true,items:[{label:'零基础',href:'/guide/start',action:'open-start',active:true},{label:'进阶',href:'/guide/advance',action:'open-advance'}]});
 assert.match(html,/data-action="open-guide" href="\/guide"/);
 assert.match(html,/data-learning-menu[^>]*aria-expanded="false"[^>]*aria-controls="learning-navigation-panel"/);
 assert.match(html,/id="learning-navigation-panel" hidden/);
 assert.match(html,/href="\/guide\/start" data-action="open-start"[^>]*aria-current="page"/);
 assert.match(html,/href="\/guide\/advance" data-action="open-advance"/);
 assert.doesNotMatch(html,/data-action="open-advance"[^>]*href/);
});

class FakeDocument{
 constructor(){this.listeners={};}
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
 removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]??[]).filter(item=>item!==fn);}
 emit(type,event){for(const fn of this.listeners[type]??[])fn(event);}
}
class FakeClassList{constructor(){this.values=new Set();}toggle(name,on){if(on)this.values.add(name);else this.values.delete(name);}}
class FakeNode{
 constructor(doc){this.ownerDocument=doc;this.listeners={};this.hidden=true;this.attributes={};this.classList=new FakeClassList();this.parent=null;this.children=[];this.closestResult=null;}
 add(child){child.parent=this;this.children.push(child);return child;}
 querySelector(selector){if(selector==='.learning-navigation'&&this.role==='root')return this.nav; if(selector==='[data-learning-menu]'&&this.role==='nav')return this.caret; if(selector==='#learning-navigation-panel'&&this.role==='nav')return this.panel; return null;}
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
 removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]??[]).filter(item=>item!==fn);}
 emit(type,event={target:this}){event.target??=this;for(const fn of this.listeners[type]??[])fn(event);}
 setAttribute(name,value){this.attributes[name]=String(value);}
 getAttribute(name){return this.attributes[name];}
 contains(node){return node===this||this.children.some(child=>child.contains(node));}
 focus(){this.focused=true;}
}
function fixture(){const doc=new FakeDocument(),root=new FakeNode(doc);root.role='root';const nav=new FakeNode(doc);nav.role='nav';const caret=new FakeNode(doc),panel=new FakeNode(doc),link=new FakeNode(doc);nav.caret=caret;nav.panel=panel;nav.add(caret).add(panel).add(link);root.nav=nav;root.add(nav);panel.hidden=true;return {doc,root,nav,caret,panel,link};}

test('mountLearningNavigation toggles, closes on child/outside/Escape, and disposes listeners',()=>{
 const {doc,root,caret,panel,link,nav}=fixture();const mounted=mountLearningNavigation(root);
 caret.emit('click',{target:caret,stopPropagation(){},preventDefault(){}});assert.equal(panel.hidden,false);assert.equal(caret.getAttribute('aria-expanded'),'true');
 panel.emit('click',{target:{closest:()=>link}});assert.equal(panel.hidden,true);
 caret.emit('click',{target:caret,stopPropagation(){},preventDefault(){}});doc.emit('click',{target:{}});assert.equal(panel.hidden,true);
 caret.emit('click',{target:caret,stopPropagation(){},preventDefault(){}});doc.emit('keydown',{key:'Escape'});assert.equal(panel.hidden,true);assert.equal(caret.focused,true);
 mounted.dispose();caret.emit('click',{target:caret,stopPropagation(){},preventDefault(){}});assert.equal(panel.hidden,true);assert.equal(nav.classList.values.has('is-menu-open'),false);
});
