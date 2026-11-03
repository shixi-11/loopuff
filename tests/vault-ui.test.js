import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mountVault} from '../src/vault-ui.js';
import {newVault,vaultPuzzle} from '../src/vault.js';
const t=JSON.parse(fs.readFileSync(new URL('../public/locales/zh.json',import.meta.url),'utf8'));
test('an edit immediately retracts a starter-only instruction without rebuilding the editor',async()=>{
 const original=globalThis.localStorage,initial=newVault(123),store=new Map([['loopuff-vault-v1',JSON.stringify(initial)]]);
 globalThis.localStorage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)};
 const nodes=new Map(),handlers={};let renders=0,markup='';
 const root={set innerHTML(value){renders++;markup=value;this.querySelector('.vault-first-step').textContent=value.match(/class="vault-first-step">([^<]*)/)[1];},get innerHTML(){return markup;},querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{textContent:'',value:'',hidden:false,disabled:false,dataset:{},querySelector:()=>({textContent:''})});return nodes.get(selector);},querySelectorAll:()=>[],addEventListener:(key,fn)=>handlers[key]=fn,removeEventListener(){}};
 const page=mountVault(root,{text:t.vault,errors:t.ui,reduced:{matches:true},beginner:t.beginner});
 try{
  assert.ok(root.querySelector('.vault-first-step').textContent.includes('0'));
  const editor=root.querySelector('#vault-editor');editor.value='9.log()';handlers.input({target:{id:'vault-editor',value:editor.value}});
  assert.equal(root.querySelector('.vault-first-step').textContent,t.beginner.vaultSteps[2]);assert.equal(renders,1);assert.equal(editor.value,'9.log()');
  editor.value=vaultPuzzle(initial.seed,0).starter;handlers.input({target:{id:'vault-editor',value:editor.value}});
  assert.ok(root.querySelector('.vault-first-step').textContent.includes('0'));assert.equal(renders,1);
  await new Promise(resolve=>setImmediate(resolve));
 }finally{page.dispose();globalThis.localStorage=original;}
});
