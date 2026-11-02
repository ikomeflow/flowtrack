import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initPDFSave} from '../src/pdf-save.mjs';
class Element{
 constructor(){this.textContent='';this.listeners={};this.disabled=false;this.hidden=false;this.open=false;}
 addEventListener(type,handler){this.listeners[type]=handler;}
 showModal(){this.open=true;}
 close(){this.open=false;}
 focus(){this.focused=true;}
 click(){return this.listeners.click();}
}
function setup(navigator={}){
 const elements=new Map(['pdf-save-dialog','pdf-save-mobile','pdf-save-download','pdf-save-status','pdf-save-name','pdf-save-hint','pdf-save-close'].map(id=>[id,new Element()]));
 const downloads=[],notifications=[],get=id=>elements.get('pdf-save-'+id);
 const api=initPDFSave({document:{getElementById:id=>elements.get(id)},navigator,File,download:(...args)=>downloads.push(args),notify:text=>notifications.push(text)});
 return {...api,get,downloads,notifications};
}
const bytes=new TextEncoder().encode('%PDF-test'),filename='flowtrack-history.pdf';
test('unsupported sharing retains a normal PDF download without claiming a mobile save',()=>{
 const s=setup();let delivered=0;s.prepare(bytes,filename,{onDelivered:()=>delivered++});
 assert.equal(s.get('mobile').hidden,true);assert.equal(s.get('download').focused,true);assert.equal(s.get('dialog').open,true);
 s.get('download').click();assert.equal(s.downloads[0][0],bytes);assert.equal(s.downloads[0][1],filename);assert.equal(delivered,1);assert.equal(s.get('dialog').open,false);
 assert.match(s.notifications[0],/download started/);
});
test('save starts from the button gesture and shares the PDF file only, once',async()=>{
 let resolveShare,called=0,delivered=0,payload;
 const s=setup({canShare:({files})=>files[0].type==='application/pdf',share:data=>{called++;payload=data;return new Promise(resolve=>resolveShare=resolve);}});
 s.prepare(bytes,filename,{onDelivered:()=>delivered++});assert.equal(called,0);assert.equal(s.get('mobile').hidden,false);
 const first=s.get('mobile').click();assert.equal(called,1);await s.get('mobile').click();assert.equal(called,1);assert.equal(delivered,0);
 assert.deepEqual(Object.keys(payload),['files']);assert.equal(payload.files[0].name,filename);assert.deepEqual(new Uint8Array(await payload.files[0].arrayBuffer()),bytes);
 resolveShare();await first;assert.equal(delivered,1);assert.equal(s.get('dialog').open,false);assert.equal(s.downloads.length,0);
});
test('cancelled sharing keeps the prepared PDF and permits downloading without regeneration',async()=>{
 let delivered=0;const s=setup({canShare:()=>true,share:()=>Promise.reject(new DOMException('cancelled','AbortError'))});
 s.prepare(bytes,filename,{onDelivered:()=>delivered++});await s.get('mobile').click();assert.equal(delivered,0);assert.equal(s.get('dialog').open,true);assert.match(s.get('status').textContent,/cancelled/);
 s.get('download').click();assert.equal(delivered,1);assert.equal(s.downloads.length,1);
});
test('blocked sharing offers the normal download and does not count a false success',async()=>{
 let delivered=0;const s=setup({canShare:()=>true,share:()=>Promise.reject(new DOMException('blocked','NotAllowedError'))});
 s.prepare(bytes,filename,{onDelivered:()=>delivered++});await s.get('mobile').click();assert.match(s.get('status').textContent,/Download PDF/);assert.equal(delivered,0);assert.equal(s.get('mobile').disabled,false);
});
test('locking or a changed ledger prevents either action from exporting the staged file',async()=>{
 let valid=true,called=0;const s=setup({canShare:()=>true,share:()=>called++});s.prepare(bytes,filename,{isCurrent:()=>valid});valid=false;
 await s.get('mobile').click();s.get('download').click();assert.equal(called,0);assert.equal(s.downloads.length,0);assert.equal(s.get('name').textContent,'');assert.equal(s.get('dialog').open,false);
});
test('a late share result cannot close or report success for a newly prepared PDF',async()=>{
 let finish,delivered=0;const s=setup({canShare:()=>true,share:()=>new Promise(resolve=>finish=resolve)});
 s.prepare(bytes,filename,{onDelivered:()=>delivered++});const pending=s.get('mobile').click();s.clear();s.prepare(bytes,'new-history.pdf');
 s.get('dialog').listeners.close();assert.equal(s.get('name').textContent,'new-history.pdf');finish();await pending;
 assert.equal(delivered,0);assert.equal(s.get('dialog').open,true);assert.equal(s.get('name').textContent,'new-history.pdf');
});
