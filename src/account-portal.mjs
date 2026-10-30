import {initAccount} from './account.mjs';
import {verifyLease} from './subscription-policy.mjs';
import settings from '../subscription.config.json';
const config={...settings,enabled:true};
let user=null,resolveConfirm;
const confirmDialog=document.querySelector('#portal-confirm');
function finishConfirm(value){confirmDialog.close();resolveConfirm?.(value);resolveConfirm=null;}
document.querySelector('#portal-confirm-yes').addEventListener('click',()=>finishConfirm(true));
document.querySelector('#portal-confirm-no').addEventListener('click',()=>finishConfirm(false));
confirmDialog.addEventListener('cancel',event=>{event.preventDefault();finishConfirm(false);});
const ui=initAccount({config,getOwner:()=>null,canLink:()=>false,
 access:()=>({allowed:false,reason:'Manage your account here. To link a browser ledger, open FlowTrack and unlock its local PIN. Financial records stay in that browser.'}),
 setUser(next){user=next;},
 async accept(result){if(result.lease&&!await verifyLease(result.lease,config.offlinePublicKey,{project:config.apiUrl,user:user?.id}))throw Error('Could not verify the account response. Please contact support.');},
 revoke(){user=null;},
 link(){throw Error('Open FlowTrack and unlock its local PIN to link this browser.');},
 confirm(title,text,label){document.querySelector('#portal-confirm-title').textContent=title;document.querySelector('#portal-confirm-text').textContent=text;document.querySelector('#portal-confirm-yes').textContent=label;confirmDialog.showModal();return new Promise(resolve=>resolveConfirm=resolve);}
});
document.querySelector('#portal-open').addEventListener('click',()=>ui.open());
ui.open();
