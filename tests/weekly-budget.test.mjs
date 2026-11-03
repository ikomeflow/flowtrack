import {test} from 'node:test';import assert from 'node:assert/strict';
import {validateState} from '../dist/core-v4.mjs';import {validateState as legacyValidate} from '../dist/core-v3.mjs';
import {LedgerVault} from '../dist/vault-v10.mjs';import {LedgerVault as OldVault} from '../dist/vault-v9.mjs';
import {budgetSummary,configureBudget,prepareBudgetChange} from '../src/budgets.mjs';
const date='2026-11-02',entry=(amount,id='a',day=date,type='expense')=>({id,amount,date:day,type,description:'Original record',tags:['Work']}),empty=()=>({version:1,currency:'BYN',transactions:[]}),settings={daily:2000,weekly:10000,monthly:40000,yearly:480000,alerts:true,native:false};
const add=(s,amount,id='a',day=date,reference=day)=>prepareBudgetChange(s,{...s,transactions:[...s.transactions,entry(amount,id,day)]},reference);
test('old ledgers and budget fields remain unchanged until an explicit weekly save',()=>{
 const original={...empty(),transactions:[entry(12345)]},old=configureBudget(original,{monthly:80000,yearly:900000,daily:2000,alerts:true,native:true},date);
 assert.deepEqual(validateState(original),original);assert.deepEqual(validateState(old),old);const before=JSON.stringify(old);
 const next=configureBudget(old,{...old.budget,weekly:30000},date);assert.equal(JSON.stringify(old),before);assert.deepEqual(next.transactions,original.transactions);
 for(const key of ['monthly','yearly','daily','native','alerts'])assert.equal(next.budget[key],old.budget[key]);assert.equal(next.budget.weekly,30000);assert.throws(()=>legacyValidate(next));
});
test('weekly spending uses Monday through Sunday across month and year boundaries',()=>{
 let s=configureBudget(empty(),settings,date);s={...s,transactions:[entry(1,'before','2026-10-25'),entry(100,'mon','2026-10-26'),entry(200,'sun','2026-11-01'),entry(99999,'income','2026-10-28','income'),entry(500,'after')]};
 const week=budgetSummary(s,'week','2026-11-01');assert.equal(week.spent,300);assert.equal(week.key,'week:2026-10-26:10000');assert.equal(budgetSummary(s,'week',date).spent,500);
 s={...s,transactions:[entry(100,'dec','2026-12-28'),entry(200,'jan','2027-01-03'),entry(300,'next','2027-01-04')]};assert.equal(budgetSummary(s,'week','2027-01-01').spent,300);assert.equal(budgetSummary(s,'week','2027-01-01').key,'week:2026-12-28:10000');assert.equal(budgetSummary({...s,currency:'XAF'},'week',date),null);
});
test('weekly thresholds fire once and reset for a new calendar week',()=>{
 let s=configureBudget(empty(),{...settings,daily:null,monthly:null,yearly:null},date),r=add(s,5000);assert.equal(r.alert.kind,'week');assert.equal(r.alert.level,50);s=r.state;
 r=add(s,4000,'b');assert.equal(r.alert.level,90);s=r.state;r=add(s,1000,'c');assert.equal(r.alert.level,100);s=r.state;assert.equal(add(s,1,'d').alert,null);
 const reduced=prepareBudgetChange(s,{...s,transactions:[]},date).state;assert.equal(add(reduced,9000,'again').alert,null);
 const next=add(s,5000,'next','2026-11-09');assert.equal(next.alert.level,50);assert.equal(next.alert.key,'week:2026-11-09:10000');assert.equal(prepareBudgetChange(next.state,next.state,'2026-11-09').alert,null);
});
test('saving limits or turning them off is quiet and preserves independent periods',()=>{
 const s=configureBudget({...empty(),transactions:[entry(9500)]},settings,date);assert.equal(add(s,1,'b').alert,null);const off=configureBudget(s,{...s.budget,weekly:null},date);
 assert.equal(budgetSummary(off,'week',date),null);assert.equal(off.budget.monthly,settings.monthly);assert.equal(off.budget.yearly,settings.yearly);assert.deepEqual(off.transactions,s.transactions);
});
test('weekly limits, unknown fields and invalid notification markers fail closed',()=>{
 const s=configureBudget(empty(),settings,date);for(const weekly of [0,-1,0.5,NaN,Infinity,1000000000000,'100',undefined])assert.throws(()=>validateState({...s,budget:{...s.budget,weekly}}));
 for(const patch of [{surprise:1},{marks:{'week:2026-11-02:10000':75}},{marks:{'week:bad:10000':50}},{marks:{bad:50}}])assert.throws(()=>validateState({...s,budget:{...s.budget,...patch}}));
 const marks={'week:2026-10-26:10000':90,'month:2026-11:40000':50,'week:2026-11-02:10000':50};assert.deepEqual(Object.keys(validateState({...s,budget:{...s.budget,marks}}).budget.marks),Object.keys(marks));
});
test('old encrypted budgets open without a write; all limits survive PIN and recovery',async()=>{
 const map=new Map(),store={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)},old=new OldVault(store);old.load();
 const original=configureBudget({...empty(),transactions:[entry(12345)]},{monthly:80000,yearly:900000,daily:2000,alerts:true,native:true},date),key=await old.setPin('8392',original),raw=map.get('flowtrack.v1'),v=new LedgerVault(store);v.load();assert.deepEqual(await v.unlock('8392'),original);assert.equal(map.get('flowtrack.v1'),raw);
 const next=configureBudget(original,{...original.budget,weekly:30000},date);await v.save(next);const saved=map.get('flowtrack.v1');v.load();assert.deepEqual(await v.unlock('8392'),next);assert.equal(map.get('flowtrack.v1'),saved);assert.ok(!saved.includes('Original record'));
 old.load();await assert.rejects(old.unlock('8392'));assert.equal(map.get('flowtrack.v1'),saved);v.load();v.commitPrepared(await v.prepareSimpleReset(key,'1239'));v.load();assert.deepEqual(await v.unlock('1239'),next);
 const before=map.get('flowtrack.v1');store.setItem=()=>{throw Error('Quota');};await assert.rejects(v.save({...next,transactions:[]}),/Quota/);assert.equal(map.get('flowtrack.v1'),before);
});
test('weekly settings cannot overwrite another tab or write after locking',async()=>{
 const map=new Map(),store={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)},a=new LedgerVault(store),b=new LedgerVault(store);a.load();const s=configureBudget(empty(),settings,date);a.commitPrepared(await a.prepareSimplePin('8392',s));b.load();await b.unlock('8392');await a.save({...s,transactions:[entry(100)]});const before=map.get('flowtrack.v1');await assert.rejects(b.save(s));assert.equal(map.get('flowtrack.v1'),before);const pending=a.save(s);a.lock();await assert.rejects(pending);assert.equal(map.get('flowtrack.v1'),before);
});
