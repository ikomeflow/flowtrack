import {test} from 'node:test';import assert from 'node:assert/strict';
import {periodRange,movePeriod,periodRows,periodReport} from '../src/periods.mjs';
test('period boundaries cover days, Monday weeks, leap months and calendar years',()=>{
 assert.deepEqual(periodRange('day','2026-11-02'),{from:'2026-11-02',to:'2026-11-02'});
 assert.deepEqual(periodRange('week','2025-01-01'),{from:'2024-12-30',to:'2025-01-05'});
 assert.deepEqual(periodRange('week','2026-11-08'),{from:'2026-11-02',to:'2026-11-08'});
 assert.equal(periodRange('month','2024-02-29').to,'2024-02-29');assert.equal(periodRange('year','2024-02-29').from,'2024-01-01');
 assert.equal(movePeriod('week','2026-11-02',-1),'2026-10-26');assert.equal(movePeriod('year','2024-02-29',1),'2025-01-01');assert.equal(movePeriod('day','1900-01-01',-1),null);assert.equal(movePeriod('year','9999-01-01',1),null);
 assert.equal(periodRange('week','9999-12-31').to,'9999-12-31');assert.equal(periodReport([],'month','9999-12-31').series.length,5);
 assert.throws(()=>periodRange('day','2025-02-29'));
});
test('totals, categories and chart buckets count the selected rows exactly once without mutation',()=>{
 const rows=[{id:'a',date:'2026-11-02',amount:1234,type:'income',tags:[]},{id:'b',date:'2026-11-03',amount:29,type:'expense',tags:['Food','Home']},{id:'c',date:'2026-11-09',amount:500,type:'expense',tags:[]},{id:'d',date:'2025-11-02',amount:999,type:'income',tags:[]}],before=JSON.stringify(rows);
 assert.equal(periodRows(rows,'day','2026-11-02').length,1);const week=periodReport(rows,'week','2026-11-02');assert.equal(week.net,1205);assert.equal(week.spending[0].amount,29);assert.equal(week.series.reduce((n,s)=>n+s.net,0),week.net);
 for(const kind of ['day','week','month','year']){const r=periodReport(rows,kind,'2026-11-02');assert.equal(r.series.reduce((n,s)=>n+s.net,0),r.net);}assert.equal(periodReport(rows,'year','2026-11-02').series.length,12);assert.equal(JSON.stringify(rows),before);
});
