(()=>{
  const $=id=>document.getElementById('fta-'+id);
  const labels={app_open:'App opened',page_view:'Screen viewed',transaction_created:'Transaction created',transaction_updated:'Transaction updated',transaction_deleted:'Transaction deleted',backup_exported:'Backup exported',pdf_exported:'PDF exported',backup_restored:'Backup restored',setup_started:'Empty-ledger setup started',pin_setup_completed:'PIN setup completed',first_transaction:'First transaction saved',app_error:'Safe error reported'};
  const errorLabels={save_failed:'Save failed',pdf_export_failed:'PDF export failed',restore_failed:'Backup restore failed',startup_failed:'App loading failed',offline_setup_failed:'Offline download incomplete'};
  let busy=false;
  const count=value=>Number(value||0).toLocaleString();
  function cell(row,value){const td=document.createElement('td');td.textContent=value;row.append(td);return td;}
  function table(id,rows,values,empty){$(id).replaceChildren();for(const value of rows){const tr=document.createElement('tr');for(const text of values(value))cell(tr,text);$(id).append(tr);}if(!rows.length){const tr=document.createElement('tr'),td=cell(tr,empty);td.colSpan=3;$(id).append(tr);}}
  function insights(data){
    $('new').textContent=count(data.returning.new_browsers);$('returning').textContent=count(data.returning.returning_browsers);$('error-total').textContent=count(data.summary.errors);
    const r=data.retention;$('retention').textContent=r.rate===null?'Collecting data':r.rate+'%';$('retention').classList.toggle('fta-pending',r.rate===null);
    $('retention-note').textContent=r.rate===null?'A full 7-day follow-up window is needed.':count(r.returned)+' of '+count(r.cohort)+' browsers returned within 7 days';
    const f=data.funnel;$('funnel').replaceChildren();
    for(const [label,value] of [['Setup started',f.started],['PIN created',f.pin],['First transaction saved',f.first_transaction]]){const li=document.createElement('li'),name=document.createElement('span'),number=document.createElement('strong');name.textContent=label;number.textContent=count(value);li.append(name,number);$('funnel').append(li);}
    $('funnel-note').textContent=Number(f.started)?Math.round(100*Number(f.first_transaction)/Number(f.started))+'% of observed setup starts reached a first saved transaction.':'No first-use setup steps observed in this period. Existing ledgers are excluded.';
    table('errors',data.errors,e=>[errorLabels[e.code]||'App error',count(e.count),count(e.browsers)],'No errors received in this period.');
    const devices={mobile:'Mobile',tablet:'Tablet',desktop:'Desktop',unknown:'Unknown'},modes={installed:'Installed app',browser:'Web browser',unknown:'Older app copy'};
    table('devices',data.devices,d=>[devices[d.device]||'Unknown',modes[d.mode]||'Unknown',count(d.browsers)],'No device categories received yet.');
    table('versions',data.versions,v=>[v.version==='legacy'?'Older app copy':v.version,count(v.browsers)],'No version data received yet.');
    const screens={overview:'Home',transactions:'History',calendar:'Calendar',settings:'Settings'};
    table('screens',data.screens,s=>[screens[s.screen]||'App screen',count(s.count),count(s.browsers)],'No workspace screens observed yet.');
  }
  async function refresh(){
    if(busy||document.hidden)return;busy=true;$('refresh').disabled=true;$('status').textContent='Updating…';
    try{
      const url=new URL(FlowTrackDashboard.url);url.searchParams.set('action','flowtrack_analytics_stats');url.searchParams.set('nonce',FlowTrackDashboard.nonce);url.searchParams.set('days',$('days').value);
      const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
      const body=await response.json();if(!response.ok||!body.success)throw Error('Could not load analytics. Refresh this page to renew your sign-in.');
      const data=body.data,s=data.summary;for(const key of ['active','live','sessions','actions'])$(key).textContent=count(s[key]);insights(data);
      $('empty').hidden=!!s.last_event;$('timezone').textContent='Daily boundaries: '+data.timezone+'. Anonymous browsers, not account totals.';
      $('daily').replaceChildren();$('events').replaceChildren();
      const max=Math.max(1,...data.daily.map(d=>Number(d.active))),byDay=new Map(data.daily.map(d=>[d.day,d]));
      const end=new Date(data.today+'T12:00:00Z');
      for(let i=data.days-1;i>=0;i--){const date=new Date(end);date.setUTCDate(date.getUTCDate()-i);const day=date.toISOString().slice(0,10),d=byDay.get(day)||{active:0,sessions:0},tr=document.createElement('tr');cell(tr,day);cell(tr,count(d.active));cell(tr,count(d.sessions));const td=cell(tr,'');const bar=document.createElement('span');bar.className='fta-bar';bar.style.width=(Number(d.active)/max*100)+'%';bar.setAttribute('aria-hidden','true');td.append(bar);$('daily').append(tr);}
      for(const e of data.events){const tr=document.createElement('tr');cell(tr,labels[e.event]||'App activity');cell(tr,count(e.count));cell(tr,count(e.browsers));$('events').append(tr);}
      if(!data.events.length){const tr=document.createElement('tr');cell(tr,'No events yet');cell(tr,'0');cell(tr,'0');$('events').append(tr);}
      $('last').textContent=s.last_event?'Latest received event: '+new Date(s.last_event.replace(' ','T')+'Z').toLocaleString(): 'Waiting for the first participating visitor.';
      $('status').textContent='Updated '+new Date(data.updated).toLocaleTimeString()+' · refreshes every minute';
    }catch(error){$('status').textContent=error.message||'Analytics could not load. Try Refresh.';}
    finally{busy=false;$('refresh').disabled=false;}
  }
  $('refresh').addEventListener('click',refresh);$('days').addEventListener('change',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});setInterval(refresh,60000);refresh();
})();
