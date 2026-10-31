import {initAnalytics} from './analytics.mjs';
// Independent and optional: an analytics download failure cannot block the ledger.
try{
 const view=()=>{
  if(document.querySelector('#lock-screen')?.hidden===false)return 'locked';
  if(document.querySelector('#setup-screen')?.hidden===false)return 'setup';
  if(document.querySelector('#app-shell')?.hidden===false){const name=location.hash.slice(1);return ['overview','transactions','calendar','settings'].includes(name)?name:'overview';}
  return 'startup';
 };
 const tracker=initAnalytics({view});
 window.addEventListener('flowtrack-usage',event=>{const d=event.detail;if(!d||typeof d!=='object')return;if(d.event==='app_error')tracker.error(d.code);else tracker.track(d.event);});
 window.addEventListener('flowtrack-startup-failed',()=>tracker.error('startup_failed'));
 if(document.documentElement.dataset.startupFailed==='true')tracker.error('startup_failed');
}catch{}
