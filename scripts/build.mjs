import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { build, transform } from 'esbuild';
import { createHash } from 'node:crypto';
import { course, locales } from '../src/course.js';
const root = resolve(import.meta.dirname, '..'), out = resolve(root, 'dist');
const inside = relative(root, out);
if (!inside || inside.startsWith('..') || isAbsolute(inside) || inside !== 'dist') throw Error('invalid build output');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(resolve(root, 'public'), out, { recursive: true });
await cp(resolve(root, 'src'), resolve(out, 'src'), { recursive: true });
const bundled=await build({entryPoints:[resolve(root,'src/app.js')],bundle:true,format:'esm',target:'es2022',minify:true,write:false});
const script=bundled.outputFiles[0].text;
const scriptName=`app-${createHash('sha256').update(script).digest('hex').slice(0,12)}.js`;
await writeFile(resolve(out,'src',scriptName),script);
const css=(await transform(await readFile(resolve(out,'style.css'),'utf8')+'\n'+await readFile(resolve(out,'vault.css'),'utf8'),{loader:'css',minify:true})).code;
const cssName=`style-${createHash('sha256').update(css).digest('hex').slice(0,12)}.css`;
await writeFile(resolve(out,cssName),css);
const html=(await readFile(resolve(out,'index.html'),'utf8'))
  .replace('href="./style.css"',`href="./${cssName}"`)
  .replace('<link rel="stylesheet" href="./vault.css">','')
  .replace('src="./src/app.js"',`src="./src/${scriptName}"`);
await writeFile(resolve(out,'index.html'),html);
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const [locale] of locales){
  const messages=JSON.parse(await readFile(resolve(root,`public/locales/${locale}.json`),'utf8'));
  const lang=locale==='zh'?'zh-CN':locale==='zh-Hant'?'zh-TW':locale;
  const entries=['','levels/','guide/','play/','play/vault/',...course.flatMap(lesson=>[`learn/${lesson.id}/`,`learn/${lesson.id}/result/`])];
  for(const entry of entries){
  const canonical=`https://shixilin.com/games/loopuff/${locale}/${entry}`;
  const lessonIndex=course.findIndex(lesson=>entry.startsWith(`learn/${lesson.id}/`));
  const title=entry.endsWith('/result/')?messages.assessment.title:entry==='play/'?messages.vault.arcade:entry==='play/vault/'?messages.vault.title:entry==='levels/'?messages.ui.navCourse:entry==='guide/'?messages.ui.guide:lessonIndex>=0?messages.lessons[lessonIndex].title:messages.ui.tagline;
  const page=html.replace('<html lang="zh-CN">',`<html lang="${lang}" dir="${locale==='ar'?'rtl':'ltr'}">`)
    .replace('<base href="./">',`<base href="${'../'.repeat(1+entry.split('/').filter(Boolean).length)}">`)
    .replace('</head>',`<script id="initial-catalog" type="application/json" data-locale="${locale}">${JSON.stringify(messages).replace(/</g,'\\u003c')}</script></head>`)
    .replace('<span id="brand-name">Loopuff</span>',`<span id="brand-name">${escape(messages.ui.name)}</span>`)
    .replace('<select id="language-select" aria-label="Language"></select>',`<select id="language-select" aria-label="${escape(messages.ui.language)}">${locales.map(([id,label])=>`<option value="${id}"${id===locale?' selected':''}>${escape(label)}</option>`).join('')}</select>`)
    .replace('<nav id="page-navigation" class="page-navigation" aria-label="主导航" hidden></nav>',`<nav id="page-navigation" class="page-navigation" aria-label="${escape(messages.ui.navigation)}">${[['',messages.ui.navHome],['levels/',messages.ui.navCourse],['play/',messages.vault.arcade],['guide/',messages.ui.navGuide]].map(([path,label])=>`<a href="./${locale}/${path}">${escape(label)}</a>`).join('')}</nav>`)
    .replace(/<h1>[\s\S]*?<\/h1>/,`<h1>${messages.ui.hero.split(/\\n|\n/).map(line=>escape(line).replace(escape(messages.ui.heroAccent),`<span class="hero-accent">${escape(messages.ui.heroAccent)}</span>`)).join('<br>')}</h1>`)
    .replace(/<p class="welcome-copy">[\s\S]*?<\/p>/,`<p class="welcome-copy">${escape(messages.ui.lead)}</p>`)
    .replace('<body>',`<body data-view="${entry?'learning':'game'}"${entry?' data-entry="learning"':''}>`)
    .replace(/<title>[^<]*<\/title>/,`<title>${messages.ui.name} · ${title}</title><link rel="canonical" href="${canonical}">${entry.endsWith('/result/')?'<meta name="robots" content="noindex,follow">':''}`);
  await mkdir(resolve(out,locale,entry),{recursive:true});await writeFile(resolve(out,locale,entry,'index.html'),page);
  }
}
console.log('Built static game in dist/');
