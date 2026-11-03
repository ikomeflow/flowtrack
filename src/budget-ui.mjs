import {parseAmount,money,today} from '../dist/core-v4.mjs';
import {budgetSummary,dailyGuide,configureBudget} from './budgets.mjs';
import {periodLabel} from './periods.mjs';
export function initBudgetUI({getState,save,notify,canUse,isDemo,getPeriod,getAnchor}){
 const $=id=>document.getElementById(id),periods=['daily','weekly','monthly','yearly'],fields={day:'daily',week:'weekly',month:'monthly',year:'yearly'},labels={daily:'Daily',weekly:'Weekly',monthly:'Monthly',yearly:'Yearly'};
 let permissionBusy=false,revision=0,selected='monthly',drafts={};
 const stash=()=>{drafts[selected]=$('budget-limit').value;};
 const amounts=()=>Object.fromEntries(periods.map(key=>[key,drafts[key]?.trim()?parseAmount(drafts[key]):null]));
 function showPeriod(){$('budget-period').value=selected;$('budget-limit').value=drafts[selected]||'';$('budget-limit').setAttribute('aria-label',labels[selected]+' expenditure limit');}
 function notificationStatus(){const supported=typeof Notification!=='undefined'&&'serviceWorker' in navigator;const permission=supported?Notification.permission:'unsupported';$('budget-native').hidden=!supported;$('budget-native').disabled=permissionBusy||permission==='denied';$('budget-native').textContent=permission==='denied'?'Notifications blocked':getState().budget?.native&&permission==='granted'?'Turn off device alerts':'Enable phone / laptop alerts';$('budget-native-hint').textContent=permission==='denied'?'In-app alerts still work.':!supported?'Alerts appear inside FlowTrack.':getState().budget?.native&&permission==='granted'?'Device alerts enabled.':'Alerts follow saved expenses.';}
 function renderSettings(){if(!canUse())return;const s=getState(),b=s.budget?.currency===s.currency?s.budget:null;drafts=Object.fromEntries(periods.map(key=>[key,b?.[key]?(b[key]/100).toFixed(2):'']));showPeriod();$('budget-currency').textContent=s.currency;$('budget-alerts').checked=b?.alerts??true;notificationStatus();}
 $('budget-period').addEventListener('change',()=>{if(!canUse())return;stash();selected=$('budget-period').value;showPeriod();$('budget-error').textContent='';});
 function render(){
  if(!canUse())return;const s=getState(),b=s.budget,period=getPeriod();let anchor=getAnchor();
  const kind=b?.[fields[period]]?period:period==='year'?'year':b?.monthly?'month':b?.weekly?'week':b?.daily?'day':b?.yearly?'year':period;
  if(kind!==period&&['day','week'].includes(kind)&&period==='month'&&anchor.slice(0,7)===today().slice(0,7))anchor=today();
  const summary=budgetSummary(s,kind,anchor);$('budget-card').hidden=!summary;if(!summary)return;
  $('budget-title').textContent=labels[fields[kind]]+' budget · '+periodLabel(kind,anchor);
  $('budget-amounts').textContent=money(summary.spent,s.currency)+' / '+money(summary.limit,s.currency);
  $('budget-left').textContent=summary.spent>summary.limit?money(summary.spent-summary.limit,s.currency)+' over budget':money(summary.left,s.currency)+' left';
  $('budget-progress').value=summary.percent;$('budget-progress').setAttribute('aria-label',summary.percent+'% of '+kind+' budget used');$('budget-card').dataset.level=String(summary.level);
  const guide=kind==='month'&&anchor.slice(0,7)===today().slice(0,7)?dailyGuide(s,today()):null;$('budget-guide').hidden=guide===null;$('budget-guide').textContent=guide===null?'':money(guide,s.currency)+' / day guide';
 }
 $('budget-form').addEventListener('submit',async e=>{e.preventDefault();if(!canUse())return;const button=$('budget-save');if(button.disabled)return;button.disabled=true;$('budget-error').textContent='';try{stash();const settings={...amounts(),alerts:$('budget-alerts').checked,native:getState().budget?.native||false},next=configureBudget(getState(),settings);if(await save(next)){renderSettings();notify('Limits saved.');}else $('budget-error').textContent='Limits were not saved.';}catch(error){if(canUse())$('budget-error').textContent=error.message;}finally{button.disabled=false;}});
 $('budget-native').addEventListener('click',async()=>{
  if(!canUse()||isDemo()||permissionBusy)return;let initial=getState();if(!initial.budget){$('budget-native-hint').textContent='Save a limit first.';return;}
  try{stash();const values=amounts();if(periods.some(k=>values[k]!==(initial.budget.currency===initial.currency?initial.budget[k]??null:null))){$('budget-native-hint').textContent='Save your changes first.';return;}}catch{$('budget-native-hint').textContent='Save your changes first.';return;}
  if(initial.budget.native&&Notification.permission==='granted'){await save({...initial,budget:{...initial.budget,native:false}});renderSettings();return;}
  if(initial.budget.currency!==initial.currency||!periods.some(k=>initial.budget[k])){$('budget-native-hint').textContent='Save a limit first.';return;}
  if(!initial.budget.alerts||!$('budget-alerts').checked){$('budget-native-hint').textContent='Turn on budget alerts and save first.';return;}
  permissionBusy=true;notificationStatus();const ticket=revision;initial=null;
  try{const permission=await Notification.requestPermission();if(!canUse()||revision!==ticket)return;if(permission==='granted'){const current=getState();if(await save({...current,budget:{...current.budget,native:true}}))notify('Device alerts enabled.');}else notify('In-app alerts remain available.');}catch{notify('Use in-app alerts on this browser.');}finally{permissionBusy=false;if(canUse())notificationStatus();}
 });
 $('budget-alert-close').addEventListener('click',()=>{$('budget-alert').hidden=true;$('budget-alert-text').textContent='';});
 function alert(summary){revision++;if(!summary||!canUse())return;const text=labels[fields[summary.kind]]+' budget: '+summary.level+'% reached.';$('budget-alert-text').textContent=text;$('budget-alert').hidden=false;
  if(!isDemo()&&getState().budget?.native&&typeof Notification!=='undefined'&&Notification.permission==='granted')navigator.serviceWorker.ready.then(reg=>reg.showNotification('FlowTrack budget',{body:text+' Open FlowTrack for details.',tag:'flowtrack-budget',icon:'./icon-192.png'})).catch(()=>{});
 }
 function clear(){revision++;drafts={};selected='monthly';showPeriod();$('budget-error').textContent='';$('budget-currency').textContent='';$('budget-alert').hidden=true;$('budget-alert-text').textContent='';$('budget-card').hidden=true;delete $('budget-card').dataset.level;for(const id of ['budget-title','budget-amounts','budget-left','budget-guide'])$(id).textContent='';$('budget-progress').value=0;$('budget-progress').removeAttribute('aria-label');$('budget-settings').open=false;}
 return {render,renderSettings,alert,clear};
}
