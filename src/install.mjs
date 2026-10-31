// Installation never reads or writes the ledger, PIN, or browser storage.
export function initInstall({name,onlineURL}) {
 const dialog=document.querySelector('#install-dialog');
 const button=document.querySelector('#install-native');
 const status=document.querySelector('#install-status');
 const steps=document.querySelector('#install-steps');
 const online=document.querySelector('#install-online');
 const copy=document.querySelector('#install-copy');
 const tip=document.querySelector('#install-tip');
 const media=window.matchMedia('(display-mode: standalone)');
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const android=/Android/.test(navigator.userAgent);
 const portable=location.protocol==='file:';
 const embedded=window.top!==window.self;
 let prompt=null,busy=false,installed=false,opener=null;
 const standalone=()=>media.matches||navigator.standalone===true;
 function refresh(){
  const running=standalone();
  document.querySelectorAll('[data-install-gate]').forEach(e=>e.hidden=running||installed||portable);
  document.querySelectorAll('[data-install-label]').forEach(e=>e.textContent=running||installed?'Installation':'Install app');
  button.hidden=running||installed||!prompt||portable||embedded;
  button.disabled=busy;
  const help=running?`${name} is already running as an installed app.`:installed?'Your app is ready. Open it from the new icon on your phone or computer.':portable||embedded?'Open the app directly in your browser to install it.':prompt?`Install ${name} on this device. You can remove it later.`:android?`Add ${name} from a regular Chrome tab.`:'Add an app icon to this phone or computer.';
  status.textContent=help;
  const instructions=prompt&&!portable&&!embedded?['Tap Install '+name+' above, then confirm Install in your browser.']:ios?['Open this app in your browser.','Tap Share (the box with an arrow), then Add to Home Screen. You may need to scroll down.','Tap Add. You can now open the app from its icon on your home screen.']:android?['Open the app link below in Chrome, not Incognito or another app’s browser.','Tap Install app in '+name+', then confirm Chrome’s Install prompt.','Or use Chrome’s ⋮ menu → Add to home screen → Install.']:['Open this app in your browser.','Open the browser menu at the top (three dots or three lines). Look for Install app, Install this page as an app, or Add to Dock.','Confirm Install or Add. Open the app from the new icon on your computer.'];
  steps.replaceChildren(...instructions.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
  steps.hidden=running||installed;
  online.hidden=running||installed||!!prompt;
  copy.hidden=online.hidden;
  tip.hidden=running||installed||!android||!!prompt;
  tip.textContent='No install option? Update Chrome. Already installed? Check your app drawer.';
 }
 online.href=onlineURL;online.target='_blank';online.rel='noopener';
 function showHelp(message){refresh();if(message)status.textContent=message;if(!dialog.open)dialog.showModal();}
 document.querySelectorAll('[data-install-open]').forEach(e=>e.addEventListener('click',()=>{if(busy)return;opener=e;if(!e.hasAttribute('data-install-help')&&prompt&&!portable&&!embedded&&!standalone()&&!installed)return install();showHelp();}));
 document.querySelector('#install-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{if(opener?.isConnected&&!opener.hidden)opener.focus();});
 window.addEventListener('beforeinstallprompt',e=>{if(portable||embedded||standalone())return;e.preventDefault();installed=false;prompt=e;refresh();});
 window.addEventListener('appinstalled',()=>{installed=true;prompt=null;busy=false;refresh();});
 media.addEventListener('change',refresh);
 async function install(){
  if(!prompt||busy||portable||embedded||standalone()||installed)return;
  const current=prompt;prompt=null;busy=true;button.disabled=true;
  let message='';
  try{await current.prompt();const choice=await current.userChoice;message=choice.outcome==='accepted'?`${name} installation was requested. Wait for your browser to finish, then check your home screen or app drawer.`:'Installation cancelled. Use your browser menu or reopen this page to try again.';}
  catch{message='The browser could not start installation. Open the app link in a regular browser tab and try again.';}
  finally{busy=false;showHelp(!installed&&!standalone()?message:'');}
 }
 button.addEventListener('click',install);
 copy.addEventListener('click',async()=>{
  try{if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');await navigator.clipboard.writeText(onlineURL);status.textContent='App link copied. Paste it into a regular Chrome tab.';}
  catch{status.textContent='Press and hold the app link, then choose Copy link.';}
 });
 refresh();
}
