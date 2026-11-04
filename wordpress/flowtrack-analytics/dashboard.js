(()=>{
  const $=id=>document.getElementById('fta-'+id);
  const labels={app_open:'App opened',page_view:'Screen viewed',transaction_created:'Transaction created',transaction_updated:'Transaction updated',transaction_deleted:'Transaction deleted',backup_exported:'Backup exported',pdf_exported:'PDF exported',backup_restored:'Backup restored',setup_started:'Setup started',pin_setup_completed:'PIN created',first_transaction:'First transaction saved',app_error:'Error reported'};
  const errorLabels={save_failed:'Save failed',pdf_export_failed:'PDF export failed',restore_failed:'Backup restore failed',startup_failed:'App loading failed',offline_setup_failed:'Offline download incomplete'};
  const count=value=>Number(value||0).toLocaleString();
  const total=rows=>rows.reduce((sum,row)=>sum+Number(row.count||0),0);
  const shortDate=day=>new Date(day+'T12:00:00Z').toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:'UTC'});
  let busy=false,pending=false,lastUpdated=null;
  function cell(row,value){const td=document.createElement('td');td.textContent=value;row.append(td);return td;}
  function table(id,rows,values,empty,columns=3){
    const body=$(id);body.replaceChildren();
    for(const value of rows){const tr=document.createElement('tr');for(const text of values(value))cell(tr,text);body.append(tr);}
    if(!rows.length){const tr=document.createElement('tr'),td=cell(tr,empty);td.colSpan=columns;td.className='fta-empty-cell';body.append(tr);}
  }
  function svgNode(tag,attrs={},text){const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));if(text!==undefined)node.textContent=text;return node;}
  function dailyTrend(data){
    const byDay=new Map(data.daily.map(day=>[day.day,day])),end=new Date(data.today+'T12:00:00Z'),days=[];
    for(let i=data.days-1;i>=0;i--){const date=new Date(end);date.setUTCDate(date.getUTCDate()-i);const day=date.toISOString().slice(0,10);days.push({day,active:0,sessions:0,...byDay.get(day)});}
    table('daily',[...days].reverse(),d=>[shortDate(d.day)+(d.day===data.today?' · Today':''),count(d.active),count(d.sessions)],'No daily activity yet.');
    const peak=Math.max(0,...days.map(d=>Number(d.active))),ceiling=Math.max(2,Math.ceil(peak/2)*2),svg=svgNode('svg',{viewBox:'0 0 900 220',role:'img','aria-labelledby':'fta-chart-title fta-chart-description'});
    svg.append(svgNode('title',{id:'fta-chart-title'},'Daily participating visitors, last '+data.days+' days'));
    svg.append(svgNode('desc',{id:'fta-chart-description'},'Unique browsers each day. Today is still in progress. Exact counts are available in Daily numbers below.'));
    const left=40,top=18,height=152,width=844,step=width/days.length;
    for(let i=0;i<=2;i++){const y=top+height-i*height/2;svg.append(svgNode('line',{x1:left,x2:left+width,y1:y,y2:y,class:'fta-grid-line'}),svgNode('text',{x:left-12,y:y+4,'text-anchor':'end',class:'fta-axis'},count(ceiling*i/2)));}
    for(const [i,day] of days.entries()){
      const barHeight=Number(day.active)/ceiling*height,bar=svgNode('rect',{x:left+i*step+step*.18,y:top+height-barHeight,width:step*.64,height:barHeight,rx:Math.min(5,step*.16),class:day.day===data.today?'fta-chart-today':'fta-chart-bar'});
      bar.append(svgNode('title',{},shortDate(day.day)+': '+count(day.active)+' visitors, '+count(day.sessions)+' sessions'+(day.day===data.today?' (today so far)':'')));svg.append(bar);
      if(i===0||i===days.length-1||(days.length===7&&i%2===0)||(days.length===30&&i%7===0&&i<days.length-3))svg.append(svgNode('text',{x:left+(i+.5)*step,y:200,'text-anchor':i===0?'start':i===days.length-1?'end':'middle',class:'fta-axis'},day.day===data.today?'Today':shortDate(day.day)));
    }
    $('chart').replaceChildren(svg);
    const received=days.some(day=>Number(day.active)>0),peakDay=days.find(day=>Number(day.active)===peak);
    $('trend-note').textContent=received?'Peak: '+count(peak)+' visitors · '+shortDate(peakDay.day)+'. Today is still in progress.':'No participating visitors observed in this period.';
    $('timezone').textContent='Daily boundaries: '+data.timezone+'. Today’s totals above always refer to today.';
  }
  function insights(data){
    $('new').textContent=count(data.returning.new_browsers);$('returning').textContent=count(data.returning.returning_browsers);
    const todayErrors=Number(data.summary.errors),periodErrors=total(data.errors);
    $('health').textContent=todayErrors?count(todayErrors)+' error report'+(todayErrors===1?'':'s')+' today':'No errors reported today';
    $('health').classList.toggle('fta-health-warning',todayErrors>0);$('review-errors').hidden=periodErrors===0;
    $('error-count').textContent=count(periodErrors)+' report'+(periodErrors===1?'':'s');
    $('event-count').textContent=count(total(data.events))+' events';$('screen-count').textContent=count(data.screens.length)+' screens';$('device-count').textContent=count(data.devices.length)+' categories';
    document.querySelectorAll('.fta-period-label').forEach(node=>node.textContent='Last '+data.days+' days');
    const r=data.retention;$('retention').textContent=r.rate===null?'Collecting data':r.rate+'%';$('retention').classList.toggle('fta-pending',r.rate===null);
    $('retention-note').textContent=r.rate===null?'A full 7-day follow-up window is needed.':count(r.returned)+' of '+count(r.cohort)+' eligible browsers returned.';
    const f=data.funnel;$('funnel').replaceChildren();
    for(const [label,value] of [['Setup started',f.started],['PIN created',f.pin],['First save',f.first_transaction]]){
      const li=document.createElement('li'),name=document.createElement('span'),number=document.createElement('strong'),track=document.createElement('span'),bar=document.createElement('span');
      name.textContent=label;number.textContent=count(value);track.className='fta-step-track';track.setAttribute('aria-hidden','true');bar.style.width=(Number(f.started)?Number(value)/Number(f.started)*100:0)+'%';track.append(bar);li.append(number,name,track);$('funnel').append(li);
    }
    $('funnel-note').textContent=Number(f.started)?Math.round(100*Number(f.first_transaction)/Number(f.started))+'% of observed setup starts reached a first saved transaction.':'No first-use setup steps observed in this period.';
    table('errors',data.errors,e=>[errorLabels[e.code]||'App error',count(e.count),count(e.browsers)],'No errors received in this period.');
    table('events',data.events,e=>[labels[e.event]||'App activity',count(e.count),count(e.browsers)],'No activity received in this period.');
    const countries=data.countries||[],known=countries.filter(row=>row.country!=='ZZ'),countryName=code=>{if(code==='ZZ')return 'Unknown';try{return new Intl.DisplayNames(['en'],{type:'region'}).of(code);}catch{return code;}};
    $('country-count').textContent=count(known.length)+' countr'+(known.length===1?'y':'ies');
    table('countries',countries,row=>[countryName(row.country),count(row.browsers)],'No country estimates received yet.',2);
    $('country-note').textContent=!data.country_ready?'Country detection is unavailable on this host.':!known.length?'Country counts start after visitors accept the updated analytics notice.':'Countries reflect the latest observed visit in the selected period.';
    const devices={mobile:'Mobile',tablet:'Tablet',desktop:'Desktop',unknown:'Unknown'},modes={installed:'Installed app',browser:'Web browser',unknown:'Older app copy'};
    table('devices',data.devices,d=>[devices[d.device]||'Unknown',modes[d.mode]||'Unknown',count(d.browsers)],'No device categories received yet.');
    table('versions',data.versions,v=>[v.version==='legacy'?'Older app copy':v.version,count(v.browsers)],'No version data received yet.',2);
    const screens={overview:'Home',transactions:'History',reports:'Reports',calendar:'Calendar',settings:'Settings'};
    table('screens',data.screens,s=>[screens[s.screen]||'App screen',count(s.count),count(s.browsers)],'No workspace screens observed yet.');
  }
  async function refresh(){
    if(document.hidden)return;if(busy){pending=true;return;}
    busy=true;const days=$('days').value;$('refresh').disabled=true;$('dashboard').setAttribute('aria-busy','true');$('status').textContent='Updating…';
    try{
      const url=new URL(FlowTrackDashboard.url);url.searchParams.set('action','flowtrack_analytics_stats');url.searchParams.set('nonce',FlowTrackDashboard.nonce);url.searchParams.set('days',days);
      const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
      if(response.status===401||response.status===403)throw Error('Your sign-in has expired. Reload this page to sign in again.');
      if(!response.ok)throw Error('Analytics are temporarily unavailable. Try Refresh.');
      const body=await response.json();if(!body.success||!body.data)throw Error('Analytics could not load. Try Refresh or reload this page.');
      if(days!==$('days').value){pending=true;return;}
      const data=body.data,s=data.summary;for(const key of ['active','live','sessions','actions'])$(key).textContent=count(s[key]);insights(data);dailyTrend(data);
      $('empty').hidden=!!s.last_event;$('last').textContent=s.last_event?'Latest received event: '+new Date(s.last_event.replace(' ','T')+'Z').toLocaleString():'Waiting for the first participating visitor.';
      lastUpdated=new Date(data.updated).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});$('alert').hidden=true;$('status').classList.remove('fta-status-stale');$('status').textContent='Updated '+lastUpdated;
    }catch(error){
      $('alert').hidden=false;$('alert').textContent=error.message==='Failed to fetch'?'Connection interrupted. Try Refresh.':error.name==='TimeoutError'?'The update took too long. Try Refresh.':error.message||'Analytics could not load. Try Refresh.';
      $('status').classList.add('fta-status-stale');$('status').textContent=lastUpdated?'Update failed · showing '+lastUpdated+' data':'Update failed · no data loaded';
    }finally{
      busy=false;$('refresh').disabled=false;$('dashboard').setAttribute('aria-busy','false');if(pending){pending=false;refresh();}
    }
  }
  $('review-errors').addEventListener('click',()=>{const details=$('issues');details.open=true;details.querySelector('summary').focus();details.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'});});
  $('refresh').addEventListener('click',refresh);$('days').addEventListener('change',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});setInterval(refresh,60000);refresh();
})();
