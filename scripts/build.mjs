import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { locales } from '../src/course.js';
const root = resolve(import.meta.dirname, '..'), out = resolve(root, 'dist');
const inside = relative(root, out);
if (!inside || inside.startsWith('..') || isAbsolute(inside) || inside !== 'dist') throw Error('invalid build output');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(resolve(root, 'public'), out, { recursive: true });
await cp(resolve(root, 'src'), resolve(out, 'src'), { recursive: true });
const html=await readFile(resolve(out,'index.html'),'utf8');
for(const [locale] of locales){
  const messages=JSON.parse(await readFile(resolve(root,`public/locales/${locale}.json`),'utf8'));
  const lang=locale==='zh'?'zh-CN':locale==='zh-Hant'?'zh-TW':locale;
  const canonical=`https://shixilin.com/games/loopuff/${locale}/`;
  const page=html.replace('<html lang="zh-CN">',`<html lang="${lang}" dir="${locale==='ar'?'rtl':'ltr'}">`)
    .replace(/<title>[^<]*<\/title>/,`<title>${messages.ui.name} · ${messages.ui.tagline}</title><link rel="canonical" href="${canonical}">`);
  await mkdir(resolve(out,locale),{recursive:true});await writeFile(resolve(out,locale,'index.html'),page);
}
console.log('Built static game in dist/');
