import test from 'node:test';
import assert from 'node:assert/strict';
import {setSaveAccount,markUploadPending,mountSaves} from '../src/saves-ui.js';
import {saveKeys,parseSave} from '../server/save-format.mjs';
import {readBaseline} from '../src/save-data.js';
test('returning to the save page under another account removes the old cloud preview',()=>{
 const model={accountId:'a',cloud:{account:{id:'a'},revision:1},preview:{mode:'upload',base:{account:{id:'a'},revision:1}},allowCopy:true};
 assert.equal(setSaveAccount(model,'b'),true);assert.equal(model.cloud,null);assert.equal(model.preview,null);assert.equal(model.allowCopy,false);assert.equal(model.accountId,'b');
});
test('a file comparison is local and survives account changes without retaining cloud data',()=>{
 const preview={mode:'file',plan:{incoming:'file'}},model={accountId:'a',cloud:{account:{id:'a'}},preview};
 setSaveAccount(model,null);assert.equal(model.preview,preview);assert.equal(model.cloud,null);assert.equal(model.accountId,null);
});
test('an upload interrupted by remount cannot revive its old ready-to-write base',()=>{
 const model={accountId:'a',cloud:{revision:1},preview:{mode:'upload',base:{revision:1}},allowCopy:true};
 markUploadPending(model);assert.equal(setSaveAccount(model,'a'),false);
 assert.equal(model.cloud,null);assert.equal(model.preview,null);assert.equal(model.error,'SAVE_UNCONFIRMED');
 setSaveAccount(model,'b');assert.equal(model.error,null);assert.equal(model.preview,null);
});

test('unreadable game bytes without a journal remain downloadable as recovery records',async()=>{
 const stored=new Map([[saveKeys.pursuit,'broken']]),listeners={},original={};
 const globals={localStorage:{getItem:key=>stored.get(key)??null,setItem:()=>assert.fail('read-only export wrote storage')},location:{href:'http://127.0.0.1:8771/zh/saves/'},window:{addEventListener(){},removeEventListener(){}},document:{body:{append(){}},createElement:()=>({click(){},remove(){}})}};
 for(const [key,value]of Object.entries(globals)){original[key]=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{configurable:true,value});}
 let blob;const oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL;URL.createObjectURL=value=>{blob=value;return 'blob:recovery-test';};URL.revokeObjectURL=()=>{};
 const root={innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[],addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener(){}};
 let page;
 try{
  const catalog=(await import('../public/locales/zh.json',{with:{type:'json'}})).default;
  page=mountSaves(root,{text:catalog.saves,topics:{},lessons:[],phases:{},account:{user:null},urls:{account:'/zh/account/'},locale:'zh',name:'环灵',pursuitText:catalog.pursuit});
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(root.innerHTML,/data-save-action="download" disabled/);assert.match(root.innerHTML,/data-save-action="recovery-download"/);assert.ok(root.innerHTML.includes(catalog.saves.rawRecoveryNote));
  listeners.click({target:{closest:()=>({dataset:{saveAction:'recovery-download'}})}});await new Promise(resolve=>setImmediate(resolve));
  const recovered=JSON.parse(await blob.text());assert.equal(recovered.format,'loopuff-recovery');assert.equal(recovered.journal,null);assert.deepEqual(recovered.current,readBaseline(localStorage));assert.equal(recovered.current[saveKeys.pursuit],'broken');assert.throws(()=>parseSave(JSON.stringify(recovered)));
 }finally{page?.dispose();URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;for(const key of Object.keys(globals)){if(original[key])Object.defineProperty(globalThis,key,original[key]);else delete globalThis[key];}}
});
