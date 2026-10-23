import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { locales } from '../src/course.js';
import { pathLocale, selectedLocale, languageUrl, parseRoute, routeUrl } from '../src/routing.js';

test('lesson and result links survive language switches on both hosts',()=>{
  for(const [locale]of locales)for(const prefix of ['', '/games/loopuff']){
    const input=`https://example.com${prefix}/zh/learn/names/result/`;
    const target=languageUrl(input,locale);
    assert.equal(target.pathname,`${prefix}/${locale}/learn/names/result/`);
    assert.deepEqual(parseRoute(target.pathname),{locale,view:'result',lessonId:'names'});
    assert.equal(routeUrl(target.href,locale,'lesson','names').pathname,`${prefix}/${locale}/learn/names/`);
    assert.equal(pathLocale(target.pathname),locale);
  }
  for(const path of ['/zh/learn/unknown/result/','/zh/learn/names/unknown/','/zh/guide/extra/'])assert.equal(parseRoute(path),null);
  assert.throws(()=>routeUrl('https://example.com/','zh','result','unknown'),/Unknown lesson/);
});
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
    for(const suffix of ['levels/','guide/','play/','play/vault/','learn/signal/','learn/names/result/']){
      const page=await readFile(new URL(`../dist/${locale}/${suffix}index.html`,import.meta.url),'utf8');
      assert.ok(page.includes(`https://shixilin.com/games/loopuff/${locale}/${suffix}`));
      const base=page.match(/<base href="([^"]+)"/)[1];
      for(const prefix of ['', '/games/loopuff']){
        const resolved=new URL(base,`https://example.com${prefix}/${locale}/${suffix}`);
        assert.equal(new URL('./src/app.js',resolved).pathname,`${prefix}/src/app.js`);
        assert.equal(new URL('./assets/world-flight-90.webp',resolved).pathname,`${prefix}/assets/world-flight-90.webp`);
      }
      const initial=page.match(/<script id="initial-catalog" type="application\/json" data-locale="([^"]+)">([\s\S]*?)<\/script>/);
      assert.equal(initial[1],locale);
      const catalog=JSON.parse(initial[2]);
      assert.ok(page.includes(`<span id="brand-name">${catalog.ui.name}</span>`));
      assert.ok(page.includes(`value="${locale}" selected`));
    }
  }
});

test('level selection has a full localized page and survives language switches',()=>{
  for(const [locale]of locales)for(const prefix of ['', '/games/loopuff']){
    const url=routeUrl(`https://example.com${prefix}/zh/learn/signal/`,locale,'levels');
    assert.equal(url.pathname,`${prefix}/${locale}/levels/`);
    assert.deepEqual(parseRoute(url.pathname),{locale,view:'levels'});
    assert.equal(languageUrl(url.href,'en').pathname,`${prefix}/en/levels/`);
  }
});
