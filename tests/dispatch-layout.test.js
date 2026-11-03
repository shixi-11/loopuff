import test from 'node:test';
import assert from 'node:assert/strict';
import {mountDispatchLayout,keepDispatchEditorVisible} from '../src/dispatch-layout.js';

test('editing context follows the actual header and stops sticking when it no longer fits',()=>{
 let dockHeight=510,headerHeight=88,callback,disconnected=false;const watched=[],events={},properties=new Map();
 const dock={dataset:{},getBoundingClientRect:()=>({height:dockHeight})},header={getBoundingClientRect:()=>({height:headerHeight})};
 const root={querySelector:()=>dock,style:{setProperty:(k,v)=>properties.set(k,v),removeProperty:k=>properties.delete(k)}};
 const view={innerHeight:720,addEventListener:(k,v)=>events[k]=v,removeEventListener:(k,v)=>{assert.equal(events[k],v);delete events[k];}};
 class Observer {constructor(fn){callback=fn;}observe(item){watched.push(item);}disconnect(){disconnected=true;}}
 const dispose=mountDispatchLayout(root,{view,Observer,header});
 assert.deepEqual(watched,[dock,header]);assert.equal(dock.dataset.sticky,'true');assert.equal(properties.get('--dispatch-sticky-top'),'104px');
 headerHeight=120;callback();assert.equal(properties.get('--dispatch-sticky-top'),'136px');assert.equal(dock.dataset.sticky,'true');
 dockHeight=600;callback();assert.equal(dock.dataset.sticky,'false');
 dockHeight=510;callback();view.innerHeight=600;events.resize();assert.equal(dock.dataset.sticky,'false');
 view.innerHeight=720;events.resize();assert.equal(dock.dataset.sticky,'true');
 dispose();assert.equal(disconnected,true);assert.equal(events.resize,undefined);assert.equal(dock.dataset.sticky,undefined);assert.equal(properties.size,0);
 callback();assert.equal(dock.dataset.sticky,undefined);assert.equal(properties.size,0);
});
test('ordinary scrolling remains available without layout observation or a mounted editing region',()=>{
 assert.doesNotThrow(()=>mountDispatchLayout({}, {view:null,Observer:null})());
 assert.doesNotThrow(()=>mountDispatchLayout({querySelector:()=>null},{view:{},Observer:class {}})());
});

test('invalidating a report reveals a clipped focused desktop editor without forcing tall or mobile fields',()=>{
 let box={top:-155,bottom:133,height:288},scrolls=0;
 const editor={getBoundingClientRect:()=>box,scrollIntoView(options){assert.deepEqual(options,{block:'nearest',behavior:'instant'});scrolls++;}};
 const root={querySelector:()=>editor,ownerDocument:{activeElement:editor}},view={innerWidth:1280,innerHeight:720},header={getBoundingClientRect:()=>({height:88})};
 const reveal=()=>keepDispatchEditorVisible(root,{view,header});
 reveal();assert.equal(scrolls,1);box={top:134,bottom:422,height:288};reveal();assert.equal(scrolls,1);
 box={top:500,bottom:788,height:288};reveal();assert.equal(scrolls,2);
 box={top:80,bottom:880,height:800};reveal();assert.equal(scrolls,2);
 box={top:-155,bottom:133,height:288};view.innerWidth=390;reveal();assert.equal(scrolls,2);
 view.innerWidth=1280;root.ownerDocument.activeElement=null;reveal();assert.equal(scrolls,2);
});
