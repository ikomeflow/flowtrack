// Installation never reads or writes the ledger, PIN, or browser storage.
export function initInstall({name,onlineURL}) {
 const dialog=document.querySelector('#install-dialog');
 const button=document.querySelector('#install-native');
 const status=document.querySelector('#install-status');
 const steps=document.querySelector('#install-steps');
 const media=window.matchMedia('(display-mode: standalone)');
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const android=/Android/.test(navigator.userAgent);
 const portable=location.protocol==='file:';
 let prompt=null,busy=false,installed=false,opener=null;
 const standalone=()=>media.matches||navigator.standalone===true;
 function refresh(){
  const running=standalone();
  document.querySelectorAll('[data-install-gate]').forEach(e=>e.hidden=running||installed||portable);
  document.querySelectorAll('[data-install-label]').forEach(e=>e.textContent=running||installed?'Installation':'Install app');
  button.hidden=running||installed||!prompt||portable;
  button.disabled=busy;
  const help=running?`${name} is already running as an installed app.`:installed?'Installation completed. Open the app from your home screen or applications.':portable?'Open the online version to install this app.':prompt?`Install ${name} on this device. You can remove it later.`:ios?'Add this app from Safari on your iPhone or iPad.':android?'Install from your browser’s menu.':'Install from your browser’s menu.';
  status.textContent=help;
  const instructions=ios?['Open this app address in Safari.','Tap Share, then Add to Home Screen.','Keep Open as Web App enabled if shown, then tap Add.']:android?['Open this app address in Chrome or Edge.','Open the browser menu and choose Install app or Add to Home screen.','Confirm Install or Add, then open the app icon.']:['In Chrome or Edge, use the install icon in the address bar or the browser’s app menu.','On a Mac using Safari, choose File → Add to Dock.','If opened inside another app, open this address in your regular browser first.'];
  steps.replaceChildren(...instructions.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
  steps.hidden=running||installed;
 }
 const online=document.querySelector('#install-online');online.href=onlineURL;
 online.hidden=!portable;
 document.querySelectorAll('[data-install-open]').forEach(e=>e.addEventListener('click',()=>{opener=e;refresh();if(!dialog.open)dialog.showModal();}));
 document.querySelector('#install-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{if(opener?.isConnected&&!opener.hidden)opener.focus();});
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();if(!installed){prompt=e;refresh();}});
 window.addEventListener('appinstalled',()=>{installed=true;prompt=null;busy=false;refresh();});
 media.addEventListener('change',refresh);
 button.addEventListener('click',async()=>{
  if(!prompt||busy)return;
  const current=prompt;prompt=null;busy=true;button.disabled=true;
  let message='';
  try{await current.prompt();const choice=await current.userChoice;message=choice.outcome==='accepted'?'Installation requested. Confirm any remaining browser prompts.':'Installation cancelled. You can install later from your browser’s menu.';}
  catch{message='The browser could not open installation. Follow the steps below or try again later.';}
  finally{busy=false;refresh();if(!installed&&!standalone())status.textContent=message;}
 });
 refresh();
}
