import {DatabaseSync,backup} from 'node:sqlite';
import {mkdir,chmod} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
const source=resolve(dirname(fileURLToPath(import.meta.url)),'data/loopuff.sqlite');
const date=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'});
const folder=resolve(homedir(),'loopuff-backups',date);
await mkdir(folder,{recursive:true,mode:0o700});
const target=resolve(folder,'accounts.sqlite');
const db=new DatabaseSync(source,{readOnly:true});
try{await backup(db,target);await chmod(target,0o600);}finally{db.close();}
const check=new DatabaseSync(target,{readOnly:true});
try{if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Backup integrity failed');}finally{check.close();}
console.log('[loopuff-backup] completed and integrity checked');
