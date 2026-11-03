import * as core from './core-v3.mjs';
export * from './core-v3.mjs';
// Older budget readers reject the added weekly field, rather than dropping it.
export function validateState(input){
 if(input?.version!==2||!input.budget||!Object.hasOwn(input.budget,'weekly'))return core.validateState(input);
 const {weekly,...budget}=input.budget;
 if(weekly!==null&&(!Number.isSafeInteger(weekly)||weekly<=0||weekly>999999999999))throw Error('Enter a positive expenditure limit with up to two decimals.');
 if(!budget.marks||typeof budget.marks!=='object'||Array.isArray(budget.marks)||Object.keys(budget.marks).length>600)throw Error('Invalid budget alerts.');
 const other={},weeks={};for(const [key,value] of Object.entries(budget.marks)){
  if(key.startsWith('week:')){if(!/^week:\d{4}-\d{2}-\d{2}:\d{1,12}$/.test(key)||![50,90,100].includes(value))throw Error('Invalid weekly alert record.');weeks[key]=value;}
  else other[key]=value;
 }
 const valid=core.validateState({...input,budget:{...budget,marks:other}});
 return {...valid,budget:{...valid.budget,weekly,marks:{...budget.marks}}};
}
