import {filterTransactions,totals,shiftMonth} from '../dist/core-v2.mjs';

// Read-only projections. Keep integer minor units and the existing ledger schema.
export function reportData(transactions,month){
 const rows=filterTransactions(transactions,{month}),sum=totals(rows),tags=new Map();
 for(const row of rows){if(row.type!=='expense')continue;const label=row.tags[0]||'Untagged';tags.set(label,(tags.get(label)||0)+row.amount);}
 const series=Array.from({length:6},(_,i)=>{const key=shiftMonth(month,i-5);return {month:key,...totals(filterTransactions(transactions,{month:key}))};});
 return {...sum,series,spending:[...tags].map(([label,amount])=>({label,amount})).sort((a,b)=>b.amount-a.amount||a.label.localeCompare(b.label))};
}
