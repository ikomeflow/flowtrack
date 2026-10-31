// This small inline bootstrap never reads a ledger, PIN or recovery key.
(()=>{
 const screen=document.querySelector('#startup'),message=document.querySelector('#startup-message'),retry=document.querySelector('#startup-retry');let ready=false,styleLink,styleTimer;
 const reload=()=>location.reload();retry.addEventListener('click',reload);
 const slow=setTimeout(()=>{if(!ready){message.textContent='Slow connection. You can retry.';retry.hidden=false;}},8000);
 function failed(){if(ready)return;document.documentElement.dataset.startupFailed='true';window.dispatchEvent(new Event('flowtrack-startup-failed'));clearTimeout(slow);message.textContent='Download interrupted. Retry to open.';retry.hidden=false;}
 // Capture resource failures before the module is encountered by the parser.
 document.addEventListener('error',event=>{if(event.target?.id==='app-entry')failed();},true);
 // A dependency or initialization failure can otherwise leave only the background.
 window.addEventListener('error',event=>{if(event.target===window)failed();});
 window.addEventListener('unhandledrejection',failed);
 function styles(){
  clearTimeout(styleTimer);styleLink?.remove();styleTimer=setTimeout(()=>{document.querySelector('#style-alert').hidden=false;},8000);const link=document.createElement('link');styleLink=link;link.rel='stylesheet';link.href='./styles-v15.css';link.dataset.workspaceStyles='';
  link.addEventListener('load',()=>{clearTimeout(styleTimer);document.documentElement.dataset.workspaceStyles='ready';document.querySelector('#style-alert').hidden=true;window.dispatchEvent(new Event('flowtrack-styles-ready'));});
  link.addEventListener('error',()=>{document.documentElement.dataset.startupFailed='true';window.dispatchEvent(new Event('flowtrack-startup-failed'));clearTimeout(styleTimer);document.querySelector('#style-alert').hidden=false;});document.head.append(link);
 }
 // This bootstrap runs before the rest of the document has downloaded.
 document.addEventListener('DOMContentLoaded',()=>{document.querySelector('#style-retry').addEventListener('click',styles);},{once:true});
 window.addEventListener('flowtrack-ready',()=>{ready=true;clearTimeout(slow);retry.hidden=true;screen.hidden=true;requestAnimationFrame(()=>setTimeout(styles,0));},{once:true});
})();
