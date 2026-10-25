import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
function load(path:string,require:(name:string)=>any){const m={exports:{} as any};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(require,m,m.exports);return m.exports;}
const p=load('apps/driver/src/ui/pager.ts',()=>({}));

// default segment: Acum if present, else Următoarele, else Terminate
assert.equal(p.defaultSeg([1,2,3]),0);assert.equal(p.defaultSeg([0,1,2]),1);assert.equal(p.defaultSeg([0,0,2]),2);assert.equal(p.defaultSeg([0,0,0]),2);
// page from the real offset (what the thumb/highlight show)
assert.equal(p.pageAt(0,393,3),0);assert.equal(p.pageAt(393,393,3),1);assert.equal(p.pageAt(590,393,3),2);assert.equal(p.pageAt(9999,393,3),2);assert.equal(p.pageAt(-40,393,3),0);assert.equal(p.pageAt(100,0,3),0);

// Redmi bug: a jump before the pages are laid out is clamped to 0 by Android. Simulate a pager that clamps
// scrollTo to its current content width and the align loop the component runs (layout, content size, retries).
function simulate(events:Array<['layout',number]|['content',number]|['retry']>,want:number){
  let w=0,contentW=0,x=0;const scrolls:number[]=[];
  const align=()=>{const tx=p.alignOffset({w,contentW,n:3,x,want,busy:false});if(tx==null)return;scrolls.push(tx);x=Math.min(tx,Math.max(0,contentW-w));};
  for(const e of events){if(e[0]==='layout')w=e[1];if(e[0]==='content')contentW=e[1];align();}
  return {x,page:p.pageAt(x,w,3),scrolls};
}
// width first, pages later (the case that showed Acum while Următoarele was highlighted)
let r=simulate([['layout',393],['retry'],['content',393],['content',1179],['retry']],1);
assert.equal(r.page,1);assert.equal(r.x,393);assert.deepEqual(r.scrolls,[393],'no jump until the content is wide enough, then exactly one');
// content first, width later; and a rotation keeps the same page
r=simulate([['content',1179],['layout',393],['retry'],['layout',851],['content',2553],['retry']],2);
assert.equal(r.page,2);assert.equal(r.x,1702);
// already on the page: no scroll; while the driver drags: no jump
assert.equal(p.alignOffset({w:393,contentW:1179,n:3,x:393,want:1,busy:false}),null);
assert.equal(p.alignOffset({w:393,contentW:1179,n:3,x:0,want:1,busy:true}),null);

// counts change while the screen is open
assert.equal(p.reconcileSeg(0,true,[1,1,2],[0,1,3]),1,'Acum emptied (trip moved to Terminate) -> Următoarele');
assert.equal(p.reconcileSeg(0,true,[1,0,2],[0,0,3]),2,'Acum emptied, nothing upcoming -> Terminate');
assert.equal(p.reconcileSeg(2,true,[1,1,2],[0,1,3]),2,'driver choice kept when its segment still has trips');
assert.equal(p.reconcileSeg(0,true,[0,1,2],[0,2,2]),0,'driver deliberately on empty Acum stays');
assert.equal(p.reconcileSeg(1,false,[0,1,2],[1,1,2]),0,'auto-selected segment follows the data (new current trip)');

// the component uses those rules and derives the highlight/thumb from the real offset only
const seg=fs.readFileSync('apps/driver/src/ui/Segments.tsx','utf8');
assert.ok(seg.includes('onContentSizeChange')&&seg.includes('alignOffset(')&&seg.includes('pageAt('),'pager aligns after content layout');
assert.ok(!/x\.setValue\(/.test(seg),'thumb is never moved by hand, only by the real scroll offset');
assert.ok(/const on = i === active/.test(seg)&&/ready \? shown : index/.test(seg),'highlight comes from the shown page');

// phone location switched off: card + settings shortcut
const calls:string[]=[];let services=false,gms=true;
const rn={Platform:{OS:'android'},AppState:{currentState:'active',addEventListener:()=>({remove(){}})},Linking:{sendIntent:async(a:string)=>{calls.push('intent:'+a)},openSettings:async()=>{calls.push('app-settings')}}};
const loc={hasServicesEnabledAsync:async()=>services,enableNetworkProviderAsync:async()=>{calls.push('dialog');if(!gms)throw Error('E_LOCATION_SETTINGS_UNSATISFIED');services=true;}};
const ls=load('apps/driver/src/location-services.ts',n=>n==='react-native'?rn:n==='expo-location'?loc:{useCallback:(f:any)=>f,useEffect(){},useState:(v:any)=>[v,()=>{}]});
assert.equal(await ls.locationServicesOn(),false);
assert.equal(await ls.openLocationSettings(),true);assert.deepEqual(calls,['dialog']);
services=false;gms=false;calls.length=0;assert.equal(await ls.openLocationSettings(),null);assert.deepEqual(calls,['dialog','intent:android.settings.LOCATION_SOURCE_SETTINGS']);
rn.Platform.OS='ios';calls.length=0;await ls.openLocationSettings();assert.deepEqual(calls,['app-settings']);
loc.hasServicesEnabledAsync=async()=>{throw Error('x')};assert.equal(await ls.locationServicesOn(),null,'unknown is not reported as off');
const scr=fs.readFileSync('apps/driver/src/ui/screens.tsx','utf8');
for(const s of['Locația telefonului e oprită','Phone location is off','Lokalizacja telefonu jest wyłączona'])assert.ok(scr.includes(s),s);
console.log('PASS trips pager: default segment, jump waits for laid-out pages (Android clamp), highlight from real offset, counts change; location-off card + settings shortcut');
