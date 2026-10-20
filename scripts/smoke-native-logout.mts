import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const storage=new Map<string,any>(); let now=Date.now(),offline=true,origin='https://qa.example.test',failStorage=false,calls=0,stops=0,aborts=0;
class ApiError extends Error{constructor(public status:number){super(String(status))}}
const api={ApiError,apiOrigin:()=>origin,read:async(k:string)=>structuredClone(storage.get(k)??null),write:async(k:string,v:any)=>{if(failStorage&&k==='pending-revocations-v1')throw Error('storage');storage.set(k,structuredClone(v));},remove:async(k:string)=>{storage.delete(k)},abortRequests:()=>{aborts++},api:async(_p:string,_b:any,opts:any)=>{assert.equal(opts.anonymous,true);calls++;if(offline)throw Error('offline');return{ok:true}}};
function load(path:string,require:(name:string)=>any){const m={exports:{} as any};new Function('require','module','exports','Date',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(require,m,m.exports,class extends Date{static now(){return now}});return m.exports;}
const cleanup=load('apps/driver/src/cleanup.ts',()=>api);
const logout=load('apps/driver/src/logout.ts',name=>name==='./api'?api:name==='./cleanup'?cleanup:name==='./tracking'?{stopGPS:async()=>{stops++}}:{forgetPush:async()=>{storage.delete('push-registration')}});
const login={token:'never-retain-this',logoutReceipt:'revoke-only',expiresAt:new Date(now+3600000).toISOString()};storage.set('login',login);storage.set('pending-controls-v2',{driver:{action:'stop'}});storage.set('photo-draft','keep');
await logout.logout();assert.equal(storage.has('login'),false);assert.equal(calls,0);assert.equal(aborts,1);assert.equal(stops,1);assert.equal(await cleanup.pendingRevocations(),1);assert.equal(JSON.stringify([...storage]).includes(login.token),false);assert.ok(storage.has('photo-draft'));assert.ok(storage.has('pending-controls-v2'));
await cleanup.syncRevocations();assert.equal(await cleanup.pendingRevocations(),1);const failedCalls=calls;await cleanup.syncRevocations();assert.equal(calls,failedCalls,'backoff');
now+=16000;origin='https://other.example.test';offline=false;await cleanup.syncRevocations();assert.equal(calls,failedCalls,'never send receipt to another backend');origin='https://qa.example.test';await cleanup.syncRevocations();assert.equal(await cleanup.pendingRevocations(),0);
storage.set('login',login);failStorage=true;await assert.rejects(logout.logout(),/storage/);assert.ok(storage.get('logout-in-progress'));assert.ok(storage.get('login'));failStorage=false;await logout.recoverLogout();assert.equal(storage.has('login'),false);assert.equal(storage.has('logout-in-progress'),false);
now+=3600001;await cleanup.syncRevocations();assert.equal(await cleanup.pendingRevocations(),0);
console.log('PASS offline logout: no network wait, GPS stopped, no bearer retained, scoped drafts/controls preserved, durable retry/backoff, crash/storage recovery, expiry');
