import config from '../subscription.config.json';
import {verifyLease,writeAccess,OWNER_KEY,LEASE_KEY} from './subscription-policy.mjs';
let owner=null,lease=null,user=null,clockFloor=0,uiPromise;
const FLOOR_KEY='flowtrack.subscription-clock.v1';
const get=key=>{try{return localStorage.getItem(key);}catch{return null;}};
const put=(key,value)=>{try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);return true;}catch{return false;}};
let hooks={};
export const subscriptionAccess=()=>writeAccess({enabled:config.enabled,owner,user:user?.id,lease,clockFloor});
export function refreshSubscriptionControls({demo=false}={}){
 const access=demo?{allowed:true}:subscriptionAccess(),banner=document.querySelector('#subscription-banner');
 banner.hidden=!config.enabled||access.allowed;
 document.querySelector('#subscription-message').textContent=access.reason;
 for(const id of ['add-button','mobile-add','add-day','restore-button','currency']){
  const el=document.getElementById(id);if(el&&!access.allowed)el.disabled=true;
 }
}
async function readCached(){
 owner=get(OWNER_KEY);clockFloor=Number(get(FLOOR_KEY))||0;
 lease=config.enabled&&owner?await verifyLease(get(LEASE_KEY),config.offlinePublicKey,{project:config.apiUrl,user:owner}):null;
 hooks.refresh?.();
}
function changed(){hooks.refresh?.();}
export async function openSubscription(){
 try{
  if(!uiPromise)uiPromise=import('./account-v1.mjs').then(api=>api.initAccount({config,
   getOwner:()=>owner,canLink:()=>hooks.canLink?.(),access:subscriptionAccess,confirm:(...args)=>hooks.confirm(...args),
   setUser(next){const previous=user;user=next;if((previous&&previous.id!==next?.id)||(!previous&&next&&owner&&owner!==next.id))hooks.lock?.();changed();},
   async link(){
    if(!user)throw Error('Sign in first.');if(!hooks.canLink?.())throw Error('Unlock or create your local PIN before linking.');
    if(owner&&owner!==user.id)throw Error('This device is linked to another account. Use its account to renew; financial records remain accessible with your PIN.');
    if(!put(OWNER_KEY,user.id))throw Error('Allow browser storage to link this device.');owner=user.id;changed();
   },
   async accept(result){
    if(!user||result.entitlement.user_id!==user.id)throw Error('Account mismatch. Sign in again.');
    if(owner===user.id){
     const account=user.id;
     const checked=result.lease?await verifyLease(result.lease,config.offlinePublicKey,{project:config.apiUrl,user:account}):null;
     if(user?.id!==account||owner!==account)return;
     if(result.lease&&!checked)throw Error('Could not verify offline access. Contact support.');
     lease=checked;clockFloor=Date.parse(result.entitlement.server_time);put(LEASE_KEY,checked?result.lease:null);put(FLOOR_KEY,String(clockFloor));
    }
    changed();
   },
   revoke(){lease=null;put(LEASE_KEY,null);hooks.lock?.();changed();}
  })).catch(error=>{uiPromise=null;throw error;});
  return await uiPromise;
 }catch(error){hooks.notify?.('Account service unavailable. Your local records are preserved. '+error.message);return null;}
}
export function initSubscriptions(options){
 hooks=options;document.querySelectorAll('[data-account-open]').forEach(button=>button.addEventListener('click',async()=>{const ui=await openSubscription();ui?.open();}));
 void readCached();
 window.addEventListener('storage',event=>{
  if(event.key===FLOOR_KEY){clockFloor=Math.max(clockFloor,Number(event.newValue)||0);changed();}
  if(event.key===OWNER_KEY||event.key===LEASE_KEY){lease=null;if(event.key===OWNER_KEY||!event.newValue)hooks.lock?.();void readCached();}
 });
 window.addEventListener('online',()=>{if(config.enabled)void openSubscription().then(ui=>ui?.refresh()).catch(()=>{});});
 setInterval(()=>{
  const now=Date.now();if(lease&&now+60000>=clockFloor){clockFloor=Math.max(clockFloor,now);put(FLOOR_KEY,String(clockFloor));}
  changed();
 },30000);
 if(config.enabled)setTimeout(()=>void openSubscription().then(ui=>ui?.refresh()).catch(()=>{}),800);
}
