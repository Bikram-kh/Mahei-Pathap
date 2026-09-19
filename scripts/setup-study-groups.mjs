/** Additive provisioning using the authenticated Appwrite CLI. Never prints secrets. */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const config = JSON.parse(readFileSync(new URL('../appwrite.config.json', import.meta.url)));
const databaseId = process.env.APPWRITE_DATABASE_ID;
if (!databaseId) throw new Error('Set APPWRITE_DATABASE_ID. Log in with appwrite login and link the intended project first.');
const collections = ['study-groups','study-group-members','study-group-messages','study-group-invites','study-group-notes','study-group-calls','study-group-internal'];
const attributes = [
 { key:'groupId', type:'string', size:36, required:true },
 { key:'userId', type:'string', size:36, required:true },
 { key:'payload', type:'string', size:65535, required:true },
 { key:'createdAt', type:'string', size:40, required:true },
];
const indexes = [
 {key:'groupId',type:'key',attributes:['groupId']},
 {key:'userId',type:'key',attributes:['userId']},
 {key:'group_created',type:'key',attributes:['groupId','createdAt'],orders:['ASC','ASC']},
];
function cli(args) { return JSON.parse(execFileSync('appwrite',[...args,'--json'],{encoding:'utf8',maxBuffer:4*1024*1024})); }
function exists(args) {try{return cli(args);}catch(e){if(/not found|not exist|could not be found/i.test(e.stderr?.toString()||''))return null;throw e;}}
for (const collectionId of collections) {
 const base=['--database-id',databaseId,'--collection-id',collectionId];
 let collection=exists(['databases','get-collection',...base]);
 if (!collection) collection=cli(['databases','create-collection',...base,'--name',collectionId,'--document-security','--enabled',...attributes.flatMap(a=>['--attributes',JSON.stringify(a)]),...indexes.flatMap(i=>['--indexes',JSON.stringify(i)])]);
 if (!collection.documentSecurity || (collection.$permissions||[]).length) throw new Error(`${collectionId} must have documentSecurity enabled and no collection permissions.`);
 for(const expected of attributes){const actual=collection.attributes?.find(a=>a.key===expected.key);if(!actual||actual.size!==expected.size||!actual.required)throw new Error(`${collectionId}.${expected.key} schema differs; inspect before proceeding.`);}
 console.log(`Ready: ${collectionId}`);
}
const bucketId='study-group-files';
let bucket=exists(['storage','get-bucket','--bucket-id',bucketId]);
if(!bucket)bucket=cli(['storage','create-bucket','--bucket-id',bucketId,'--name','Study group PDF files','--permissions','create("users")','--file-security','--enabled','--maximum-file-size','26214400','--allowed-file-extensions','pdf','--compression','none','--encryption','--antivirus']);
if(!bucket.fileSecurity || bucket.$permissions?.some(p=>p!=='create("users")'))throw new Error('Study group bucket permissions must be create(users) only with fileSecurity enabled.');
console.log('Ready: group PDF bucket');
const fn=config.functions.find(f=>f.$id==='mahei-study-groups');
if(!fn)throw new Error('Missing Study Groups function in appwrite.config.json');
if(!exists(['functions','get','--function-id',fn.$id]))cli(['functions','create','--function-id',fn.$id,'--name',fn.name,'--runtime',fn.runtime,'--entrypoint',fn.entrypoint,'--commands',fn.commands,'--timeout',String(fn.timeout),'--enabled','--logging',...fn.execute.flatMap(v=>['--execute',v]),...fn.scopes.flatMap(v=>['--scopes',v])]);
console.log('Ready: function. Configure server variables, then deploy only mahei-study-groups. Full rollout remains disabled by default.');
