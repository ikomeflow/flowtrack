// Fixed categories only: never receive a ledger, exception or user-entered text.
export const APP_VERSION='1.17.0';
export const EVENTS=new Set(['app_open','page_view','heartbeat','transaction_created','transaction_updated','transaction_deleted','backup_exported','pdf_exported','backup_restored','setup_started','pin_setup_completed','first_transaction','app_error']);
export const ERROR_CODES=new Set(['save_failed','pdf_export_failed','restore_failed','startup_failed','offline_setup_failed']);
const VIEWS=new Set(['overview','transactions','calendar','settings','locked','setup','startup']);
const PREFIX='flowtrack.analytics.',DAY=86400000;
export function deviceClass(userAgent=''){
 if(/iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent))return 'tablet';
 if(/Mobi|iPhone|iPod/i.test(userAgent))return 'mobile';
 return userAgent?'desktop':'unknown';
}
export function createAnalytics(env){
 let lastInteraction=env.now(),lastSend=0,opened=false,stopped=false;
 const errorTimes=new Map();
 const read=key=>{try{return JSON.parse(env.storage.getItem(PREFIX+key));}catch{return null;}};
 const write=(key,value)=>{try{env.storage.setItem(PREFIX+key,JSON.stringify(value));return true;}catch{return false;}};
 const clear=()=>{for(const key of ['visitor','session'])try{env.storage.removeItem(PREFIX+key);}catch{}opened=false;errorTimes.clear();};
 const protectedBrowser=()=>env.privacySignal();
 const choice=()=>read('consent')===false?false:read('consent')===true&&read('consent_version')===2?true:null;
 const enabled=()=>!stopped&&!protectedBrowser()&&choice()===true;
 function consent(value){clear();write('consent_version',2);write('consent',value===true&&!protectedBrowser());if(enabled())track('app_open');}
 function track(event,view=env.view(),error='none'){
  if(!enabled()||!EVENTS.has(event)||!VIEWS.has(view)||!env.online()||!env.visible())return false;
  if(event==='app_error'?!ERROR_CODES.has(error):error!=='none')return false;
  const now=env.now();
  if(now-lastInteraction>=5*60000)return false;
  if(event==='heartbeat'&&now-lastSend<55000)return false;
  if(event==='app_error'&&now-(errorTimes.get(error)??-Infinity)<10*60000)return false;
  let visitor=read('visitor');
  if(!visitor||typeof visitor.id!=='string'||now-visitor.created>=30*DAY||now<visitor.created){visitor={id:env.uuid(),created:now};clear();if(!write('visitor',visitor))return false;}
  let session=read('session');
  if(!session||typeof session.id!=='string'||now-session.last>=30*60000||now<session.last)session={id:env.uuid(),last:now};
  session.last=now;if(!write('session',session))return false;
  const raw=env.context?.()||{},device=['mobile','tablet','desktop','unknown'].includes(raw.device)?raw.device:'unknown',mode=['browser','installed'].includes(raw.mode)?raw.mode:'browser';
  const payload={v:2,id:env.uuid(),visitor:visitor.id,session:session.id,event,view,device,mode,version:APP_VERSION,error};
  lastSend=now;opened=true;if(event==='app_error')errorTimes.set(error,now);
  try{Promise.resolve(env.send(payload)).catch(()=>{});}catch{}
  if(event==='app_open'&&env.setupEligible?.())track('setup_started');
  return true;
 }
 return{track,consent,enabled,clear,choice,protectedBrowser,
  error(code){return track('app_error',env.view(),code);},
  activity(){lastInteraction=env.now();if(enabled()&&!opened)track('app_open');},
  heartbeat(){return track('heartbeat');},stop(){stopped=true;clear();},sync(){if(!enabled())clear();}};
}
export function initAnalytics({view}){
 const tracker=createAnalytics({storage:localStorage,now:()=>Date.now(),uuid:()=>crypto.randomUUID(),online:()=>navigator.onLine,visible:()=>!document.hidden,view,
  setupEligible:()=>document.querySelector('#setup-screen')?.dataset.newLedger==='true',
  context:()=>({device:deviceClass(navigator.userAgent),mode:matchMedia('(display-mode: standalone)').matches||navigator.standalone===true?'installed':'browser'}),
  privacySignal:()=>navigator.globalPrivacyControl===true||navigator.doNotTrack==='1'||window.doNotTrack==='1',
  send:payload=>fetch('https://ikomeflow.com/wp-json/flowtrack-analytics/v1/collect',{method:'POST',mode:'cors',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(payload),signal:AbortSignal.timeout(5000)})});
 const prompt=document.querySelector('#analytics-choice'),toggle=document.querySelector('#analytics-toggle'),status=document.querySelector('#analytics-status');
 const refresh=()=>{tracker.sync();prompt.hidden=tracker.protectedBrowser()||tracker.choice()!==null;toggle.checked=tracker.enabled();toggle.disabled=tracker.protectedBrowser();status.textContent=tracker.protectedBrowser()?'Off. Your browser privacy preference is respected.':tracker.enabled()?'On. Anonymous usage, device category, app version and safe error codes are shared.':'Off. No usage events are sent.';};
 document.querySelector('#analytics-allow').addEventListener('click',()=>{tracker.activity();tracker.consent(true);refresh();if(document.documentElement.dataset.startupFailed==='true')tracker.error('startup_failed');});
 document.querySelector('#analytics-decline').addEventListener('click',()=>{tracker.consent(false);refresh();});
 toggle.addEventListener('change',()=>{tracker.activity();tracker.consent(toggle.checked);refresh();});
 for(const event of ['pointerdown','keydown','scroll'])document.addEventListener(event,()=>tracker.activity(),{passive:true,capture:true});
 window.addEventListener('storage',event=>{if(event.key?.startsWith(PREFIX))refresh();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){refresh();tracker.heartbeat();}});
 window.addEventListener('online',()=>tracker.heartbeat());setInterval(()=>{refresh();tracker.heartbeat();},60000);
 refresh();tracker.track('app_open');return tracker;
}
