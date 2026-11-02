import {validDate,totals} from '../dist/core-v2.mjs';
const iso=d=>d.toISOString().slice(0,10),min='1900-01-01',max='9999-12-31';
const clamp=s=>s.startsWith('+')?max:s<min?min:s>max?max:s;
export function periodRange(kind,anchor){
 if(!validDate(anchor)||!['day','week','month','year'].includes(kind))throw Error('Choose a valid period.');
 const d=new Date(anchor+'T12:00:00Z'),y=d.getUTCFullYear(),m=d.getUTCMonth();let from=anchor,to=anchor;
 if(kind==='week'){d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);from=clamp(iso(d));d.setUTCDate(d.getUTCDate()+6);to=clamp(iso(d));}
 if(kind==='month'){from=anchor.slice(0,7)+'-01';to=iso(new Date(Date.UTC(y,m+1,0,12)));}
 if(kind==='year'){from=y+'-01-01';to=y+'-12-31';}
 return {from,to};
}
export function periodRows(rows,kind,anchor){const {from,to}=periodRange(kind,anchor);return rows.filter(t=>t.date>=from&&t.date<=to);}
export function movePeriod(kind,anchor,step){
 periodRange(kind,anchor);const d=new Date(anchor+'T12:00:00Z');
 if(kind==='day'||kind==='week')d.setUTCDate(d.getUTCDate()+step*(kind==='week'?7:1));
 else if(kind==='month'){d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+step);}
 else {d.setUTCDate(1);d.setUTCMonth(0);d.setUTCFullYear(d.getUTCFullYear()+step);}
 const value=iso(d);return validDate(value)?value:null;
}
export function periodLabel(kind,anchor){const r=periodRange(kind,anchor),fmt=(date,options)=>new Intl.DateTimeFormat(undefined,{...options,timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));if(kind==='year')return anchor.slice(0,4);if(kind==='month')return fmt(r.from,{month:'short',year:'numeric'});if(kind==='day')return fmt(anchor,{day:'numeric',month:'short',year:'numeric'});return fmt(r.from,{day:'numeric',month:'short'})+' – '+fmt(r.to,{day:'numeric',month:'short',year:'numeric'});}
export function periodReport(rows,kind,anchor){
 const selected=periodRows(rows,kind,anchor),sum=totals(selected),tags=new Map();for(const t of selected)if(t.type==='expense'){const label=t.tags[0]||'Untagged';tags.set(label,(tags.get(label)||0)+t.amount);}
 const range=periodRange(kind,anchor),series=[];
 if(kind==='year'){for(let i=1;i<=12;i++){const month=anchor.slice(0,4)+'-'+String(i).padStart(2,'0');series.push({label:new Intl.DateTimeFormat(undefined,{month:'short',timeZone:'UTC'}).format(new Date(month+'-01T12:00:00Z')),...totals(selected.filter(t=>t.date.startsWith(month)))});}}
 else {let d=new Date(range.from+'T12:00:00Z');const end=new Date(range.to+'T12:00:00Z'),size=kind==='month'?7:1;while(d<=end){const from=iso(d);d.setUTCDate(d.getUTCDate()+size-1);const to=d>end?range.to:iso(d);series.push({label:kind==='day'?periodLabel('day',from):from.slice(8)+(size>1?'–'+to.slice(8):''),...totals(selected.filter(t=>t.date>=from&&t.date<=to))});d.setUTCDate(d.getUTCDate()+1);}}
 return {...sum,series,spending:[...tags].map(([label,amount])=>({label,amount})).sort((a,b)=>b.amount-a.amount)};
}
