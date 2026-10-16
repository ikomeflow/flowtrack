import {deviceAvailable,createDeviceUnlock,unlockWithDevice,deviceError} from './device-v1.mjs';
import {LedgerVault,isVault,validateVault} from './vault-v8.mjs';
import { STORAGE_KEY,CURRENCIES,today,parseAmount,validateTransaction,validateState,emptyState,totals,filterTransactions,money,shiftMonth,csvExport } from './core.mjs';
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={lock:'M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4',grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',arrows:'M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4',calendar:'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',shield:'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7z M8 12l3 3 5-6',plus:'M12 5v14M5 12h14',left:'m14 6-6 6 6 6',right:'m10 6 6 6-6 6',down:'M17 7 7 17M7 7v10h10',up:'M7 17 17 7M7 7h10v10',wallet:'M3 6h16v14H3zM3 6V3h13v3M15 11h6v5h-6z',help:'M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',pie:'M11 3v10h10A10 10 0 1 1 11 3zM15 2v7h7a9 9 0 0 0-7-7',search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14M15 15l6 6',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',close:'m6 6 12 12M18 6 6 18',edit:'m15 4 5 5M4 20l4-1L21 6l-4-4L4 15z',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7'};
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.wallet}"/></svg>`;
function icons(){ $$('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);}); }
let data=emptyState(),demo=null,corrupt=false,storageUnavailable=false,recoveryRaw='',month=today().slice(0,7),selectedDate=today(),editingId=null,toastTimer,installPrompt,confirmResolve;
const state=()=>demo||data;
const fmt=n=>money(n,state().currency);
function notify(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4500);}
const vault=new LedgerVault({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value),removeItem:key=>localStorage.removeItem(key)});
let deviceSupported=false,deviceBusy=false,deviceAbort=null;
try{window.name='flowtrack-app';}catch{}
let saving=false,lockRequested=false,pendingReload=false,lastActivity=Date.now(),pinMode='enable',pendingRecovery=null,unlockFailures=0,booted=false,automaticDeviceUnlockPending=true,automaticDeviceUnlockCancelled=false;
function load(){
  corrupt=false;storageUnavailable=false;recoveryRaw='';data=emptyState();
  try{const value=vault.load();if(value)data=value;}
  catch(e){if(e instanceof SyntaxError||vault.raw!==null){corrupt=true;recoveryRaw=vault.raw||'';}else storageUnavailable=true;}
  try{const test='flowtrack.storage-check';localStorage.setItem(test,'1');localStorage.removeItem(test);}catch{storageUnavailable=true;}
  updateStorageNotice();
}
function updateStorageNotice(){
 const alert=$('#storage-alert');alert.hidden=!corrupt&&!storageUnavailable;
 alert.textContent=corrupt?'Your saved ledger could not be read. It has been preserved. New entries are blocked to protect it. In Settings, download the original data, then restore a valid backup or clear it deliberately.':storageUnavailable?'Browser storage is unavailable. Changes will only last for this open session. Download a JSON backup before closing this page.':'';
 $('#recovery-button').hidden=!corrupt;$('#add-button').disabled=corrupt&&!demo;
}
async function commit(next){
 if(saving||vault.locked){notify('Wait for saving to finish, or unlock FlowTrack.');return false;}
 saving=true;
 try{next=validateState(next);if(demo){demo=next;render();return true;}if(corrupt)throw Error('Saved data is unreadable. Recover it from Settings before making changes.');
   if(!storageUnavailable||vault.enabled){try{await vault.save(next);}catch(e){throw Error('Could not save. Your change was not applied. '+e.message);}}
   data=next;render();return true;
 }catch(e){notify(e.message);return false;}
 finally{finishSaving();}
}
function confirmAction(title,message,label='Continue',danger=false){
 $('#confirm-title').textContent=title;$('#confirm-message').textContent=message;$('#confirm-ok').textContent=label;$('#confirm-ok').className=`button ${danger?'danger':'primary'}`;
 $('#confirm-dialog').showModal();$('#confirm-cancel').focus();return new Promise(resolve=>confirmResolve=resolve);
}
function finishConfirm(value){$('#confirm-dialog').close();confirmResolve?.(value);confirmResolve=null;}
$('#confirm-ok').addEventListener('click',()=>finishConfirm(true));$('#confirm-cancel').addEventListener('click',()=>finishConfirm(false));$('#confirm-close').addEventListener('click',()=>finishConfirm(false));$('#confirm-dialog').addEventListener('cancel',e=>{e.preventDefault();finishConfirm(false);});
function dateLabel(date,opts={day:'numeric',month:'short'}){return new Date(date+'T12:00:00').toLocaleDateString(undefined,opts);}
function monthLabel(m,opts={month:'short'}){return dateLabel(m+'-01',opts);}
function empty(title,message,add=false){return `<div class="empty"><span class="empty-icon">${icon('arrows')}</span><h3>${escape(title)}</h3><p>${escape(message)}</p>${add?'<button class="button primary" data-add>Add transaction</button>':''}</div>`;}
function table(rows,emptyText='No transactions yet',add=false){
 if(!rows.length)return empty(emptyText,add?'Tap + Add to start.':'Try another date or search.');
 return `<div class="entry-list">${rows.map(t=>`<button class="entry-row" data-edit="${escape(t.id)}" aria-label="Edit ${escape(t.description)}"><span class="transaction-icon ${t.type}">${icon(t.type==='income'?'down':'up')}</span><span class="entry-copy"><span class="transaction-description">${escape(t.description)}</span><span class="entry-date">${escape(dateLabel(t.date,{day:'numeric',month:'short',year:'numeric'}))}${t.tags.length?' · '+escape(t.tags.join(', ')):''}</span></span><span class="entry-amount ${t.type==='income'?'positive':''}">${t.type==='income'?'+':'−'}${escape(fmt(t.amount))}</span></button>`).join('')}</div>`;
}
function overview(){
 const rows=filterTransactions(state().transactions,{month}),sum=totals(rows);
 $('#net-value').textContent=fmt(sum.net);$('#income-value').textContent=fmt(sum.income);$('#expense-value').textContent=fmt(sum.expense);
 $('#recent-list').innerHTML=table(rows.slice(0,5),'No transactions',!rows.length);

}
function filtered(){return filterTransactions(state().transactions,{month:$('#period-filter').value==='month'?month:'',query:$('#search').value,type:$('#type-filter').value});}
function history(){const rows=filtered();$('#result-count').textContent=`${rows.length} ${rows.length===1?'transaction':'transactions'}`;$('#transaction-list').innerHTML=table(rows,'No matching transactions');$('#history-month').disabled=$('#period-filter').value==='all';}
function calendar(){
 const [y,m]=month.split('-').map(Number),first=new Date(y,m-1,1).getDay(),days=new Date(y,m,0).getDate();
 let html=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="weekday">${d}</div>`).join('')+'<div aria-hidden="true"></div>'.repeat(first);
 const rows=filterTransactions(state().transactions,{month});
 for(let day=1;day<=days;day++){const date=`${month}-${String(day).padStart(2,'0')}`,entries=rows.filter(t=>t.date===date),s=totals(entries);html+=`<button class="day ${date===today()?'today':''} ${date===selectedDate?'selected':''}" data-date="${date}" aria-pressed="${date===selectedDate}" aria-label="${escape(dateLabel(date,{dateStyle:'full'}))}, ${entries.length} transactions, income ${escape(fmt(s.income))}, expenses ${escape(fmt(s.expense))}"><span>${day}</span>${entries.length?`<span class="day-count">${entries.length} ${entries.length===1?'entry':'entries'}</span>`:''}<span class="day-dots">${entries.some(t=>t.type==='income')?'<i class="income-dot"></i>':''}${entries.some(t=>t.type==='expense')?'<i class="expense-dot"></i>':''}</span></button>`;}
 $('#calendar-grid').innerHTML=html;const dayRows=filterTransactions(rows,{date:selectedDate}),sum=totals(dayRows);
 $('#day-title').textContent=dateLabel(selectedDate,{day:'numeric',month:'long',year:'numeric'});$('#day-summary').textContent=`${dayRows.length} ${dayRows.length===1?'entry':'entries'} · Net ${fmt(sum.net)}`;
 $('#day-list').innerHTML=table(dayRows,'No entries on this day');
}
function render(){
 for(const id of ['overview-month','history-month','calendar-month'])$('#'+id).value=month;
 $('#currency').value=state().currency;securityStatus();$('#demo-banner').hidden=!demo;$('#demo-button').hidden=!!demo;updateStorageNotice();overview();history();calendar();route(false);
}
function setMonth(value){if(!/^\d{4}-\d{2}$/.test(value)||value<'1900-01'||value>'9999-12')return;month=value;if(!selectedDate.startsWith(month))selectedDate=month===today().slice(0,7)?today():month+'-01';render();}
for(const id of ['overview-month','history-month','calendar-month'])$('#'+id).addEventListener('change',e=>setMonth(e.target.value));
$$('.prev-month').forEach(b=>b.addEventListener('click',()=>setMonth(shiftMonth(month,-1))));$$('.next-month').forEach(b=>b.addEventListener('click',()=>setMonth(shiftMonth(month,1))));
const views={overview:'Home',transactions:'History',calendar:'History',settings:'Settings'};
function route(focus=true){const view=Object.hasOwn(views,location.hash.slice(1))?location.hash.slice(1):'overview';$$('.view').forEach(v=>v.hidden=v.id!==view+'-view');$$('nav a').forEach(a=>{a.classList.toggle('active',a.dataset.view===(view==='calendar'?'transactions':view));if(a.dataset.view===(view==='calendar'?'transactions':view))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});$('#page-title').textContent=views[view];$('#breadcrumb').textContent=views[view];$('#add-button').hidden=view==='settings';if(focus)$('#main').focus({preventScroll:true});}
window.addEventListener('hashchange',()=>route());

function openTransaction(id=null,date=null){
 if(vault.locked||$('#app-shell').hidden)return;if(corrupt&&!demo){notify('Recover your saved data from Settings first.');return;}
 const t=id?state().transactions.find(x=>x.id===id):null;editingId=t?.id||null;$('#transaction-form').reset();$('#transaction-title').textContent=t?'Edit transaction':'Add transaction';$('#save-button').textContent=t?'Save changes':'Save';$('#delete-transaction').hidden=!t;$('#transaction-options').open=!!t&&(t.tags.length>0||t.date!==today());$('#description').value=t?.description||'';$('#amount').value=t?(t.amount/100).toFixed(2):'';$('#date').value=t?.date||date||today();$('#tags').value=t?.tags.join(', ')||'';$('#amount-currency').textContent=state().currency;$('#form-error').textContent='';$(`input[name=type][value=${t?.type||'expense'}]`).checked=true;$('#transaction-dialog').showModal();$('#amount').focus();
}
$('#add-button').addEventListener('click',()=>openTransaction());$('#add-day').addEventListener('click',()=>openTransaction(null,selectedDate));$$('.close-transaction').forEach(b=>b.addEventListener('click',()=>$('#transaction-dialog').close()));
$('#date').addEventListener('invalid',()=>$('#transaction-options').open=true);
$('#transaction-form').addEventListener('submit',async e=>{
 e.preventDefault();try{const t=validateTransaction({id:editingId||crypto.randomUUID(),description:$('#description').value.trim(),amount:parseAmount($('#amount').value),date:$('#date').value,type:$('input[name=type]:checked').value,tags:$('#tags').value.split(',').map(s=>s.trim()).filter(Boolean)});
 const tx=state().transactions.filter(x=>x.id!==t.id);tx.push(t);if(await commit({...state(),transactions:tx})){setMonth(t.date.slice(0,7));selectedDate=t.date;calendar();$('#transaction-dialog').close();notify(demo?'Demo transaction saved.':storageUnavailable?'Saved for this session only. Back up before closing.':'Saved.');}}
 catch(err){$('#form-error').textContent=err.message;}
});
document.addEventListener('click',async e=>{
 const add=e.target.closest('[data-add]');if(add)openTransaction();
 const edit=e.target.closest('[data-edit]');if(edit)openTransaction(edit.dataset.edit);

 const day=e.target.closest('[data-date]');if(day){selectedDate=day.dataset.date;calendar();$(`[data-date="${selectedDate}"]`)?.focus();}
});
$('#delete-transaction').addEventListener('click',async()=>{const t=state().transactions.find(x=>x.id===editingId);if(!t)return;if(await confirmAction('Delete transaction?',`“${t.description}” (${fmt(t.amount)}) will be removed. This cannot be undone.`,'Delete transaction',true)){if(await commit({...state(),transactions:state().transactions.filter(x=>x.id!==t.id)})){$('#transaction-dialog').close();notify('Transaction deleted.');}}});
$('#search').addEventListener('input',history);$('#type-filter').addEventListener('change',history);$('#period-filter').addEventListener('change',history);
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportCSV(rows){download(csvExport(rows,state().currency),`flowtrack${demo?'-demo':''}-${today()}.csv`,'text/csv;charset=utf-8');notify(`Exported ${rows.length} transactions. Keep this file private.`);}
$('#export-all').addEventListener('click',()=>exportCSV(state().transactions));$('#export-filtered').addEventListener('click',()=>exportCSV(filtered()));
$('#backup-button').addEventListener('click',()=>{if(corrupt&&!demo){notify('Download the unreadable original using the recovery link first.');return;}download(JSON.stringify(state(),null,2),`flowtrack${demo?'-demo':''}-backup-${today()}.json`,'application/json');notify('Backup downloaded. Keep it somewhere safe and private.');});
$('#recovery-button').addEventListener('click',()=>download(recoveryRaw,`flowtrack-recovery-${today()}.txt`,'text/plain'));
$('#restore-button').addEventListener('click',()=>$('#restore-file').click());
$('#restore-file').addEventListener('change',async e=>{
 const f=e.target.files[0];e.target.value='';if(!f)return;
 try{if(f.size>32*1024*1024)throw Error('Backup is too large (32 MB maximum).');if(saving)throw Error('Wait for the current save to finish.');
 const parsed=JSON.parse(await f.text());
 if(isVault(parsed)){
   const incoming=validateVault(parsed);if(demo)throw Error('Leave demo mode before restoring a locked copy.');
   if(await confirmAction('Restore locked copy?','This replaces this browser’s ledger. You will need the PIN that protected this copy. Back up current records first.','Restore locked copy')){vault.replaceLocked(incoming);lockApp(false);}return;
 }
 const incoming=validateState(parsed);
 if(await confirmAction('Replace this ledger?',`Restore ${incoming.transactions.length} transactions in ${incoming.currency}? This replaces ${demo?'the demo ledger':'all current records in this browser'}. Back up first.`,'Restore backup')){
   if(demo){demo=incoming;render();notify('Backup loaded into demo mode only.');return;}
   saving=true;try{await vault.save(incoming);data=incoming;corrupt=false;storageUnavailable=false;recoveryRaw='';render();showApp();notify('Backup restored.');}finally{finishSaving();}
 }
 }catch(err){notify('Restore failed: '+err.message);}
});
$('#clear-button').addEventListener('click',async()=>{if(saving){notify('Wait for saving to finish.');return;}if(await confirmAction('Clear all data?',`Permanently erase ${demo?'the demo ledger':'this browser’s ledger, currency and PIN'}? Download a JSON backup first. This cannot be undone.`,'Clear all data',true)){if(demo){demo=emptyState();render();notify('Demo ledger cleared.');return;}try{vault.clear();data=emptyState();corrupt=false;recoveryRaw='';render();showApp();notify('All local records cleared.');}catch{notify('Could not clear browser storage.');}}});
$('#currency').innerHTML=Object.entries(CURRENCIES).map(([code,name])=>`<option value="${code}">${code} — ${name}</option>`).join('');
$('#currency').addEventListener('change',async e=>{const next=e.target.value,previous=state().currency;e.target.value=previous;if(next===previous)return;if(state().transactions.length&&!await confirmAction('Change display currency?',`All existing ${previous} amounts will be relabeled as ${next}, with no exchange-rate conversion. For example, 1,000 ${previous} becomes 1,000 ${next}. Only continue if your ledger uses this currency.`,'Change currency'))return;if(await commit({...state(),currency:next}))notify(`Display currency changed to ${next}. No conversion applied.`);});
$('#demo-button').addEventListener('click',()=>{
 const templates=[['Freelance design','income',180000,'Work',2],['Groceries','expense',24500,'Food',4],['Monthly salary','income',320000,'Salary',5],['Ride to work','expense',3500,'Transport',8],['Weekend lunch','expense',8500,'Food',12],['Mobile data','expense',6000,'Essentials',14],['Online course','expense',15000,'Learning',16],['Side project','income',45000,'Work',20],['Weekly shopping','expense',18500,'Food',22]];
 demo={version:1,currency:'XAF',transactions:[]};for(let i=-5;i<=0;i++){const m=shiftMonth(month,i);templates.forEach(([description,type,amount,tag,day],j)=>demo.transactions.push({id:`demo-${i}-${j}`,description,type,amount:Math.round(amount*(1+(i+5)*.06))*100,date:`${m}-${String(day).padStart(2,'0')}`,tags:[tag]}));}render();notify('Exploring sample data. Your saved records are untouched.');
});
$('#exit-demo').addEventListener('click',()=>{demo=null;render();notify('Back to your own ledger.');});
function storageChanged(){
 cancelDeviceOperation();clearRecoveryDraft();const wasProtected=vault.enabled;load();$('#transaction-dialog').close();$('#pin-dialog').close();$('#pin-form').reset();demo=null;
 if(vault.locked)lockApp(false);else{showApp();render();notify(wasProtected?'PIN or ledger changed in another tab.':'Ledger updated from another tab.');}
}
function finishSaving(){
 saving=false;
 if(pendingReload){pendingReload=false;lockRequested=false;storageChanged();}
 else if(lockRequested){lockRequested=false;lockApp();}
 securityStatus();
}
window.addEventListener('storage',e=>{
 if(e.key==='flowtrack.lock'&&vault.enabled){lockApp(false);return;}
 if(e.key===STORAGE_KEY||e.key===null){
   if(saving){pendingReload=true;return;}
   storageChanged();
 }
});
function connection(){ $('#connection').innerHTML=`<span></span>${navigator.onLine?'Local':'Offline'}`; }
window.addEventListener('online',connection);window.addEventListener('offline',connection);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('#install-button').hidden=false;});
$('#install-button').addEventListener('click',async()=>{if(!installPrompt)return;await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('#install-button').hidden=true;});
window.addEventListener('appinstalled',()=>{$('#install-button').hidden=true;notify('FlowTrack installed. Your records remain on this device.');});
function securityStatus(){
 const enabled=vault.enabled;$('#lock-button').hidden=!enabled;
 $('#pin-enable').hidden=enabled;$('#pin-change').hidden=!enabled;$('#pin-disable').hidden=true;$('#pin-disable').disabled=true;
 $('#pin-status').textContent=enabled?'On · locks after 30 minutes idle':'PIN setup required';
 const ready=!!vault.device&&deviceSupported;$('#device-unlock').hidden=!ready;$('#pin-entry-summary').hidden=!ready;$('#pin-entry').open=!ready;$('#device-enable').hidden=!enabled||!deviceSupported||!!vault.device;$('#device-enable').disabled=!!demo||saving||corrupt;$('#device-remove').hidden=!enabled||!vault.device;$('#device-status').textContent=vault.device?'On.':!deviceSupported?'Unavailable on this browser or device. Use your FlowTrack PIN.':'Face, fingerprint or device PIN.';
 $('#pin-recovery').hidden=!enabled;$('#pin-recovery').textContent=vault.hasRecovery?'Replace recovery key':'Set up recovery';$('#recovery-status').hidden=!enabled;$('#recovery-status').textContent=vault.hasRecovery?'Recovery key ready.':'Recovery not set up.';$('#start-pin-reset').disabled=!vault.hasRecovery;$('#recovery-gate-hint').textContent=vault.hasRecovery?'Use your saved recovery key to reset the PIN and keep your records.':'Recovery was not set up for this ledger. Unlock with your PIN to add it, or use a separate JSON backup.';
 for(const id of ['pin-enable','pin-change','pin-recovery'])$('#'+id).disabled=!!demo||corrupt||storageUnavailable||!globalThis.crypto?.subtle;
}
function needsSetup(){return !vault.enabled&&!corrupt;}
function showApp(){
 $('#lock-screen').hidden=true;
 if(needsSetup()){$('#setup-screen').hidden=false;$('#app-shell').hidden=true;$('#app-shell').inert=true;$('#setup-existing').hidden=!data.transactions.length;$('#setup-backup').hidden=!data.transactions.length;const unavailable=storageUnavailable||!globalThis.crypto?.subtle;$('#setup-pin').disabled=unavailable;$('#setup-restore').disabled=unavailable;$('#setup-error').textContent=unavailable?'This browser cannot securely save a PIN. Use HTTPS and allow browser storage. Back up existing records first.':'';return;}
 $('#setup-screen').hidden=true;$('#app-shell').hidden=false;$('#app-shell').inert=false;automaticDeviceUnlockPending=false;automaticDeviceUnlockCancelled=false;lastActivity=Date.now();
}
$('#setup-pin').addEventListener('click',()=>openPin('enable'));
$('#setup-restore').addEventListener('click',()=>$('#restore-file').click());
$('#setup-backup').addEventListener('click',()=>download(JSON.stringify(data,null,2),`flowtrack-backup-${today()}.json`,'application/json'));
function lockApp(broadcast=true){
 if(!vault.enabled)return;
 cancelDeviceOperation();if(saving){lockRequested=true;return;}
 clearRecoveryDraft();vault.lock();data=emptyState();demo=null;editingId=null;$('#transaction-form').reset();$('#pin-form').reset();$('#reset-pin-form').reset();$('#search').value='';
 for(const dialog of $$('dialog'))if(dialog.open)dialog.close();if(confirmResolve){confirmResolve(false);confirmResolve=null;}
 $('#toast').hidden=true;render();$('#app-shell').hidden=true;$('#app-shell').inert=true;$('#setup-screen').hidden=true;$('#lock-screen').hidden=false;$('#device-unlock-error').textContent='';$('#unlock-pin').value='';$('#unlock-error').textContent='';
 if(broadcast)try{localStorage.setItem('flowtrack.lock',crypto.randomUUID());}catch{}
 if(!document.hidden)$(vault.device&&deviceSupported?'#device-unlock':'#unlock-pin').focus();
}
$('#lock-button').addEventListener('click',()=>{automaticDeviceUnlockPending=false;lockApp();});
$('#unlock-form').addEventListener('submit',async e=>{
 e.preventDefault();const button=$('#unlock-button');if(button.disabled)return;button.disabled=true;$('#unlock-error').textContent='';
 try{data=await vault.unlock($('#unlock-pin').value);$('#unlock-pin').value='';unlockFailures=0;corrupt=false;render();showApp();$('#main').focus({preventScroll:true});void offerDeviceUnlock();}
 catch(err){$('#unlock-pin').value='';$('#unlock-error').textContent=err.message;unlockFailures++;await new Promise(r=>setTimeout(r,Math.min(30000,1000*2**Math.min(unlockFailures-1,5))));}
 finally{button.disabled=false;}
});
function openPin(mode){
 if(demo||corrupt||storageUnavailable||saving)return;pinMode=mode;$('#pin-form').reset();$('#pin-error').textContent='';
 const label=mode==='enable'?'Create PIN':mode==='change'?'Change PIN':mode==='remove-device'?'Remove device unlock':(vault.hasRecovery?'Replace recovery key':'Set up recovery');$('#pin-title').textContent=label;$('#pin-save').textContent=label;
 $('#pin-current-group').hidden=mode==='enable';$('#pin-current').disabled=mode==='enable';
 const needsNewPin=mode==='enable'||mode==='change';$('#pin-new-group').hidden=!needsNewPin;for(const id of ['pin-new','pin-confirm'])$('#'+id).disabled=!needsNewPin;
 $('#pin-dialog').showModal();$(mode==='enable'?'#pin-new':'#pin-current').focus();
}
$('#pin-enable').addEventListener('click',()=>openPin('enable'));$('#pin-change').addEventListener('click',()=>openPin('change'));$('#pin-recovery').addEventListener('click',()=>openPin('recovery'));
function closePin(){if(!saving){$('#pin-dialog').close();$('#pin-form').reset();}}
$('#pin-close').addEventListener('click',closePin);$('#pin-cancel').addEventListener('click',closePin);$('#pin-dialog').addEventListener('cancel',e=>{e.preventDefault();closePin();});
$('#pin-form').addEventListener('submit',async e=>{
 e.preventDefault();if(saving)return;$('#pin-error').textContent='';
 if(['enable','change'].includes(pinMode)&&$('#pin-new').value!==$('#pin-confirm').value){$('#pin-error').textContent='PINs do not match.';return;}
 saving=true;$('#pin-save').disabled=true;
 try{
  const draft=['recovery','remove-device'].includes(pinMode)?await vault.prepareRecovery($('#pin-current').value):await vault.prepareSimplePin($('#pin-new').value,data,pinMode==='change'?$('#pin-current').value:undefined);$('#pin-dialog').close();$('#pin-form').reset();if(draft.recoveryKey)offerRecovery(draft);else{data=vault.commitPrepared(draft);render();showApp();notify('PIN saved.');void offerDeviceUnlock();}
  lastActivity=Date.now();
 }catch(err){$('#pin-error').textContent=err.message;}
 finally{$('#pin-save').disabled=false;finishSaving();}
});
function clearRecoveryDraft(){
 vault.discardPrepared(pendingRecovery);pendingRecovery=null;$('#generated-recovery').value='';$('#recovery-saved').checked=false;
 if($('#save-recovery-dialog').open)$('#save-recovery-dialog').close();
}
function offerRecovery(draft){
 if(!draft.recoveryKey)throw Error('Recovery setup failed. Your PIN and records are unchanged.');
 clearRecoveryDraft();pendingRecovery=draft;$('#generated-recovery').value=draft.recoveryKey;$('#recovery-save-error').textContent='';$('#recovery-saved').checked=false;$('#save-recovery-dialog').showModal();$('#download-recovery').focus();lastActivity=Date.now();
}
function cancelRecovery(){if(saving)return;clearRecoveryDraft();notify('Setup cancelled. Your previous PIN and records are unchanged.');}
$('#recovery-close').addEventListener('click',cancelRecovery);$('#recovery-cancel').addEventListener('click',cancelRecovery);$('#save-recovery-dialog').addEventListener('cancel',e=>{e.preventDefault();cancelRecovery();});
$('#download-recovery').addEventListener('click',()=>{if(pendingRecovery)download(`FlowTrack recovery key\n\n${pendingRecovery.recoveryKey}\n\nKeep this key private and separate from this device. Anyone with it can reset your PIN and access the matching locked ledger. Older locked copies keep their own keys.\n`,`flowtrack-recovery-key-${today()}.txt`,'text/plain');});
$('#copy-recovery').addEventListener('click',async()=>{if(!pendingRecovery)return;try{await navigator.clipboard.writeText(pendingRecovery.recoveryKey);$('#recovery-save-error').textContent='Copied. Keep it somewhere private.';}catch{$('#generated-recovery').select();$('#recovery-save-error').textContent='Select and copy the key, or download it.';}});
$('#recovery-finish').addEventListener('click',()=>{
 if(saving||!pendingRecovery)return;if(!$('#recovery-saved').reportValidity())return;saving=true;
 try{data=vault.commitPrepared(pendingRecovery);clearRecoveryDraft();$('#reset-pin-form').reset();corrupt=false;storageUnavailable=false;render();showApp();notify('PIN saved. Your records are intact. Keep your recovery key safe.');void offerDeviceUnlock();}
 catch(err){$('#recovery-save-error').textContent=err.message;}
 finally{finishSaving();}
});
function closeResetPin(){if(saving)return;$('#reset-pin-dialog').close();$('#reset-pin-form').reset();}
$('#reset-pin-close').addEventListener('click',closeResetPin);$('#reset-pin-cancel').addEventListener('click',closeResetPin);$('#reset-pin-dialog').addEventListener('cancel',e=>{e.preventDefault();closeResetPin();});
$('#start-pin-reset').addEventListener('click',()=>{if(!vault.hasRecovery)return;$('#reset-pin-form').reset();$('#reset-pin-error').textContent='';$('#reset-pin-dialog').showModal();$('#reset-recovery-key').focus();});
$('#reset-pin-form').addEventListener('submit',async e=>{
 e.preventDefault();if(saving)return;$('#reset-pin-error').textContent='';if($('#reset-new-pin').value!==$('#reset-confirm-pin').value){$('#reset-pin-error').textContent='PINs do not match.';return;}saving=true;$('#reset-pin-submit').disabled=true;
 try{const draft=await vault.prepareSimpleReset($('#reset-recovery-key').value,$('#reset-new-pin').value);$('#reset-pin-dialog').close();$('#reset-pin-form').reset();data=vault.commitPrepared(draft);corrupt=false;render();showApp();notify('PIN recovered. Records kept.');}
 catch(err){$('#reset-pin-error').textContent=err.message;}
 finally{$('#reset-pin-submit').disabled=false;finishSaving();}
});

$('#download-locked').addEventListener('click',()=>{if(vault.raw)download(vault.raw,`flowtrack-locked-${today()}.json`,'application/json');});
$('#reset-locked').addEventListener('click',async()=>{
 if(await confirmAction('Reset this device?','This permanently erases the locked ledger and PIN. Save a locked copy first if you may remember the PIN later. You can restore a separate JSON backup after resetting.','Erase locked ledger',true)){
  try{vault.clear();load();render();showApp();notify('Device reset. Restore your JSON backup from Settings.');}catch(err){$('#unlock-error').textContent='Could not reset: '+err.message;}
 }
});

function cancelDeviceOperation(){deviceAbort?.abort();deviceAbort=null;$('#device-pin').value='';}
function closeDevice(){if(deviceBusy)cancelDeviceOperation();$('#device-dialog').close();$('#device-form').reset();}
function openDevice(){
 if(!vault.enabled||vault.locked||!deviceSupported||saving||demo)return;
 $('#device-form').reset();$('#device-error').textContent='';const ready=vault.canEnableDevice;
 $('#device-pin-group').hidden=ready;$('#device-pin').disabled=ready;$('#device-instruction').textContent=ready?'Confirm on your device.':'Enter your FlowTrack PIN.';
 $('#device-submit').hidden=ready;$('#device-dialog').showModal();if(ready)void enrollDevice();else $('#device-pin').focus();
}
$('#device-enable').addEventListener('click',openDevice);
$('#device-remove').addEventListener('click',()=>openPin('remove-device'));
$('#device-close').addEventListener('click',closeDevice);$('#device-cancel').addEventListener('click',closeDevice);$('#device-dialog').addEventListener('cancel',e=>{e.preventDefault();closeDevice();});
function dismissDeviceOffer(){try{localStorage.setItem('flowtrack.device-offer','seen');}catch{}$('#device-offer-dialog').close();}
async function offerDeviceUnlock(){if(!deviceSupported||vault.locked||!vault.enabled||vault.device||document.hidden||$('#setup-screen').hidden===false)return;try{if(localStorage.getItem('flowtrack.device-offer'))return;}catch{}$('#device-offer-dialog').showModal();}
$('#device-offer-later').addEventListener('click',dismissDeviceOffer);$('#device-offer-close').addEventListener('click',dismissDeviceOffer);$('#device-offer-dialog').addEventListener('cancel',e=>{e.preventDefault();dismissDeviceOffer();});$('#device-offer-start').addEventListener('click',()=>{dismissDeviceOffer();openDevice();});
async function enrollDevice(pin){
 if(deviceBusy||saving||vault.locked)return;deviceBusy=true;saving=true;$('#device-submit').disabled=true;$('#device-error').textContent='';deviceAbort=new AbortController();let device;
 try{if(pin)await vault.unlock(pin);device=await createDeviceUnlock({signal:deviceAbort.signal});if(deviceAbort.signal.aborted||lockRequested||document.hidden)throw new DOMException('Cancelled','AbortError');data=await vault.enableDeviceFromSession(device);$('#device-dialog').close();$('#device-form').reset();render();notify('Quick unlock on.');}
 catch(err){$('#device-error').textContent=deviceError(err);$('#device-instruction').textContent='Your PIN still works.';$('#device-submit').hidden=false;$('#device-submit').textContent='Try again';}
 finally{pin='';device?.secret?.fill(0);$('#device-pin').value='';deviceBusy=false;deviceAbort=null;$('#device-submit').disabled=false;finishSaving();securityStatus();}
}
$('#device-form').addEventListener('submit',e=>{e.preventDefault();void enrollDevice($('#device-pin').disabled?undefined:$('#device-pin').value);});

async function unlockDevice(){
 if(deviceBusy||!vault.locked||!vault.device)return;
 automaticDeviceUnlockPending=false;automaticDeviceUnlockCancelled=false;deviceBusy=true;const controller=new AbortController();deviceAbort=controller;$('#device-unlock').disabled=true;$('#device-unlock').textContent='Confirm on your device…';$('#device-unlock-error').textContent='';let secret;
 try{
  secret=await unlockWithDevice(vault.device,{signal:controller.signal});if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
  const opened=await vault.unlockDevice(secret);if(document.hidden){vault.lock();return;}data=opened;corrupt=false;render();showApp();$('#main').focus({preventScroll:true});
 }catch(err){automaticDeviceUnlockCancelled=true;$('#device-unlock-error').textContent=deviceError(err);$('#pin-entry').open=true;if(!document.hidden)$('#unlock-pin').focus();}
 finally{secret?.fill(0);deviceBusy=false;deviceAbort=null;$('#device-unlock').disabled=false;$('#device-unlock').textContent='Unlock with device';}
}
$('#device-unlock').addEventListener('click',()=>void unlockDevice());
function maybeAutomaticDeviceUnlock(){
 if(!automaticDeviceUnlockPending||!booted||!deviceSupported||!vault.locked||!vault.device||deviceBusy||document.hidden||!document.hasFocus()||$('dialog[open]')||$('#unlock-pin').value)return;
 void unlockDevice();
}
void deviceAvailable().then(available=>{deviceSupported=available;securityStatus();maybeAutomaticDeviceUnlock();});
window.addEventListener('focus',maybeAutomaticDeviceUnlock);
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(!deviceBusy&&!automaticDeviceUnlockCancelled)automaticDeviceUnlockPending=true;}else maybeAutomaticDeviceUnlock();});

const IDLE_MS=30*60*1000;
function checkIdle(){if(booted&&(pendingRecovery||(vault.enabled&&!vault.locked))&&Date.now()-lastActivity>=IDLE_MS){clearRecoveryDraft();if(vault.enabled)lockApp();}}
function activity(){checkIdle();lastActivity=Date.now();}
for(const event of ['pointerdown','keydown','touchstart','scroll'])document.addEventListener(event,activity,{passive:true,capture:true});
document.addEventListener('visibilitychange',checkIdle);window.addEventListener('pagehide',()=>{cancelDeviceOperation();clearRecoveryDraft();$('#pin-form').reset();$('#reset-pin-form').reset();if(vault.enabled)lockApp(false);});setInterval(checkIdle,1000);

load();icons();render();connection();booted=true;if(vault.locked)lockApp(false);else showApp();
if('serviceWorker' in navigator&&window.isSecureContext){
 navigator.serviceWorker.register('./sw.js').then(reg=>{
  const ready=()=>{$('#offline-status').textContent='Ready offline.';};
  if(reg.active)ready();else navigator.serviceWorker.ready.then(ready);
  function update(){if(reg.waiting&&navigator.serviceWorker.controller){$('#update-banner').hidden=false;$('#update-button').onclick=()=>{if(deviceBusy||$('#transaction-dialog').open||$('#pin-dialog').open||$('#save-recovery-dialog').open||$('#reset-pin-dialog').open||$('#device-dialog').open){notify('Save or close the transaction form before updating.');return;}if(storageUnavailable&&data.transactions.length){notify('Back up your session data before reloading to update.');return;}reg.waiting.postMessage('SKIP_WAITING');};}}
  update();reg.addEventListener('updatefound',()=>{reg.installing?.addEventListener('statechange',update);});let refreshing=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!refreshing&&navigator.serviceWorker.controller&&reg.waiting===null&&!$('#update-banner').hidden){refreshing=true;location.reload();}});
 }).catch(()=>{$('#offline-status').textContent='Offline app installation is unavailable. Your ledger can still be saved locally; download backups regularly.';});
}else $('#offline-status').textContent='Serve over HTTPS or localhost to enable offline app installation.';
