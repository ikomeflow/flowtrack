const $=s=>document.querySelector(s);
const date=value=>value?new Date(value).toLocaleString():'—';
export function initAccount(bridge){
 const {config}=bridge,dialog=$('#account-dialog');
 let user=null,entitlement=null,methods=[],payments=[],csrf='',busy=false,generation=0,recovery=null;
 const message=(text,error=false)=>{const target=$('#account-message');target.textContent=text;target.dataset.error=String(error);};
 function paint(){
  $('#account-offline').textContent=config.enabled?bridge.access().reason:'Account setup is in progress. The live release has not changed.';
  $('#account-auth').hidden=!!user||!config.enabled;$('#account-signed-in').hidden=!user;
  $('#account-email-label').textContent=user?.email||'';
  $('#account-link').hidden=!user||bridge.getOwner()===user.id;
  $('#account-link').disabled=busy||!bridge.canLink()||(!!bridge.getOwner()&&bridge.getOwner()!==user?.id);
  $('#account-status').textContent=!entitlement?'Sign in online to check your subscription.':entitlement.can_write?(Date.parse(entitlement.trial_ends_at)>Date.parse(entitlement.server_time)?'30-day free trial':'Subscription active'):'Subscription expired · view and export available';
  $('#account-trial').textContent=date(entitlement?.trial_ends_at);$('#account-renewal').textContent=date(entitlement?.paid_until);
  $('#account-days').textContent=entitlement?Math.max(0,Math.ceil((Date.parse(entitlement.trial_ends_at)-Date.parse(entitlement.server_time))/86400000))+' days left in your trial':'30 days from registration';
  $('#payment-section').hidden=!user;$('#admin-section').hidden=!entitlement?.is_admin;
  $('#admin-refresh').disabled=busy||!entitlement?.admin_verified;
  $('#admin-code-form').hidden=!!entitlement?.admin_verified;
  $('#payment-submit').disabled=busy||!methods.length||payments.some(p=>p.status==='pending')||!navigator.onLine;
  for(const button of $('#account-auth').querySelectorAll('button'))button.disabled=busy||!navigator.onLine;
 }
 async function action(fn){if(busy)return;busy=true;message('Working…');paint();try{await fn();}catch(error){message(error?.message||'Could not complete the request.',true);}finally{busy=false;paint();}}
 async function request(endpoint,input){
  if(!config.enabled)throw Error('The account service is not enabled yet.');
  if(!navigator.onLine)throw Error('Connect to the internet for account and payment actions.');
  if(input!==undefined&&!csrf)await refresh();
  const url=new URL(config.apiUrl);url.searchParams.set('action',endpoint);
  const response=await fetch(url,{method:input===undefined?'GET':'POST',credentials:'include',mode:'cors',cache:'no-store',redirect:'error',headers:input===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:input===undefined?undefined:JSON.stringify(input),signal:AbortSignal.timeout(15000)});
  const result=await response.json();
  if(!response.ok){if(response.status===401||response.status===419){++generation;user=null;entitlement=null;csrf='';bridge.setUser(null);bridge.revoke();paint();}throw Error(result.error||'Account request failed.');}
  return result;
 }
 function paymentDetails(){
  const method=methods.find(m=>m.id===$('#payment-method').value);
  $('#payment-instructions').textContent=method?`Send ${method.amount} ${method.currency} to ${method.recipient_number} — ${method.recipient_name}, ${method.provider}, ${method.country}. This is the approved local price for $1/month. Pay once, then submit the exact transaction reference. Never share your Mobile Money PIN or OTP.`:'Payments are not available yet. Do not send money until a receiving account is shown here.';
 }
 function history(){
  const target=$('#payment-history');target.replaceChildren();
  if(!payments.length){target.textContent='No payments submitted.';return;}
  for(const p of payments){const row=document.createElement('li');row.textContent=`${p.amount} ${p.currency} · ${p.reference} · ${p.status} · ${date(p.submitted_at)}${p.review_note?' · '+p.review_note:''}${p.access_until?' · Access until '+date(p.access_until):''}`;target.append(row);}
 }
 async function accept(result,current){
  if(current!==generation)return;
  if(!result.entitlement?.is_admin)$('#admin-queue').replaceChildren();
  csrf=result.csrf;user=result.user;bridge.setUser(user);entitlement=result.entitlement;methods=result.methods;payments=result.payments;
  if(user)await bridge.accept(result);
  if(current!==generation)return;
  $('#payment-method').replaceChildren();for(const method of methods){const option=document.createElement('option');option.value=method.id;option.textContent=method.provider+' · '+method.amount+' '+method.currency;$('#payment-method').append(option);}
  paymentDetails();history();paint();
 }
 async function refresh(){
  if(!config.enabled||!navigator.onLine){paint();return;}
  const current=++generation;await accept(await request('session'),current);
 }
 $('#account-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{$('#account-password').value='';$('#account-admin-code').value='';$('#account-new-password').value='';message('');});
 $('#account-auth').addEventListener('submit',event=>{event.preventDefault();void action(async()=>{
  const signup=event.submitter?.value==='signup';const result=await request(signup?'register':'login',{email:$('#account-email').value.trim(),password:$('#account-password').value});$('#account-password').value='';
  if(signup)message(result.message);else{await accept(result,++generation);message(bridge.getOwner()===user?.id?(entitlement?.can_write?'Signed in. Your subscription is up to date.':'Signed in. Renew to resume editing; viewing and exports remain available.'):'Signed in. Unlock your local PIN and link this device to enable editing.');}
 });});
 for(const [id,endpoint] of [['account-forgot','forgot'],['account-resend','resend']])$('#'+id).addEventListener('click',()=>void action(async()=>{const email=$('#account-email').value.trim();if(!email)throw Error('Enter your email first.');message((await request(endpoint,{email})).message);}));
 $('#account-verify').addEventListener('click',()=>void action(async()=>{message((await request('verify',{token:recovery?.token})).message);recovery=null;$('#account-verify').hidden=true;}));
 $('#account-reset-form').addEventListener('submit',event=>{event.preventDefault();void action(async()=>{
  const result=await request('reset',{token:recovery?.token,password:$('#account-new-password').value});recovery=null;$('#account-new-password').value='';$('#account-reset-form').hidden=true;user=null;entitlement=null;csrf='';bridge.setUser(null);bridge.revoke();message(result.message);
 });});
 $('#account-signout').addEventListener('click',()=>void action(async()=>{
  await request('logout',{});++generation;user=null;entitlement=null;payments=[];methods=[];csrf='';bridge.setUser(null);bridge.revoke();history();message('Signed out on this device. Records remain accessible with your ledger PIN.');
 }));
 $('#account-link').addEventListener('click',()=>void action(async()=>{
  if(!await bridge.confirm('Link this device?','Link this browser’s existing ledger to '+user.email+' for subscription access? Records stay on this device and the PIN is unchanged. This link cannot be switched to another account in the app.','Link device'))return;
  await bridge.link();await refresh();message('Device linked. Financial records stay in this browser.');
 }));
 $('#account-refresh').addEventListener('click',()=>void action(refresh));
 $('#payment-method').addEventListener('change',paymentDetails);
 $('#payment-form').addEventListener('submit',event=>{event.preventDefault();void action(async()=>{
  const result=await request('payment',{method:$('#payment-method').value,reference:$('#payment-reference').value,sender:$('#payment-sender').value});$('#payment-reference').value='';await refresh();message(result.message+' Access changes only after approval.');
 });});
 $('#admin-send-code').addEventListener('click',()=>void action(async()=>message((await request('admin-code',{})).message)));
 $('#admin-code-form').addEventListener('submit',event=>{event.preventDefault();void action(async()=>{const result=await request('admin-verify',{code:$('#account-admin-code').value});$('#account-admin-code').value='';await refresh();message(result.message);} );});
 $('#admin-refresh').addEventListener('click',()=>void action(async()=>{
  const {payments:queue}=await request('admin-pending',{});const target=$('#admin-queue');target.replaceChildren();
  if(!queue.length)target.textContent='No payments awaiting verification.';
  for(const payment of queue){
   const row=document.createElement('article'),description=document.createElement('p'),note=document.createElement('input');
   description.textContent=`${payment.amount} ${payment.currency} · ${payment.provider} · ${payment.reference} · From ${payment.sender_number} · ${date(payment.submitted_at)} · ${payment.email}`;
   note.placeholder='Verification or rejection note';note.maxLength=500;note.setAttribute('aria-label','Review note for '+payment.reference);row.append(description,note);
   for(const approve of [true,false]){const button=document.createElement('button');button.className='button secondary';button.textContent=approve?'Verify & approve':'Reject';button.addEventListener('click',()=>void action(async()=>{
    if(note.value.trim().length<3)throw Error('Add a verification or rejection note.');
    if(!await bridge.confirm(approve?'Approve verified payment?':'Reject payment?',(approve?'I checked the MTN statement and confirmed the correct recipient, amount, reference and sender for ':'Reject payment ')+payment.reference+'?',approve?'Approve payment':'Reject payment'))return;
    const result=await request('admin-review',{id:payment.id,approve,note:note.value});row.remove();await refresh();message(result.message);
   }));row.append(button);}target.append(row);
  }
 }));
 function recoveryLink(){
  const match=location.hash.match(/^#account-(verify|reset)=([a-f0-9]{64})$/);
  if(match){recovery={action:match[1],token:match[2]};window.history.replaceState(null,'',location.pathname+location.search+'#overview');$('#account-verify').hidden=match[1]!=='verify';$('#account-reset-form').hidden=match[1]!=='reset';setTimeout(()=>{if(!dialog.open)dialog.showModal();},0);}
 }
 window.addEventListener('hashchange',recoveryLink);recoveryLink();
 paint();
 return {open(){paint();if(!dialog.open)dialog.showModal();void refresh().catch(error=>message(error.message,true));},refresh};
}
