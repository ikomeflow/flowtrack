import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAmount,validateTransaction,validateState,validDate,totals,filterTransactions,csvExport,emptyState,shiftMonth,money,CURRENCIES} from '../dist/core-v2.mjs';
const tx=(id,amount,type='expense',date='2026-10-16',description='Lunch',tags=['Food'])=>({id,amount,type,date,description,tags});
test('money uses exact minor units and rejects invalid or excessive values',()=>{
 assert.equal(parseAmount('0.29'),29);assert.equal(parseAmount('1000.1'),100010);assert.equal(parseAmount(' 01.05 '),105);
 for(const x of ['0','-1','1.001','1e5','NaN','Infinity','1,000','+3','.5','10000000000'])assert.throws(()=>parseAmount(x));
 assert.equal(parseAmount('9999999999.99'),999999999999);
});
test('monthly totals exclude other months and use income minus expenses',()=>{
 const rows=[tx('a',120005,'income'),tx('b',20015),tx('c',50000,'income','2026-09-30')];
 assert.deepEqual(totals(filterTransactions(rows,{month:'2026-10'})),{income:120005,expense:20015,net:99990});
 assert.equal(totals([tx('b',20015)]).net,-20015);
});
test('filters combine description/tag search, type, date and month; sort newest first',()=>{
 const rows=[tx('a',100,'expense','2026-10-01','Rice',['Food']),tx('b',200,'income','2026-10-16','Freelance',['Work']),tx('c',400,'expense','2026-10-16','Bus',['Transport'])];
 assert.deepEqual(filterTransactions(rows,{query:' FOOD ',type:'expense'}).map(t=>t.id),['a']);
 assert.deepEqual(filterTransactions(rows,{month:'2026-10',date:'2026-10-16'}).map(t=>t.id),['c','b']);
 assert.equal(filterTransactions(rows,{query:'absent'}).length,0);
});
test('real calendar dates and leap years validated without timezone shifts',()=>{
 for(const d of ['2024-02-29','2026-01-01','1900-01-01','9999-12-31'])assert.equal(validDate(d),true);
 for(const d of ['2026-02-29','2026-04-31','2026-13-01','2026-10-00','1899-01-01','16/10/2026',null])assert.equal(validDate(d),false);
 assert.equal(shiftMonth('2026-01',-1),'2025-12');assert.equal(shiftMonth('2026-12',1),'2027-01');
});

test('same-day entries show newest additions first regardless of random IDs',()=>{
 const rows=[tx('zz-old',100),tx('aa-new',200),tx('backdated',300,'income','2026-10-01')];
 assert.deepEqual(filterTransactions(rows).map(t=>t.id),['aa-new','zz-old','backdated']);
 assert.deepEqual(rows.map(t=>t.id),['zz-old','aa-new','backdated']);
});
test('backup round trip preserves data and normalizes allowed fields',()=>{
 const original={...emptyState(),transactions:[tx('1',12345,'income','2026-10-16','  Design  ',['Work','Work'])]};
 const restored=validateState(JSON.parse(JSON.stringify(original)));
 assert.equal(restored.transactions[0].description,'Design');assert.deepEqual(restored.transactions[0].tags,['Work']);assert.equal(restored.currency,'XAF');
});
test('malformed backups, duplicate IDs and unsafe totals are rejected',()=>{
 for(const bad of [{},null,{version:2,currency:'XAF',transactions:[]},{version:1,currency:'FAKE',transactions:[]},{version:1,currency:['XAF'],transactions:[]},{...emptyState(),transactions:[tx('a',-10)]},{...emptyState(),transactions:[tx('a',1),tx('a',2)]},{...emptyState(),transactions:[tx('x',1,'other')]}])assert.throws(()=>validateState(bad));
 assert.throws(()=>validateState({...emptyState(),transactions:Array.from({length:9100},(_,i)=>tx(String(i),999999999999))}));
});
test('transaction validation rejects blank descriptions, unsafe tags and invalid amounts',()=>{
 assert.throws(()=>validateTransaction(tx('x',1,'expense','2026-10-16',' ')));
 assert.throws(()=>validateTransaction(tx('x',1,'expense','2026-10-16','Lunch',Array(6).fill('x'))));
 assert.throws(()=>validateTransaction(tx('x',1.2)));
});
test('CSV quotes separators, quotes and line breaks and neutralizes spreadsheet formulas',()=>{
 const rows=[tx('a',1200,'income','2026-10-16','=HYPERLINK("x")',['Work,home']),tx('b',299,'expense','2026-10-15','Rice, "good"\nFresh',['Food'])];
 const csv=csvExport(rows,'XAF');assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));assert.ok(csv.includes('"Rice, ""good""\nFresh"'));assert.ok(csv.includes('"12.00","XAF"'));assert.ok(csv.endsWith('\r\n'));
});
test('currency changes preserve numeric values, including currencies normally displayed without decimals',()=>{
 const original={...emptyState(),transactions:[tx('a',10025)]};const changed=validateState({...original,currency:'JPY'});
 assert.equal(changed.transactions[0].amount,10025);assert.ok(money(10025,'JPY').includes('100.25'));assert.ok(Object.keys(CURRENCIES).length>45);
});

