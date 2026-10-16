import { STORAGE_KEY,CURRENCIES,today,parseAmount,validateTransaction,validateState,emptyState,totals,filterTransactions,money,shiftMonth,csvExport } from './core.mjs';
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',arrows:'M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4',calendar:'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',shield:'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7z M8 12l3 3 5-6',plus:'M12 5v14M5 12h14',left:'m14 6-6 6 6 6',right:'m10 6 6 6-6 6',down:'M17 7 7 17M7 7v10h10',up:'M7 17 17 7M7 7h10v10',wallet:'M3 6h16v14H3zM3 6V3h13v3M15 11h6v5h-6z',help:'M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',pie:'M11 3v10h10A10 10 0 1 1 11 3zM15 2v7h7a9 9 0 0 0-7-7',search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14M15 15l6 6',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',close:'m6 6 12 12M18 6 6 18',edit:'m15 4 5 5M4 20l4-1L21 6l-4-4L4 15z',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7'};
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.wallet}"/></svg>`;
function icons(){ $$('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);}); }
let data=emptyState(),demo=null,corrupt=false,storageUnavailable=false,recoveryRaw='',month=today().slice(0,7),selectedDate=today(),editingId=null,toastTimer,installPrompt,confirmResolve;
const state=()=>demo||data;
const fmt=n=>money(n,state().currency);
function notify(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4500);}
function load(){
  corrupt=false;storageUnavailable=false;recoveryRaw='';
  try{const raw=localStorage.getItem(STORAGE_KEY);if(raw!==null){try{data=validateState(JSON.parse(raw));}catch{corrupt=true;recoveryRaw=raw;data=emptyState();}}else data=emptyState();
    const test='flowtrack.storage-check';localStorage.setItem(test,'1');localStorage.removeItem(test);
  }catch{storageUnavailable=true;}
  updateStorageNotice();
}
function updateStorageNotice(){
 const alert=$('#storage-alert');alert.hidden=!corrupt&&!storageUnavailable;
 alert.textContent=corrupt?'Your saved ledger could not be read. It has been preserved. New entries are blocked to protect it. In Settings, download the original data, then restore a valid backup or clear it deliberately.':storageUnavailable?'Browser storage is unavailable. Changes will only last for this open session. Download a JSON backup before closing this page.':'';
 $('#recovery-button').hidden=!corrupt;$('#add-button').disabled=corrupt&&!demo;
}
function commit(next){
 try{next=validateState(next);if(demo){demo=next;render();return true;}if(corrupt)throw Error('Saved data is unreadable. Recover it from Settings before making changes.');
   if(!storageUnavailable){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next));}catch{throw Error('Could not save: browser storage is full or blocked. Your change was not applied. Back up your current ledger from Settings.');}}
   data=next;render();return true;
 }catch(e){notify(e.message);return false;}
}
function confirmAction(title,message,label='Continue',danger=false){
 $('#confirm-title').textContent=title;$('#confirm-message').textContent=message;$('#confirm-ok').textContent=label;$('#confirm-ok').className=`button ${danger?'danger':'primary'}`;
 $('#confirm-dialog').showModal();$('#confirm-cancel').focus();return new Promise(resolve=>confirmResolve=resolve);
}
function finishConfirm(value){$('#confirm-dialog').close();confirmResolve?.(value);confirmResolve=null;}
$('#confirm-ok').addEventListener('click',()=>finishConfirm(true));$('#confirm-cancel').addEventListener('click',()=>finishConfirm(false));$('#confirm-close').addEventListener('click',()=>finishConfirm(false));$('#confirm-dialog').addEventListener('cancel',e=>{e.preventDefault();finishConfirm(false);});
function dateLabel(date,opts={day:'numeric',month:'short'}){return new Date(date+'T12:00:00').toLocaleDateString(undefined,opts);}
function monthLabel(m,opts={month:'short'}){return dateLabel(m+'-01',opts);}
function empty(title,message,add=false){return `<div class="empty"><span class="empty-icon">${icon('arrows')}</span><h3>${escape(title)}</h3><p>${escape(message)}</p>${add?'<button class="button primary" data-add>Add your first transaction</button>':''}</div>`;}
function table(rows,emptyText='No transactions yet',add=false){
 if(!rows.length)return empty(emptyText,add?'Start with something you earned or spent. Your progress begins with one entry.':'Try another date or change your filters.',add);
 return `<div class="table-wrap"><table><thead><tr><th scope="col">Transaction</th><th class="date-cell" scope="col">Date</th><th class="tag-column" scope="col">Tags</th><th scope="col" class="amount-cell">Amount</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows.map(t=>`<tr><td><div class="description-cell"><span class="transaction-icon ${t.type}">${icon(t.type==='income'?'down':'up')}</span><div><div class="transaction-description">${escape(t.description)}</div><span class="mobile-date">${escape(dateLabel(t.date))} · ${t.type==='income'?'Income':'Expense'}</span></div></div></td><td class="date-cell">${escape(dateLabel(t.date))}</td><td class="tag-column">${t.tags.length?t.tags.map(x=>`<span class="tag">${escape(x)}</span>`).join(''):'<span class="muted">—</span>'}</td><td class="amount-cell ${t.type==='income'?'positive':''}"><span class="sr-only">${t.type} </span>${t.type==='income'?'+':'−'}${escape(fmt(t.amount))}</td><td class="actions-cell"><button class="icon-button" data-edit="${escape(t.id)}" aria-label="Edit ${escape(t.description)}">${icon('edit')}</button><button class="icon-button" data-delete="${escape(t.id)}" aria-label="Delete ${escape(t.description)}">${icon('trash')}</button></td></tr>`).join('')}</tbody></table></div>`;
}
function overview(){
 const rows=filterTransactions(state().transactions,{month}),sum=totals(rows);
 $('#net-value').textContent=fmt(sum.net);$('#income-value').textContent=fmt(sum.income);$('#expense-value').textContent=fmt(sum.expense);
 $('#net-caption').textContent=!rows.length?'A fresh month. A clear starting point.':sum.net>=0?'You brought in more than you spent.':'Your spending exceeded your income.';
 for(const type of ['income','expense']){const n=rows.filter(t=>t.type===type).length;$(`#${type}-caption`).textContent=`${n} ${type==='income'?'income':'expense'} ${n===1?'entry':'entries'} this month`;}
 $('#recent-list').innerHTML=table(rows.slice(0,5),'A fresh start for your finances',!rows.length);
 const history=Array.from({length:6},(_,i)=>{const m=shiftMonth(month,i-5);return {month:m,...totals(filterTransactions(state().transactions,{month:m}))};});
 const max=Math.max(...history.flatMap(x=>[x.income,x.expense]),10000);
 const short=n=>new Intl.NumberFormat(undefined,{notation:'compact',maximumFractionDigits:1}).format(n/100);
 $('#cash-chart').innerHTML=`<div class="chart-grid"><div class="chart-y">${[1,.75,.5,.25,0].map(n=>`<span>${short(max*n)}</span>`).join('')}</div><div class="bars" role="img" aria-label="${escape(history.map(x=>`${monthLabel(x.month,{month:'long',year:'numeric'})}: income ${fmt(x.income)}, expenses ${fmt(x.expense)}`).join('. '))}">${history.map(x=>`<div class="bar-group" title="${escape(monthLabel(x.month,{month:'long',year:'numeric'})+': income '+fmt(x.income)+', expenses '+fmt(x.expense))}"><div class="bar" style="height:${x.income/max*100}%"></div><div class="bar expense-bar" style="height:${x.expense/max*100}%"></div><span class="bar-label">${escape(monthLabel(x.month))}</span></div>`).join('')}</div></div><div class="chart-foot"><span>${escape(state().currency)} · Last 6 months</span><span>${rows.length?'A little perspective goes a long way.':'Your story will grow here.'}</span></div>`;
 const categories=new Map();for(const t of rows.filter(x=>x.type==='expense')){const tag=t.tags[0]||'Untagged';categories.set(tag,(categories.get(tag)||0)+t.amount);}
 let tags=[...categories].sort((a,b)=>b[1]-a[1]);if(tags.length>4)tags=[...tags.slice(0,3),['Other tags',tags.slice(3).reduce((a,t)=>a+t[1],0)]];
 $('#spending-chart').innerHTML=tags.length?`<div class="spending-body"><div class="spending-total"><strong>${escape(fmt(sum.expense))}</strong><span>${categories.size} ${categories.size===1?'category':'categories'}</span></div>${tags.map(([tag,amount])=>`<div class="tag-row"><div class="tag-label"><span>${escape(tag)}</span><b>${escape(fmt(amount))} · ${Math.round(amount/sum.expense*100)}%</b></div><div class="tag-track"><div class="tag-fill" style="width:${amount/sum.expense*100}%"></div></div></div>`).join('')}</div>`:`<div class="empty empty-spending"><span class="empty-icon">${icon('pie')}</span><h3>A clearer picture of your spending</h3><p>Add expenses with tags to see where your money goes.</p></div>`;
}
function filtered(){return filterTransactions(state().transactions,{month:$('#period-filter').value==='month'?month:'',query:$('#search').value,type:$('#type-filter').value});}
function history(){const rows=filtered();$('#result-count').textContent=`${rows.length} ${rows.length===1?'transaction':'transactions'} · Net ${fmt(totals(rows).net)}`;$('#transaction-list').innerHTML=table(rows,'No matching transactions');$('#history-month').disabled=$('#period-filter').value==='all';}
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
 $('#currency').value=state().currency;$('#demo-banner').hidden=!demo;$('#demo-button').hidden=!!demo;updateStorageNotice();overview();history();calendar();route(false);
}
function setMonth(value){if(!/^\d{4}-\d{2}$/.test(value)||value<'1900-01'||value>'9999-12')return;month=value;if(!selectedDate.startsWith(month))selectedDate=month===today().slice(0,7)?today():month+'-01';render();}
for(const id of ['overview-month','history-month','calendar-month'])$('#'+id).addEventListener('change',e=>setMonth(e.target.value));
$$('.prev-month').forEach(b=>b.addEventListener('click',()=>setMonth(shiftMonth(month,-1))));$$('.next-month').forEach(b=>b.addEventListener('click',()=>setMonth(shiftMonth(month,1))));
const views={overview:['Your money, in view.','Small steps today. More freedom tomorrow.'],transactions:['Every entry. One place.','Keep track of what comes in and what goes out.'],calendar:['One day at a time.','Your progress, through the days and months.'],settings:['A space that’s yours.','Your preferences, your backups, your peace of mind.']};
function route(focus=true){const view=Object.hasOwn(views,location.hash.slice(1))?location.hash.slice(1):'overview';$$('.view').forEach(v=>v.hidden=v.id!==view+'-view');$$('nav a').forEach(a=>{a.classList.toggle('active',a.dataset.view===view);if(a.dataset.view===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});$('#page-title').textContent=views[view][0];$('#page-subtitle').textContent=views[view][1];$('#breadcrumb').innerHTML=`My workspace <span>/</span> ${view[0].toUpperCase()+view.slice(1)}`;$('#add-button').hidden=view==='settings';if(focus)$('#main').focus({preventScroll:true});}
window.addEventListener('hashchange',()=>route());
$('#help-button').addEventListener('click',()=>{location.hash='settings';});
function openTransaction(id=null,date=null){
 if(corrupt&&!demo){notify('Recover your saved data from Settings first.');return;}
 const t=id?state().transactions.find(x=>x.id===id):null;editingId=t?.id||null;$('#transaction-form').reset();$('#transaction-title').textContent=t?'Edit transaction':'Add transaction';$('#save-button').textContent=t?'Save changes':'Save transaction';$('#description').value=t?.description||'';$('#amount').value=t?(t.amount/100).toFixed(2):'';$('#date').value=t?.date||date||(month===today().slice(0,7)?today():month+'-01');$('#tags').value=t?.tags.join(', ')||'';$('#amount-currency').textContent=state().currency;$('#form-error').textContent='';$(`input[name=type][value=${t?.type||'expense'}]`).checked=true;$('#transaction-dialog').showModal();$('#description').focus();
}
$('#add-button').addEventListener('click',()=>openTransaction());$('#add-day').addEventListener('click',()=>openTransaction(null,selectedDate));$$('.close-transaction').forEach(b=>b.addEventListener('click',()=>$('#transaction-dialog').close()));
$('#transaction-form').addEventListener('submit',e=>{
 e.preventDefault();try{const t=validateTransaction({id:editingId||crypto.randomUUID(),description:$('#description').value.trim(),amount:parseAmount($('#amount').value),date:$('#date').value,type:$('input[name=type]:checked').value,tags:$('#tags').value.split(',').map(s=>s.trim()).filter(Boolean)});
 const tx=state().transactions.filter(x=>x.id!==t.id);tx.push(t);if(commit({...state(),transactions:tx})){setMonth(t.date.slice(0,7));selectedDate=t.date;calendar();$('#transaction-dialog').close();notify(demo?'Demo transaction saved.':storageUnavailable?'Saved for this session only. Back up before closing.':'Transaction saved on this device.');}}
 catch(err){$('#form-error').textContent=err.message;}
});
document.addEventListener('click',async e=>{
 const add=e.target.closest('[data-add]');if(add)openTransaction();
 const edit=e.target.closest('[data-edit]');if(edit)openTransaction(edit.dataset.edit);
 const del=e.target.closest('[data-delete]');if(del){const t=state().transactions.find(x=>x.id===del.dataset.delete);if(t&&await confirmAction('Delete transaction?',`“${t.description}” (${fmt(t.amount)}) will be removed from this ledger. This cannot be undone.`,'Delete transaction',true)){if(commit({...state(),transactions:state().transactions.filter(x=>x.id!==t.id)}))notify('Transaction deleted.');}}
 const day=e.target.closest('[data-date]');if(day){selectedDate=day.dataset.date;calendar();$(`[data-date="${selectedDate}"]`)?.focus();}
});
$('#search').addEventListener('input',history);$('#type-filter').addEventListener('change',history);$('#period-filter').addEventListener('change',history);
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportCSV(rows){download(csvExport(rows,state().currency),`flowtrack${demo?'-demo':''}-${today()}.csv`,'text/csv;charset=utf-8');notify(`Exported ${rows.length} transactions. Keep this file private.`);}
$('#export-all').addEventListener('click',()=>exportCSV(state().transactions));$('#export-filtered').addEventListener('click',()=>exportCSV(filtered()));
$('#backup-button').addEventListener('click',()=>{if(corrupt&&!demo){notify('Download the unreadable original using the recovery link first.');return;}download(JSON.stringify(state(),null,2),`flowtrack${demo?'-demo':''}-backup-${today()}.json`,'application/json');notify('Backup downloaded. Keep it somewhere safe and private.');});
$('#recovery-button').addEventListener('click',()=>download(recoveryRaw,`flowtrack-recovery-${today()}.txt`,'text/plain'));
$('#restore-button').addEventListener('click',()=>$('#restore-file').click());
$('#restore-file').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{if(f.size>20*1024*1024)throw Error('Backup is too large (20 MB maximum).');const incoming=validateState(JSON.parse(await f.text()));if(await confirmAction('Replace this ledger?',`Restore ${incoming.transactions.length} transactions in ${incoming.currency}? This replaces ${demo?'the demo ledger':'all current records in this browser'}. Export a backup first if you need to keep them.`,'Restore backup')){if(demo){demo=incoming;render();notify('Backup loaded into demo mode only.');return;}try{localStorage.setItem(STORAGE_KEY,JSON.stringify(incoming));}catch{throw Error('Could not store the backup. Your original ledger has not been replaced.');}data=incoming;corrupt=false;storageUnavailable=false;recoveryRaw='';render();notify('Backup restored on this device.');}}catch(err){notify('Restore failed: '+err.message);}});
$('#clear-button').addEventListener('click',async()=>{if(await confirmAction('Clear all data?',`Permanently erase ${demo?'the demo ledger':'this browser’s ledger and currency setting'}? Download a JSON backup first. This cannot be undone.`,'Clear all data',true)){if(demo){demo=emptyState();render();notify('Demo ledger cleared.');return;}try{localStorage.removeItem(STORAGE_KEY);data=emptyState();corrupt=false;recoveryRaw='';render();notify('All local records cleared.');}catch{notify('Could not clear browser storage.');}}});
$('#currency').innerHTML=Object.entries(CURRENCIES).map(([code,name])=>`<option value="${code}">${code} — ${name}</option>`).join('');
$('#currency').addEventListener('change',async e=>{const next=e.target.value,previous=state().currency;e.target.value=previous;if(next===previous)return;if(state().transactions.length&&!await confirmAction('Change display currency?',`All existing ${previous} amounts will be relabeled as ${next}, with no exchange-rate conversion. For example, 1,000 ${previous} becomes 1,000 ${next}. Only continue if your ledger uses this currency.`,'Change currency'))return;if(commit({...state(),currency:next}))notify(`Display currency changed to ${next}. No conversion applied.`);});
$('#demo-button').addEventListener('click',()=>{
 const templates=[['Freelance design','income',180000,'Work',2],['Groceries','expense',24500,'Food',4],['Monthly salary','income',320000,'Salary',5],['Ride to work','expense',3500,'Transport',8],['Weekend lunch','expense',8500,'Food',12],['Mobile data','expense',6000,'Essentials',14],['Online course','expense',15000,'Learning',16],['Side project','income',45000,'Work',20],['Weekly shopping','expense',18500,'Food',22]];
 demo={version:1,currency:'XAF',transactions:[]};for(let i=-5;i<=0;i++){const m=shiftMonth(month,i);templates.forEach(([description,type,amount,tag,day],j)=>demo.transactions.push({id:`demo-${i}-${j}`,description,type,amount:Math.round(amount*(1+(i+5)*.06))*100,date:`${m}-${String(day).padStart(2,'0')}`,tags:[tag]}));}render();notify('Exploring sample data. Your saved records are untouched.');
});
$('#exit-demo').addEventListener('click',()=>{demo=null;render();notify('Back to your own ledger.');});
window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY||e.key===null){load();$('#transaction-dialog').close();render();notify('Ledger updated from another tab.');}});
function connection(){ $('#connection').innerHTML=`<span></span>${navigator.onLine?'On this device':'You’re offline'}`; }
window.addEventListener('online',connection);window.addEventListener('offline',connection);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('#install-button').hidden=false;});
$('#install-button').addEventListener('click',async()=>{if(!installPrompt)return;await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('#install-button').hidden=true;});
window.addEventListener('appinstalled',()=>{$('#install-button').hidden=true;notify('FlowTrack installed. Your records remain on this device.');});
load();icons();render();connection();
if('serviceWorker' in navigator&&window.isSecureContext){
 navigator.serviceWorker.register('./sw.js').then(reg=>{
  const ready=()=>{$('#offline-status').textContent='Offline app files are ready on this device.';};
  if(reg.active)ready();else navigator.serviceWorker.ready.then(ready);
  function update(){if(reg.waiting&&navigator.serviceWorker.controller){$('#update-banner').hidden=false;$('#update-button').onclick=()=>{if($('#transaction-dialog').open){notify('Save or close the transaction form before updating.');return;}if(storageUnavailable&&data.transactions.length){notify('Back up your session data before reloading to update.');return;}reg.waiting.postMessage('SKIP_WAITING');};}}
  update();reg.addEventListener('updatefound',()=>{reg.installing?.addEventListener('statechange',update);});let refreshing=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!refreshing&&navigator.serviceWorker.controller&&reg.waiting===null&&!$('#update-banner').hidden){refreshing=true;location.reload();}});
 }).catch(()=>{$('#offline-status').textContent='Offline app installation is unavailable. Your ledger can still be saved locally; download backups regularly.';});
}else $('#offline-status').textContent='Serve over HTTPS or localhost to enable offline app installation.';
