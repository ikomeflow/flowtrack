import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const script=await readFile(new URL('../wordpress/flowtrack-analytics/dashboard.js',import.meta.url),'utf8');
const markup=await readFile(new URL('../wordpress/flowtrack-analytics/flowtrack-analytics.php',import.meta.url),'utf8');
class Element {
  constructor(tag='div'){this.tag=tag;this.children=[];this.attrs={};this.style={};this.listeners={};this.hidden=false;this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name),add:name=>this.classes.add(name),remove:name=>this.classes.delete(name)};}
  set textContent(value){this.text=String(value);this.children=[];}
  get textContent(){return (this.text||'')+this.children.map(child=>child.textContent).join('');}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.text='';this.children=[...nodes];}
  setAttribute(key,value){this.attrs[key]=String(value);}
  addEventListener(name,fn){this.listeners[name]=fn;}
  querySelector(){return this.summary??=new Element('summary');}
  focus(){this.focused=true;}
  scrollIntoView(){}
}
function fixture(days=7){return {
  summary:{active:8,live:2,sessions:11,actions:4,errors:0,last_event:'2026-11-01 12:00:00'},
  daily:[{day:'2026-10-30',active:5,sessions:7},{day:'2026-11-01',active:8,sessions:11}],
  events:[{event:'transaction_created',count:4,browsers:3}],returning:{new_browsers:5,returning_browsers:3},
  retention:{cohort:0,returned:0,rate:null},funnel:{started:5,pin:4,first_transaction:2},
  countries:[{country:'CM',browsers:5},{country:'CA',browsers:2},{country:'ZZ',browsers:1}],country_ready:true,devices:[{device:'mobile',mode:'installed',browsers:6}],versions:[{version:'1.18.0',browsers:8}],
  errors:[],screens:[{screen:'overview',count:10,browsers:8}],days,today:'2026-11-01',timezone:'Africa/Douala',updated:'2026-11-01T12:01:00Z'
};}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function boot(fetcher){
  const elements=new Map([...markup.matchAll(/id="(fta-[^"]+)"/g)].map(match=>[match[1],new Element()]));
  const get=id=>elements.get('fta-'+id);get('days').value='7';
  const periodLabels=[new Element(),new Element()];
  const document={hidden:false,getElementById:id=>{assert.ok(elements.has(id),'dashboard element exists: '+id);return elements.get(id);},createElement:tag=>new Element(tag),createElementNS:(namespace,tag)=>new Element(tag),querySelectorAll:()=>periodLabels,listeners:{},addEventListener(name,fn){this.listeners[name]=fn;}};
  const requests=[],intervals=[];
  vm.runInNewContext(script,{document,URL,AbortSignal,Date,matchMedia:()=>({matches:true}),FlowTrackDashboard:{url:'https://example.test/wp-admin/admin-ajax.php',nonce:'test-nonce'},setInterval:fn=>intervals.push(fn),fetch:(url,options)=>{requests.push({url,options});return fetcher(url,options);}});
  return {get,document,requests,intervals,periodLabels};
}
const ok=data=>({ok:true,status:200,json:async()=>({success:true,data})});

test('dashboard fills gaps, labels today correctly, and renders only aggregate reports',async()=>{
  const state=boot(async()=>ok(fixture()));await flush();
  assert.equal(state.get('active').textContent,'8');assert.equal(state.get('live').textContent,'2');
  assert.equal(state.get('daily').children.length,7);
  assert.match(state.get('daily').children[0].textContent,/Today811/);
  assert.equal(state.get('daily').children[1].children[1].textContent,'0');
  const chart=state.get('chart').children[0];assert.equal(chart.children.filter(n=>n.tag==='rect').length,7);
  assert.ok(chart.children.filter(n=>n.tag==='rect').every(n=>Number.isFinite(Number(n.attrs.height))));
  assert.equal(chart.attrs.role,'img');assert.equal(state.get('retention').textContent,'Collecting data');
  assert.equal(state.get('review-errors').hidden,true);assert.equal(state.get('dashboard').attrs['aria-busy'],'false');
  assert.equal(state.requests[0].options.credentials,'same-origin');assert.equal(state.requests[0].options.cache,'no-store');
  assert.equal(state.requests[0].url.searchParams.get('nonce'),'test-nonce');
});
test('empty history shows honest zero states and a complete 30-day chart without NaN',async()=>{
  const data=fixture(30);Object.assign(data,{daily:[],events:[],errors:[],screens:[],devices:[],versions:[],funnel:{started:0,pin:0,first_transaction:0}});data.summary.last_event=null;
  const state=boot(async()=>ok(data));await flush();
  assert.equal(state.get('daily').children.length,30);assert.equal(state.get('empty').hidden,false);
  assert.match(state.get('trend-note').textContent,/No participating visitors/);
  assert.equal(state.get('versions').children[0].children[0].colSpan,2);
  assert.equal(state.get('funnel').children[0].children[2].children[0].style.width,'0%');
  assert.ok(state.get('chart').children[0].children.filter(n=>n.tag==='rect').every(n=>n.attrs.height==='0'));
});
test('historical errors remain visible when today has none, and review opens details',async()=>{
  const data=fixture();data.errors=[{code:'save_failed',count:2,browsers:1}];
  const state=boot(async()=>ok(data));await flush();
  assert.equal(state.get('health').textContent,'No errors reported today');assert.equal(state.get('error-count').textContent,'2 reports');
  assert.equal(state.get('review-errors').hidden,false);state.get('review-errors').listeners.click();
  assert.equal(state.get('issues').open,true);assert.equal(state.get('issues').summary.focused,true);
});
test('failed refresh preserves last successful numbers and clearly marks them stale',async()=>{
  let calls=0;const state=boot(async()=>++calls===1?ok(fixture()):{ok:false,status:503});await flush();
  await state.get('refresh').listeners.click();await flush();
  assert.equal(state.get('active').textContent,'8');assert.equal(state.get('alert').hidden,false);
  assert.match(state.get('status').textContent,/Update failed · showing/);assert.equal(state.get('refresh').disabled,false);
});
test('expired admin session explains how to recover instead of rendering zero traffic',async()=>{
  const state=boot(async()=>({ok:false,status:403}));await flush();
  assert.match(state.get('alert').textContent,/sign-in has expired/);assert.match(state.get('status').textContent,/no data loaded/);
});
test('rapid period changes discard old responses and fetch the latest selection',async()=>{
  const resolvers=[];const state=boot(()=>new Promise(resolve=>resolvers.push(resolve)));
  state.get('days').value='30';state.get('days').listeners.change();
  resolvers[0](ok(fixture(7)));await flush();assert.equal(resolvers.length,2);assert.equal(state.get('chart').children.length,0);
  resolvers[1](ok(fixture(30)));await flush();
  assert.equal(state.requests[1].url.searchParams.get('days'),'30');assert.equal(state.get('daily').children.length,30);
  assert.equal(state.periodLabels[0].textContent,'Last 30 days');
});
test('hidden tabs do not poll and refresh when visible again',async()=>{
  const state=boot(async()=>ok(fixture()));await flush();state.document.hidden=true;state.intervals[0]();assert.equal(state.requests.length,1);
  state.document.hidden=false;state.document.listeners.visibilitychange();await flush();assert.equal(state.requests.length,2);
});
test('country table labels estimates, aggregates unknown visitors and exposes unavailable detection',async()=>{
 const data=fixture(),state=boot(async()=>ok(data));await flush();assert.equal(state.get('country-count').textContent,'2 countries');assert.equal(state.get('countries').children.length,3);assert.match(state.get('countries').textContent,/Cameroon5/);assert.match(state.get('countries').textContent,/Unknown1/);
 data.country_ready=false;await state.get('refresh').listeners.click();await flush();assert.match(state.get('country-note').textContent,/unavailable/);assert.equal(state.get('active').textContent,'8');
});
