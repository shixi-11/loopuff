import {build} from 'esbuild';
import {mkdir,cp} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'output/account-service');
await mkdir(out,{recursive:true});
for(const file of ['account-service.mjs','progress-store.mjs','save-format.mjs','pursuit-format.mjs','diagnostic-format.mjs','heist-format.mjs','arcade-store.mjs','package.json','package-lock.json','backup.mjs'])await cp(resolve(root,'server',file),resolve(out,file));
// The worker runs this same bundled file. Keep the store external so all
// request handlers and replay validation share the exact ArcadeError class.
await build({entryPoints:[resolve(root,'server/arcade-service.mjs')],outfile:resolve(out,'arcade-service.mjs'),bundle:true,platform:'node',format:'esm',target:'node24',external:['./arcade-store.mjs']});
console.log('Built flat account-service deployment in output/account-service');
