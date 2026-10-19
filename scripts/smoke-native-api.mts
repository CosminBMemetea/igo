import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const data=new Map<string,string>(), environment={env:{EXPO_PUBLIC_API_URL:"https://fleet.example.test"}};
const valid={token:"synthetic-token",expiresAt:new Date(Date.now()+60000).toISOString(),uid:"driver",firm:"firm",origin:environment.env.EXPO_PUBLIC_API_URL};
data.set("login",JSON.stringify(valid));
const secure={AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:1,getItemAsync:async(k:string)=>data.get(k)??null,setItemAsync:async(k:string,v:string)=>{data.set(k,v);},deleteItemAsync:async(k:string)=>{data.delete(k);}};
let calls=0;const bodies:unknown[]=[];const signals:AbortSignal[]=[],replies:((r:Response)=>void)[]=[];
const send=async(_u:string,o:RequestInit)=>{calls++;bodies.push(o.body);signals.push(o.signal!);return new Promise<Response>((resolve,reject)=>{replies.push(resolve);o.signal!.addEventListener("abort",()=>reject(Error("abort")));});};
const source=ts.transpileModule(fs.readFileSync("apps/driver/src/api.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const module={exports:{} as any};new Function("require","module","exports","fetch","process",source)(()=>secure,module,module.exports,send,environment);const a=module.exports;
const tick=()=>new Promise(r=>setTimeout(r,0));
const control=a.api("/api/driver/private",{});const gps=a.api("/api/driver/tracking",undefined,{gps:true}).catch((e:Error)=>e);await tick();a.abortGPSRequests();
assert.equal(signals[0].aborted,false);assert.equal(signals[1].aborted,true);replies[0](Response.json({ok:true}));await control;assert.ok(await gps instanceof Error);
const count=calls;environment.env.EXPO_PUBLIC_API_URL="https://different.example.test";await assert.rejects(a.api("/api/driver/mobile"));assert.equal(calls,count);
environment.env.EXPO_PUBLIC_API_URL=valid.origin;
data.set("login",JSON.stringify({...valid,expiresAt:"not-a-date"}));await assert.rejects(a.api("/api/driver/mobile"));assert.equal(calls,count);
data.set("login",JSON.stringify(valid));await assert.rejects(a.api("/api/driver/mobile",undefined,{scope:"another-account"}));assert.equal(calls,count);
const stale=a.api("/api/driver/private",{}).catch((e:any)=>e);await tick();replies.at(-1)!(Response.json({error:"stale-shift"},{status:409}));assert.equal((await stale).code,"stale-shift");
for (const [status,code,message] of [[404,"mobile-unavailable",/nu este încă activat/],[401,"credentials",/nu sunt corecte/]] as const) {
  const result=a.api("/api/auth/mobile",{}, {anonymous:true}).catch((e:any)=>e);await tick();replies.at(-1)!(Response.json({error:code},{status}));
  assert.match((await result).message,message);
}
const form=new FormData();form.set("tripId","trip");
const multipart=a.api("/api/files",form,{multipart:true});await tick();assert.equal(bodies.at(-1),form);
replies.at(-1)!(Response.json({id:"file"}));assert.equal((await multipart).id,"file");
data.set("login","corrupt json");await assert.rejects(a.read("login"));
console.log("PASS native API: GPS abort leaves controls alive; origin/account binding; corrupt expiry/storage; typed server errors");
