import {validateState,today} from '../dist/core-v4.mjs';
import {periodRange} from './periods.mjs';
const field={day:'daily',week:'weekly',month:'monthly',year:'yearly'};
export function budgetLevel(spent,limit){const n=BigInt(spent)*100n,d=BigInt(limit);return n>=d*100n?100:n>=d*90n?90:n>=d*50n?50:0;}
export function budgetSummary(state,kind,anchor=today()){
 const b=state.budget,limit=b?.currency===state.currency?b[field[kind]]:null;if(!limit)return null;
 const {from,to}=periodRange(kind,anchor);let spent=0;for(const t of state.transactions)if(t.type==='expense'&&t.date>=from&&t.date<=to)spent+=t.amount;
 return {kind,limit,spent,left:Math.max(0,limit-spent),level:budgetLevel(spent,limit),percent:Math.min(100,Number(BigInt(spent)*100n/BigInt(limit))),key:`${kind}:${kind==='day'?anchor:kind==='week'?from:kind==='month'?anchor.slice(0,7):anchor.slice(0,4)}:${limit}`};
}
export function dailyGuide(state,anchor=today()){
 const s=budgetSummary(state,'month',anchor);if(!s)return null;const end=periodRange('month',anchor).to,days=Math.round((Date.parse(end+'T12:00:00Z')-Date.parse(anchor+'T12:00:00Z'))/86400000)+1;return Math.floor(s.left/days);
}
export function prepareBudgetChange(previous,input,reference=today()){
 let next=validateState(input);if(next.version!==2||next.budget.currency!==next.currency)return {state:next,alert:null};
 const marks={...next.budget.marks},events=[];
 for(const kind of ['month','year','week','day']){
  const now=budgetSummary(next,kind,reference);if(!now)continue;
  const before=budgetSummary(previous,kind,reference),same=before&&previous.currency===next.currency&&before.limit===now.limit;
  const old=Math.max(marks[now.key]||0,same?before.level:now.level);
  if(now.level)marks[now.key]=Math.max(marks[now.key]||0,now.level);
  if(same&&now.spent>before.spent&&now.level>old&&next.budget.alerts)events.push(now);
 }
 next={...next,budget:{...next.budget,marks:Object.fromEntries(Object.entries(marks).slice(-600))}};
 return {state:next,alert:events.sort((a,b)=>b.level-a.level)[0]||null};
}
export function configureBudget(state,settings,reference=today()){
 const sameCurrency=state.budget?.currency===state.currency,budget={...settings,currency:state.currency,marks:sameCurrency?state.budget.marks:{}};
 const next=validateState({...state,version:2,budget});return prepareBudgetChange(next,next,reference).state;
}
