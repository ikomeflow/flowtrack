// Only fixed event/view names can leave the app. Never pass a ledger or DOM text here.
export const EVENTS = new Set(['app_open','page_view','heartbeat','transaction_created','transaction_updated','transaction_deleted','backup_exported','pdf_exported','backup_restored']);
const VIEWS = new Set(['overview','transactions','calendar','settings','locked','setup']);
const PREFIX = 'flowtrack.analytics.';
const DAY = 86400000;
export function createAnalytics(env) {
  let lastInteraction = env.now(), lastSend = 0, opened = false, stopped = false;
  const read = key => { try { return JSON.parse(env.storage.getItem(PREFIX+key)); } catch { return null; } };
  const write = (key,value) => { try { env.storage.setItem(PREFIX+key,JSON.stringify(value)); return true; } catch { return false; } };
  const clear = () => { for (const key of ['visitor','session']) try { env.storage.removeItem(PREFIX+key); } catch {} opened=false; };
  const protectedBrowser = () => env.privacySignal();
  const enabled = () => !stopped && !protectedBrowser() && read('consent') === true;
  function consent(value) { clear(); write('consent',value === true && !protectedBrowser()); if (enabled()) track('app_open'); }
  function track(event, view = env.view()) {
    if (!enabled() || !EVENTS.has(event) || !VIEWS.has(view) || !env.online() || !env.visible()) return false;
    const now = env.now();
    if (now-lastInteraction >= 5*60000) return false;
    if (event === 'heartbeat' && now-lastSend < 55000) return false;
    let visitor = read('visitor');
    if (!visitor || typeof visitor.id !== 'string' || now-visitor.created >= 30*DAY || now < visitor.created) {
      visitor={id:env.uuid(),created:now}; clear();
      if (!write('visitor',visitor)) return false;
    }
    let session = read('session');
    if (!session || typeof session.id !== 'string' || now-session.last >= 30*60000 || now < session.last) session={id:env.uuid(),last:now};
    session.last=now;
    if (!write('session',session)) return false;
    const payload={v:1,id:env.uuid(),visitor:visitor.id,session:session.id,event,view};
    lastSend=now; opened=true;
    // No retries or offline queue: old activity must not look like a live user.
    try { Promise.resolve(env.send(payload)).catch(()=>{}); } catch {}
    return true;
  }
  return {track,consent,enabled,clear,choice:()=>read('consent'),
    activity(){lastInteraction=env.now();if(enabled()&&!opened)track('app_open');},
    heartbeat(){return track('heartbeat');},
    stop(){stopped=true;clear();},
    sync(){if(!enabled())clear();},
    protectedBrowser};
}

export function initAnalytics({view}) {
  const tracker=createAnalytics({storage:localStorage,now:()=>Date.now(),uuid:()=>crypto.randomUUID(),
    online:()=>navigator.onLine,visible:()=>!document.hidden,view,
    privacySignal:()=>navigator.globalPrivacyControl===true||navigator.doNotTrack==='1'||window.doNotTrack==='1',
    send:payload=>fetch('https://ikomeflow.com/wp-json/flowtrack-analytics/v1/collect',{
      method:'POST',mode:'cors',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',
      headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(payload),signal:AbortSignal.timeout(5000)
    })});
  const prompt=document.querySelector('#analytics-choice'),toggle=document.querySelector('#analytics-toggle'),status=document.querySelector('#analytics-status');
  const refresh=()=>{
    tracker.sync();
    prompt.hidden=tracker.protectedBrowser()||tracker.choice()!==null;
    toggle.checked=tracker.enabled();toggle.disabled=tracker.protectedBrowser();
    status.textContent=tracker.protectedBrowser()?'Off. Your browser privacy preference is respected.':tracker.enabled()?'On. Only anonymous usage counts are shared.':'Off. No usage events are sent.';
  };
  document.querySelector('#analytics-allow').addEventListener('click',()=>{tracker.activity();tracker.consent(true);refresh();});
  document.querySelector('#analytics-decline').addEventListener('click',()=>{tracker.consent(false);refresh();});
  toggle.addEventListener('change',()=>{tracker.activity();tracker.consent(toggle.checked);refresh();});
  for (const event of ['pointerdown','keydown','scroll']) document.addEventListener(event,()=>tracker.activity(),{passive:true,capture:true});
  window.addEventListener('storage',event=>{if(event.key?.startsWith(PREFIX))refresh();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){refresh();tracker.heartbeat();}});
  window.addEventListener('online',()=>tracker.heartbeat());
  setInterval(()=>{refresh();tracker.heartbeat();},60000);
  refresh();tracker.track('app_open');
  return tracker;
}
