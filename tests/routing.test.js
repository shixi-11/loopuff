import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { locales } from '../src/course.js';
import { pathLocale, selectedLocale, languageUrl } from '../src/routing.js';
test('all languages have clean paths on the official site and standalone host',()=>{
  for(const [locale]of locales)for(const prefix of ['', '/games/loopuff']){
    const url=languageUrl(`https://example.com${prefix}/?lang=en#learn`,locale);
    assert.equal(url.pathname,`${prefix}/${locale}/`);assert.equal(url.search,'');assert.equal(url.hash,'#learn');
    assert.equal(pathLocale(url.pathname),locale);
    assert.equal(selectedLocale(url.href,'en',['de']),locale);
  }
});
test('language paths win over saved and browser preferences',()=>{
  const url='https://shixilin.com/games/loopuff/zh-Hant/?lang=en&lesson=2#code';
  assert.equal(selectedLocale(url,'de',['ar']),'zh-Hant');
  assert.equal(languageUrl(url,'zh-Hant').href,'https://shixilin.com/games/loopuff/zh-Hant/?lesson=2#code');
  assert.equal(selectedLocale('https://example.com/?lang=ja','zh',['ar']),'zh');
  assert.equal(selectedLocale('https://example.com/','zh-Hant',['en']),'zh-Hant');
  assert.equal(selectedLocale('https://example.com/',null,['vi-VN']),'vi');
  assert.equal(selectedLocale('https://example.com/',null,['zh-TW']),'zh-Hant');
});
test('build emits localized entry points with canonical metadata',async()=>{
  execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/build.mjs',import.meta.url))],{cwd:fileURLToPath(new URL('../',import.meta.url))});
  for(const [locale]of locales){
    const html=await readFile(new URL(`../dist/${locale}/index.html`,import.meta.url),'utf8');
    assert.ok(html.includes(`https://shixilin.com/games/loopuff/${locale}/`));
    assert.ok(!html.includes('?lang='));
  }
});
