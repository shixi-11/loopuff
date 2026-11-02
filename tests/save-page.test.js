import test from 'node:test';
import assert from 'node:assert/strict';
import {setSaveAccount,markUploadPending} from '../src/saves-ui.js';
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
