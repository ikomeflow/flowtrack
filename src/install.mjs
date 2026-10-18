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
  const help=running?`${name} is already running as an installed app.`:installed?'Your app is ready. Open it from the new icon on your phone or computer.':portable?'Open the online version to install this app.':prompt?`Install ${name} on this device. You can remove it later.`:'Add an app icon to this phone or computer. No file upload is needed.';
  status.textContent=help;
  const instructions=ios?['Open this app in your browser.','Tap Share (the box with an arrow), then Add to Home Screen. You may need to scroll down.','Tap Add. You can now open the app from its icon on your home screen.']:android?['Open this app in your browser.','Tap the three dots (⋮) at the top. Choose Install app or Add to Home screen.','Tap Install or Add. Look for the app icon on your phone.']:['Open this app in your browser.','Open the browser menu at the top (three dots or three lines). Look for Install app, Install this page as an app, or Add to Dock.','Confirm Install or Add. Open the app from the new icon on your computer.'];
  if(prompt)instructions.unshift('Tap the Install button above, then confirm Install.');
  if(!prompt)instructions.push('Cannot see that option? You can keep using the app here in your browser.');
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
  try{await current.prompt();const choice=await current.userChoice;message=choice.outcome==='accepted'?'One more step: confirm Install if your browser asks.':'You cancelled. You can try again whenever you are ready.';}
  catch{message='The browser could not open installation. Follow the steps below or try again later.';}
  finally{busy=false;refresh();if(!installed&&!standalone())status.textContent=message;}
 });
 refresh();
}
