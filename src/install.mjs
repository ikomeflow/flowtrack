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
 const ua=navigator.userAgent;
 const ios=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const android=/Android/.test(ua);
 const firefox=/Firefox\//.test(ua),edge=/Edg(?:A|iOS)?\//.test(ua),samsung=/SamsungBrowser\//.test(ua);
 const chrome=/Chrome\/|Chromium\//.test(ua)&&!edge&&!samsung&&!/OPR\//.test(ua);
 const safari=/Safari\//.test(ua)&&!chrome&&!edge&&!samsung&&!/CriOS\/|FxiOS\/|OPR\//.test(ua);
 const mac=/Macintosh|Mac OS X/.test(ua),windows=/Windows/.test(ua);
 const inApp=/\bwv\b|FBAN|FBAV|Instagram|MicroMessenger|Line\//i.test(ua);
 const portable=location.protocol==='file:';
 const embedded=window.top!==window.self;
 let prompt=null,busy=false,installed=false,opener=null;
 const standalone=()=>media.matches||navigator.standalone===true;
 // Browser hints explain manual steps; a real install event always takes priority.
 function manualHelp(){
  if(portable||embedded||inApp)return {status:'Open the app directly in your browser to install it.',steps:['Copy the app link below.','Open it in a regular browser tab, outside another app’s browser, then tap Install app.','If no prompt appears, use that browser’s install or Add to Home Screen command.'],tip:'Use Safari or Chrome on iPhone/iPad; use a browser that offers app installation on your computer.'};
  if(ios)return {steps:['Open the app directly in Safari or Chrome.','Tap Share, then Add to Home Screen. You may need to scroll down.','Leave Open as Web App on if shown, then tap Add. If Add to Home Screen is missing, open the link in Safari.']};
  if(mac&&safari)return {steps:['In Safari, open the app link below.','Choose File → Add to Dock, or Share → Add to Dock.','Click Add. Open the app from the Dock or Applications.'],tip:'Requires macOS 14 or later. Safari web apps use separate storage; browser records may not appear in the new app.'};
  if(android&&firefox)return {steps:['Open the app directly in a regular Firefox tab.','Open Firefox’s ⋮ menu and tap Install.','In Add to Home Screen, tap Add automatically or place the icon yourself.']};
  if(android&&samsung)return {steps:['Open the app directly in Samsung Internet.','Use its install/plus icon or open the menu and look for Add to home screen.','Confirm Add or Install to place the icon on your phone.'],tip:'If this adds a shortcut, it opens the app in your browser. Available options depend on Samsung Internet and your device.'};
  if(android&&chrome)return {steps:['Open the app link below in regular Chrome, not Incognito or another app’s browser.','Open Chrome’s ⋮ menu → Install and create shortcut → Install. Older versions may show Add to home screen → Install.','Confirm Install in Chrome or on your device.'],tip:'No install option? Update Chrome. Already installed? Check your app drawer.'};
  if(android)return {steps:['Open the app link below in a regular browser tab.','In the browser menu, look for Install app or Add to home screen.','Confirm Add or Install. If the option is missing, open the link in Chrome or Firefox.'],tip:'Your browser and phone control app installation; an in-app or private browser may not offer it.'};
  if(edge)return {steps:['Open the app directly in a regular Microsoft Edge window.','Choose ⋯ → More tools → Apps → Install this site as an app, or use the install icon in the address bar.','Confirm Install. For a desktop shortcut, open Edge’s Apps page → Details → Create Desktop shortcut.']};
  if(firefox&&windows)return {steps:['Open the app directly in a regular Firefox window.','Click the web apps button in Firefox’s address bar.','Open the app from the Windows Start menu or taskbar, and confirm pinning if Firefox asks.'],tip:'If the web apps button is missing, update Firefox or open the app link in Chrome or Edge.'};
  if(firefox)return {status:'Use another browser to install this app on your computer.',steps:['Firefox’s desktop web-app feature is currently for Windows.','On Mac, open the app link in Safari and choose File → Add to Dock. On Mac or Linux, Chrome and Edge can also offer installation.','Confirm the install or Add action in the browser you choose.']};
  if(chrome)return {steps:['Open the app directly in a regular Chrome window.','Use the address-bar install icon, or ⋮ → Cast, save, and share → Install page as app.','Confirm Install. The app appears in your device’s apps or launcher; shortcut options depend on the system.']};
  return {steps:['Open the app link below in a regular browser window.','Look for Install app or Add to Home Screen in the browser menu or address bar, then confirm Add or Install.','If installation is unavailable, use Chrome or Edge; Safari on Mac offers File → Add to Dock.'],tip:'Some browsers cannot install web apps. A website cannot silently create a home-screen or desktop icon.'};
 }
 function refresh(){
  const running=standalone();
  document.querySelectorAll('[data-install-gate]').forEach(e=>e.hidden=running||installed||portable);
  document.querySelectorAll('[data-install-label]').forEach(e=>e.textContent=running||installed?'Installation':'Install app');
  button.hidden=running||installed||!prompt||portable||embedded;
  button.disabled=busy;
  const guide=manualHelp();
  const help=running?`${name} is already running as an installed app.`:installed?'Your app is ready. Open it from the new icon on your phone or computer.':portable||embedded?'Open the app directly in your browser to install it.':prompt?`Install ${name} on this device. Your browser will ask you to confirm.`:guide.status||'Follow your browser’s steps to add an app icon.';
  status.textContent=help;
  const instructions=prompt&&!portable&&!embedded?['Tap Install '+name+' above, then confirm Install in your browser.']:guide.steps;
  steps.replaceChildren(...instructions.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
  steps.hidden=running||installed;
  online.hidden=running||installed||!!prompt;
  copy.hidden=online.hidden;
  tip.hidden=running||installed||!guide.tip||!!prompt;
  tip.textContent=guide.tip||'';
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
  try{await current.prompt();const choice=await current.userChoice;message=choice.outcome==='accepted'?`${name} installation was requested. Wait for your browser to finish, then check your device’s apps or home screen.`:'Installation cancelled. Use your browser menu or reopen this page to try again.';}
  catch{message='The browser could not start installation. Open the app link in a regular browser tab and try again.';}
  finally{busy=false;showHelp(!installed&&!standalone()?message:'');}
 }
 button.addEventListener('click',install);
 copy.addEventListener('click',async()=>{
  try{if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');await navigator.clipboard.writeText(onlineURL);status.textContent='App link copied. Paste it into a regular browser tab.';}
  catch{status.textContent='Press and hold the app link, then choose Copy link.';}
 });
 refresh();
}
