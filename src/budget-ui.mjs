import {parseAmount,money,today} from '../dist/core-v3.mjs';
import {budgetSummary,dailyGuide,configureBudget} from './budgets.mjs';
import {periodLabel} from './periods.mjs';
export function initBudgetUI({getState,save,notify,canUse,isDemo,getPeriod,getAnchor}){
 const $=id=>document.getElementById(id);let permissionBusy=false,revision=0;
 function notificationStatus(){const supported=typeof Notification!=='undefined'&&'serviceWorker' in navigator;const permission=supported?Notification.permission:'unsupported';$('budget-native').hidden=!supported;$('budget-native').disabled=permissionBusy||permission==='denied';$('budget-native').textContent=permission==='denied'?'Notifications blocked':getState().budget?.native&&permission==='granted'?'Turn off device alerts':'Enable phone / laptop alerts';$('budget-native-hint').textContent=permission==='denied'?'In-app alerts still work.':!supported?'Alerts appear inside FlowTrack.':getState().budget?.native&&permission==='granted'?'Device alerts enabled.':'Alerts follow saved expenses.';}
 function renderSettings(){if(!canUse())return;const s=getState(),b=s.budget?.currency===s.currency?s.budget:null;for(const key of ['monthly','yearly','daily'])$('budget-'+key).value=b?.[key]?(b[key]/100).toFixed(2):'';$('budget-currency').textContent=s.currency;$('budget-alerts').checked=b?.alerts??true;notificationStatus();}
 function render(){
  if(!canUse())return;const s=getState(),anchor=getAnchor(),period=getPeriod(),kind=period==='year'?'year':period==='day'&&s.budget?.daily?'day':s.budget?.monthly?'month':s.budget?.yearly?'year':'month',summary=budgetSummary(s,kind,anchor);
  $('budget-card').hidden=!summary;if(!summary)return;
  $('budget-title').textContent=({day:'Daily budget',month:'Monthly budget',year:'Yearly budget'})[kind]+' · '+periodLabel(kind,anchor);
  $('budget-amounts').textContent=money(summary.spent,s.currency)+' / '+money(summary.limit,s.currency);
  $('budget-left').textContent=summary.spent>summary.limit?money(summary.spent-summary.limit,s.currency)+' over budget':money(summary.left,s.currency)+' left';
  $('budget-progress').value=summary.percent;$('budget-progress').setAttribute('aria-label',summary.percent+'% of '+kind+' budget used');$('budget-card').dataset.level=String(summary.level);
  const guide=kind==='month'&&anchor.slice(0,7)===today().slice(0,7)?dailyGuide(s,today()):null;$('budget-guide').hidden=guide===null;$('budget-guide').textContent=guide===null?'':money(guide,s.currency)+' / day guide';
 }
 $('budget-form').addEventListener('submit',async e=>{e.preventDefault();if(!canUse())return;const button=$('budget-save');if(button.disabled)return;button.disabled=true;$('budget-error').textContent='';try{const settings={};for(const key of ['monthly','yearly','daily'])settings[key]=$('budget-'+key).value.trim()?parseAmount($('budget-'+key).value):null;settings.alerts=$('budget-alerts').checked;settings.native=getState().budget?.native||false;const next=configureBudget(getState(),settings);if(await save(next)){renderSettings();notify('Budget saved.');}else $('budget-error').textContent='Budget was not saved.';}catch(error){if(canUse())$('budget-error').textContent=error.message;}finally{button.disabled=false;}});
 $('budget-native').addEventListener('click',async()=>{
  if(!canUse()||isDemo()||permissionBusy)return;let initial=getState();if(!initial.budget){$('budget-native-hint').textContent='Save a budget first.';return;}
  try{if(['monthly','yearly','daily'].some(k=>($('budget-'+k).value.trim()?parseAmount($('budget-'+k).value):null)!==(initial.budget.currency===initial.currency?initial.budget[k]:null))){$('budget-native-hint').textContent='Save your changes first.';return;}}catch{$('budget-native-hint').textContent='Save your changes first.';return;}
  if(initial.budget.native){await save({...initial,budget:{...initial.budget,native:false}});renderSettings();return;}
  if(initial.budget.currency!==initial.currency||!['monthly','yearly','daily'].some(k=>initial.budget[k])){$('budget-native-hint').textContent='Save a budget first.';return;}
  if(!initial.budget.alerts||!$('budget-alerts').checked){$('budget-native-hint').textContent='Turn on budget alerts and save first.';return;}
  permissionBusy=true;notificationStatus();const ticket=revision;initial=null;
  try{const permission=await Notification.requestPermission();if(!canUse()||revision!==ticket)return;if(permission==='granted'){const current=getState();if(await save({...current,budget:{...current.budget,native:true}}))notify('Device alerts enabled.');}else notify('In-app alerts remain available.');}catch{notify('Use in-app alerts on this browser.');}finally{permissionBusy=false;if(canUse())notificationStatus();}
 });
 $('budget-alert-close').addEventListener('click',()=>{$('budget-alert').hidden=true;$('budget-alert-text').textContent='';});
 function alert(summary){revision++;if(!summary||!canUse())return;const text=({day:'Daily',month:'Monthly',year:'Yearly'})[summary.kind]+' budget: '+summary.level+'% reached.';$('budget-alert-text').textContent=text;$('budget-alert').hidden=false;
  if(!isDemo()&&getState().budget?.native&&typeof Notification!=='undefined'&&Notification.permission==='granted')navigator.serviceWorker.ready.then(reg=>reg.showNotification('FlowTrack budget',{body:text+' Open FlowTrack for details.',tag:'flowtrack-budget',icon:'./icon-192.png'})).catch(()=>{});
 }
 function clear(){revision++;for(const key of ['monthly','yearly','daily'])$('budget-'+key).value='';$('budget-error').textContent='';$('budget-currency').textContent='';$('budget-alert').hidden=true;$('budget-alert-text').textContent='';$('budget-card').hidden=true;delete $('budget-card').dataset.level;for(const id of ['budget-title','budget-amounts','budget-left','budget-guide'])$(id).textContent='';$('budget-progress').value=0;$('budget-progress').removeAttribute('aria-label');$('budget-more').open=false;$('budget-settings').open=false;}
 return {render,renderSettings,alert,clear};
}
