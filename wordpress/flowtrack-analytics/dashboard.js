(()=>{
  const $=id=>document.getElementById('fta-'+id);
  const labels={app_open:'App opened',page_view:'Screen viewed',transaction_created:'Transaction created',transaction_updated:'Transaction updated',transaction_deleted:'Transaction deleted',backup_exported:'Backup exported',pdf_exported:'PDF exported',backup_restored:'Backup restored'};
  let busy=false;
  const count=value=>Number(value||0).toLocaleString();
  function cell(row,value){const td=document.createElement('td');td.textContent=value;row.append(td);return td;}
  async function refresh(){
    if(busy||document.hidden)return;busy=true;$('refresh').disabled=true;$('status').textContent='Updating…';
    try{
      const url=new URL(FlowTrackDashboard.url);url.searchParams.set('action','flowtrack_analytics_stats');url.searchParams.set('nonce',FlowTrackDashboard.nonce);url.searchParams.set('days',$('days').value);
      const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
      const body=await response.json();if(!response.ok||!body.success)throw Error('Could not load analytics. Refresh this page to renew your sign-in.');
      const data=body.data,s=data.summary;for(const key of ['active','live','sessions','actions'])$(key).textContent=count(s[key]);
      $('empty').hidden=!!s.last_event;$('timezone').textContent='Daily boundaries: '+data.timezone+'. Anonymous browsers, not account totals.';
      $('daily').replaceChildren();$('events').replaceChildren();
      const max=Math.max(1,...data.daily.map(d=>Number(d.active))),byDay=new Map(data.daily.map(d=>[d.day,d]));
      const end=new Date(data.today+'T12:00:00Z');
      for(let i=data.days-1;i>=0;i--){const date=new Date(end);date.setUTCDate(date.getUTCDate()-i);const day=date.toISOString().slice(0,10),d=byDay.get(day)||{active:0,sessions:0},tr=document.createElement('tr');cell(tr,day);cell(tr,count(d.active));cell(tr,count(d.sessions));const td=cell(tr,'');const bar=document.createElement('span');bar.className='fta-bar';bar.style.width=(Number(d.active)/max*100)+'%';bar.setAttribute('aria-hidden','true');td.append(bar);$('daily').append(tr);}
      for(const e of data.events){const tr=document.createElement('tr');cell(tr,labels[e.event]||'App activity');cell(tr,count(e.count));$('events').append(tr);}
      if(!data.events.length){const tr=document.createElement('tr');cell(tr,'No events yet');cell(tr,'0');$('events').append(tr);}
      $('last').textContent=s.last_event?'Latest received event: '+new Date(s.last_event.replace(' ','T')+'Z').toLocaleString(): 'Waiting for the first participating visitor.';
      $('status').textContent='Updated '+new Date(data.updated).toLocaleTimeString()+' · refreshes every minute';
    }catch(error){$('status').textContent=error.message||'Analytics could not load. Try Refresh.';}
    finally{busy=false;$('refresh').disabled=false;}
  }
  $('refresh').addEventListener('click',refresh);$('days').addEventListener('change',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});setInterval(refresh,60000);refresh();
})();
