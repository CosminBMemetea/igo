import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { createWorkQueue } from "../apps/driver/src/work-queue";
const root=fs.mkdtempSync(path.join(os.tmpdir(),"querra-journal-test-"));
class File {
  uri:string;
  constructor(...parts:(string|File|Directory)[]){this.uri=path.join(...parts.map(x=>typeof x==="string"?x:x.uri));}
  get name(){return path.basename(this.uri);} get exists(){return fs.existsSync(this.uri);}
  async text(){return fs.promises.readFile(this.uri,"utf8");}
  async write(value:string){await fs.promises.writeFile(this.uri,value);}
  delete(){fs.unlinkSync(this.uri);}
  async copy(to:File){await fs.promises.copyFile(this.uri,to.uri);}
}
class Directory {
  uri:string;
  constructor(...parts:(string|Directory)[]){this.uri=path.join(...parts.map(x=>typeof x==="string"?x:x.uri));}
  get exists(){return fs.existsSync(this.uri);} create(){fs.mkdirSync(this.uri,{recursive:true});}
  list(){return fs.readdirSync(this.uri).map(name=>new File(this.uri,name));}
}
let fail=false, sends=0;
const source=ts.transpileModule(fs.readFileSync("apps/driver/src/work-storage.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function restart(){
  const module={exports:{} as any};
  class ApiError extends Error { constructor(public status:number, public code:string) {super(code);} }
  const require=(name:string)=>{
    if(name==="expo-file-system")return {File,Directory,Paths:{document:new Directory(root)}};
    if(name==="./work-queue")return {createWorkQueue};
    if(name==="./api")return {sessionScope:async()=>"scope-a",api:async()=>{sends++;if(fail)throw Error("network");return {id:"confirmed"};},ApiError};
    throw Error(name);
  };
  new Function("require","module","exports",source)(require,module,module.exports);return module.exports;
}
try {
  let m=restart(); const q=m.workQueue;
  const entry={id:"work-one",scope:"scope-a",tripId:"t",title:"QA",createdAt:new Date().toISOString(),status:"queued",attempts:0,nextAttempt:0,type:"event",kind:"loaded",truckId:"truck",shiftStart:new Date().toISOString()};
  await q.add(entry); fail=true; await assert.rejects(q.sync("scope-a"));
  const dir=path.join(root,"driver-work-v1");
  fs.writeFileSync(path.join(dir,`journal-${Date.now()+1000}.json`),'{"version":');
  m=restart();assert.equal((await m.workQueue.list("scope-a"))[0].id,"work-one","interrupted last write recovers the complete journal");
  assert.equal((await m.workQueue.list("scope-b")).length,0);
  fail=false;await m.workQueue.sync("scope-a",true);assert.equal(sends,2);assert.equal((await m.workQueue.list("scope-a"))[0].status,"confirmed");
  assert.throws(()=>m.workFile("../../outside.jpg"));
  const photo=m.workFile("work-photo.jpg");await photo.write("synthetic image bytes");
  await m.workQueue.add({...entry,id:"work-photo",type:"file",kind:"pod",fileName:"work-photo.jpg",size:21,status:"draft"});
  await m.cleanConfirmedPhotos("scope-a");assert.equal(photo.exists,true,"never delete an unconfirmed draft");
  await m.discardWork("scope-a","work-photo");assert.equal(photo.exists,false);assert.equal((await m.workQueue.list("scope-a")).length,1);
  for(const file of fs.readdirSync(dir).filter(f=>f.startsWith("journal-")))fs.writeFileSync(path.join(dir,file),"corrupt");
  await assert.rejects(restart().workQueue.list("scope-a"),/nu pot fi citite/);
  console.log("PASS journal adapter: interrupted write recovery, restart replay, account isolation, path confinement, drafts retained, explicit discard, corrupt storage fails closed");
} finally {fs.rmSync(root,{recursive:true,force:true});}
