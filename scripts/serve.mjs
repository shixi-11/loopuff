import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, relative, isAbsolute } from 'node:path';
import { parseRoute, gamePrefix } from '../src/routing.js';
const root = resolve(import.meta.dirname, '../dist'), port = Number(process.env.PORT || 8770);
const types = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp' };
createServer(async(req,res)=>{
  try {
    const url = new URL(req.url,'http://127.0.0.1');
    let pathname = decodeURIComponent(url.pathname).slice(gamePrefix(url.pathname).length)||'/';
    if(parseRoute(url.pathname))pathname=pathname.replace(/\/?$/,'/index.html');
    if (pathname === '/') pathname = '/index.html';
    const file = resolve(root, '.'+pathname);
    const within = relative(root, file);
    if (within.startsWith('..') || isAbsolute(within)) { res.writeHead(403); return res.end(); }
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`http://127.0.0.1:${port}/`));
