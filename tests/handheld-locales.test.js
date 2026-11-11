import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {locales} from '../src/course.js';
import {emptySave,normalizeSave} from '../server/save-format.mjs';
test('the twelve complete catalogs follow the personal website language menu',()=>{
 assert.deepEqual(locales.map(([id])=>id),['zh','zh-Hant','en','de','es','fr','vi','ru','uk','ar','ja','ko']);
 const shape=v=>Array.isArray(v)?v.map(shape):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,shape(v[k])])):typeof v;
 const en=JSON.parse(fs.readFileSync(new URL('../public/locales/en.json',import.meta.url)));
 for(const [locale]of locales){const catalog=JSON.parse(fs.readFileSync(new URL(`../public/locales/${locale}.json`,import.meta.url)));assert.deepEqual(shape(catalog),shape(en),locale);assert.equal(catalog.handheld.games.length,3);assert.equal(catalog.handheld.inputNotes.length,3);}
});
test('a French course save survives the same normalization and backup format as the other languages',()=>{
 const save=emptySave();save.data.course={lang:'fr',state:{lesson:0,phase:'independent',draft:'12.log()',assessedSource:null}};
 const restored=normalizeSave(JSON.parse(JSON.stringify(save)));assert.equal(restored.data.course.lang,'fr');assert.equal(restored.data.course.state.draft,'12.log()');
});
