// This small inline bootstrap never reads a ledger, PIN or recovery key.
(()=>{
 const screen=document.querySelector('#startup'),message=document.querySelector('#startup-message'),retry=document.querySelector('#startup-retry');let ready=false,styleLink,styleTimer;
 const reload=()=>location.reload();retry.addEventListener('click',reload);
 const slow=setTimeout(()=>{if(!ready){message.textContent='Slow connection. You can retry.';retry.hidden=false;}},8000);
 function failed(){if(ready)return;clearTimeout(slow);message.textContent='Download interrupted. Retry to open.';retry.hidden=false;}
 document.querySelector('#app-entry').addEventListener('error',failed);
 window.addEventListener('error',event=>{if(event.filename?.includes('app-v15.mjs'))failed();});
 function styles(){
  clearTimeout(styleTimer);styleLink?.remove();styleTimer=setTimeout(()=>{document.querySelector('#style-alert').hidden=false;},8000);const link=document.createElement('link');styleLink=link;link.rel='stylesheet';link.href='./styles-v12.css';link.dataset.workspaceStyles='';
  link.addEventListener('load',()=>{clearTimeout(styleTimer);document.documentElement.dataset.workspaceStyles='ready';document.querySelector('#style-alert').hidden=true;window.dispatchEvent(new Event('flowtrack-styles-ready'));});
  link.addEventListener('error',()=>{clearTimeout(styleTimer);document.querySelector('#style-alert').hidden=false;});document.head.append(link);
 }
 document.querySelector('#style-retry').addEventListener('click',styles);
 window.addEventListener('flowtrack-ready',()=>{ready=true;clearTimeout(slow);retry.hidden=true;screen.hidden=true;requestAnimationFrame(()=>setTimeout(styles,0));},{once:true});
})();
