import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=(await readFile(new URL('../src/install.mjs',import.meta.url),'utf8')).replace('export function initInstall','function initInstall');
const android='Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/151.0.0.0 Mobile Safari/537.36';
const appURL='https://flowtrack.ikomeflow.com/';
class Element {
 constructor(){this.listeners={};this.hidden=false;this.disabled=false;this.textContent='';this.open=false;this.isConnected=true;this.children=[];this.focused=0;}
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
 emit(type,event={}){return Promise.all((this.listeners[type]||[]).map(fn=>fn(event)));}
 replaceChildren(...children){this.children=children;}
 showModal(){this.open=true;}
 close(){this.open=false;void this.emit('close');}
 focus(){this.focused++;}
 hasAttribute(name){return name==='data-install-help'&&this.helpOnly===true;}
}
function setup({ua=android,embedded=false,portable=false,standalone=false,iosStandalone=false,clipboard=true}={}){
 const ids=Object.fromEntries(['install-dialog','install-native','install-status','install-steps','install-online','install-copy','install-tip','install-close'].map(id=>[id,new Element()]));
 const opener=new Element(),helpOpener=new Element(),label=new Element(),gate=new Element(),media=new Element(),window=new Element(),copied=[];helpOpener.helpOnly=true;
 media.matches=standalone;window.matchMedia=()=>media;window.self=window;window.top=embedded?{}:window;
 // Installation must not inspect or alter financial records or browser storage.
 Object.defineProperty(window,'localStorage',{get(){throw Error('Unexpected storage access');}});
 const document={querySelector:selector=>ids[selector.slice(1)],querySelectorAll:selector=>selector==='[data-install-open]'?[opener,helpOpener]:selector==='[data-install-label]'?[label]:selector==='[data-install-gate]'?[gate]:[],createElement:()=>new Element()};
 const navigator={userAgent:ua,platform:'',maxTouchPoints:0,standalone:iosStandalone,clipboard:clipboard?{writeText:async text=>copied.push(text)}:undefined};
 Object.defineProperty(navigator,'storage',{get(){throw Error('Unexpected storage access');}});
 vm.runInNewContext(source+'\ninitInstall({name:"FlowTrack",onlineURL:"'+appURL+'"});',{document,window,navigator,location:{protocol:portable?'file:':'https:',href:appURL+'?private=value#history'},Error});
 const help=()=>ids['install-steps'].children.map(e=>e.textContent).join('\n');
 const promptEvent=(outcome='accepted',options={})=>{
  let calls=0,prevented=false;
  const event={preventDefault(){prevented=true;},prompt(){calls++;return options.error?Promise.reject(Error('blocked')):Promise.resolve();},userChoice:options.choice||Promise.resolve({outcome})};
  return {event,calls:()=>calls,prevented:()=>prevented};
 };
 return {ids,opener,helpOpener,label,gate,media,window,copied,help,promptEvent};
}

test('Android without a native prompt offers a regular-tab path and canonical link',async()=>{
 const s=setup();await s.opener.emit('click');assert.equal(s.ids['install-dialog'].open,true);assert.equal(s.ids['install-native'].hidden,true);
 assert.match(s.help(),/Chrome, not Incognito or another app/);assert.match(s.help(),/Add to home screen/);assert.equal(s.ids['install-online'].hidden,false);assert.equal(s.ids['install-online'].href,appURL);assert.equal(s.ids['install-online'].target,'_blank');assert.equal(s.ids['install-online'].rel,'noopener');assert.equal(s.ids['install-tip'].hidden,false);
});
test('an available browser prompt starts from the first install tap without opening extra help first',async()=>{
 const s=setup(),p=s.promptEvent();await s.window.emit('beforeinstallprompt',p.event);assert.equal(p.prevented(),true);
 const request=s.opener.emit('click');assert.equal(p.calls(),1);assert.equal(s.ids['install-dialog'].open,false);await request;
 assert.match(s.ids['install-status'].textContent,/installation was requested/);assert.doesNotMatch(s.ids['install-status'].textContent,/Your app is ready/);
});
test('How to install keeps instructions available without starting a native installation',async()=>{
 const s=setup(),p=s.promptEvent();await s.window.emit('beforeinstallprompt',p.event);await s.helpOpener.emit('click');assert.equal(p.calls(),0);assert.equal(s.ids['install-dialog'].open,true);assert.equal(s.ids['install-native'].hidden,false);
});
test('a prompt arriving while manual help is open exposes the native install control',async()=>{
 const s=setup();await s.opener.emit('click');const p=s.promptEvent();await s.window.emit('beforeinstallprompt',p.event);
 assert.equal(s.ids['install-native'].hidden,false);assert.equal(s.ids['install-online'].hidden,true);assert.equal(s.ids['install-copy'].hidden,true);assert.equal(s.ids['install-steps'].children.length,1);
 await s.ids['install-native'].emit('click');assert.equal(p.calls(),1);
});
test('rapid taps cannot reuse the browser prompt',async()=>{
 let finish;const choice=new Promise(resolve=>{finish=resolve;});const s=setup(),p=s.promptEvent('accepted',{choice});await s.window.emit('beforeinstallprompt',p.event);
 const first=s.opener.emit('click');await s.opener.emit('click');await s.ids['install-native'].emit('click');assert.equal(p.calls(),1);finish({outcome:'accepted'});await first;
});
test('dismissal consumes the prompt and retains useful manual installation help',async()=>{
 const s=setup(),p=s.promptEvent('dismissed');await s.window.emit('beforeinstallprompt',p.event);await s.opener.emit('click');
 assert.match(s.ids['install-status'].textContent,/Installation cancelled/);assert.equal(s.ids['install-native'].hidden,true);assert.equal(s.ids['install-online'].hidden,false);await s.opener.emit('click');assert.equal(p.calls(),1);
});
test('prompt failure recovers with a direct-link fallback',async()=>{
 const s=setup(),p=s.promptEvent('accepted',{error:true});await s.window.emit('beforeinstallprompt',p.event);await s.opener.emit('click');assert.match(s.ids['install-status'].textContent,/could not start installation/);assert.equal(s.ids['install-copy'].hidden,false);
});
test('installation confirmation hides install gates and can recover after a later uninstall',async()=>{
 const s=setup();await s.window.emit('appinstalled');assert.equal(s.gate.hidden,true);assert.equal(s.ids['install-steps'].hidden,true);assert.equal(s.ids['install-online'].hidden,true);assert.equal(s.label.textContent,'Installation');
 const p=s.promptEvent();await s.window.emit('beforeinstallprompt',p.event);assert.equal(s.gate.hidden,false);await s.opener.emit('click');assert.equal(p.calls(),1);
});
test('an appinstalled event before userChoice cannot be overwritten with stale pending text',async()=>{
 let finish;const s=setup(),p=s.promptEvent('accepted',{choice:new Promise(resolve=>{finish=resolve;})});await s.window.emit('beforeinstallprompt',p.event);const pending=s.opener.emit('click');await s.window.emit('appinstalled');finish({outcome:'accepted'});await pending;assert.match(s.ids['install-status'].textContent,/Your app is ready/);
});
test('installed standalone windows keep installation help informational',async()=>{
 for(const options of [{standalone:true},{iosStandalone:true}]){const s=setup(options);const p=s.promptEvent();await s.window.emit('beforeinstallprompt',p.event);await s.opener.emit('click');assert.equal(p.calls(),0);assert.equal(s.gate.hidden,true);assert.equal(s.ids['install-steps'].hidden,true);assert.match(s.ids['install-status'].textContent,/already running/);}
});
test('embedded and portable entries direct the visitor to the online top-level app',async()=>{
 for(const options of [{embedded:true},{portable:true}]){const s=setup(options),p=s.promptEvent();await s.window.emit('beforeinstallprompt',p.event);await s.opener.emit('click');assert.equal(p.calls(),0);assert.equal(s.ids['install-online'].hidden,false);assert.match(s.ids['install-status'].textContent,/Open the app directly/);}
});
test('iPhone guidance keeps the native Share and Add to Home Screen path',async()=>{
 const s=setup({ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0) AppleWebKit/605.1.15 Version/27.0 Mobile/15E148 Safari/604.1'});await s.opener.emit('click');assert.match(s.help(),/Tap Share/);assert.match(s.help(),/Add to Home Screen/);assert.equal(s.ids['install-tip'].hidden,true);
});
test('copying installation instructions shares only the configured app URL',async()=>{
 const s=setup();await s.ids['install-copy'].emit('click');assert.deepEqual(s.copied,[appURL]);assert.match(s.ids['install-status'].textContent,/App link copied/);
 const unavailable=setup({clipboard:false});await unavailable.ids['install-copy'].emit('click');assert.match(unavailable.ids['install-status'].textContent,/Press and hold/);
});
test('closing installation instructions returns focus to their opener',async()=>{
 const s=setup();await s.opener.emit('click');await s.ids['install-close'].emit('click');assert.equal(s.ids['install-dialog'].open,false);assert.equal(s.opener.focused,1);
});
