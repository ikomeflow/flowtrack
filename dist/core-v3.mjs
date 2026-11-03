import * as core from './core-v2.mjs';
export * from './core-v2.mjs';
export function validateState(input){
 if(input?.version===1){if(Object.hasOwn(input,'budget'))throw Error('Unsupported budget data. Records were kept.');return core.validateState(input);}
 if(input?.version!==2||Object.keys(input).some(k=>!['version','currency','transactions','budget'].includes(k)))throw Error('Unsupported FlowTrack backup. Records were kept.');
 const base=core.validateState({...input,version:1}),b=input.budget;
 if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!['currency','monthly','yearly','daily','alerts','native','marks'].includes(k))||!Object.hasOwn(core.CURRENCIES,b.currency)||typeof b.alerts!=='boolean'||typeof b.native!=='boolean')throw Error('Invalid budget settings.');
 for(const key of ['monthly','yearly','daily'])if(b[key]!==null&&(!Number.isSafeInteger(b[key])||b[key]<=0||b[key]>999999999999))throw Error('Enter a positive budget with up to two decimals.');
 if(!b.marks||typeof b.marks!=='object'||Array.isArray(b.marks)||Object.keys(b.marks).length>600)throw Error('Invalid budget alerts.');
 const marks={};for(const [key,value] of Object.entries(b.marks)){if(!/^(day:\d{4}-\d{2}-\d{2}|month:\d{4}-\d{2}|year:\d{4}):\d{1,12}$/.test(key)||![50,90,100].includes(value))throw Error('Invalid budget alert record.');marks[key]=value;}
 return {...base,version:2,budget:{currency:b.currency,monthly:b.monthly,yearly:b.yearly,daily:b.daily,alerts:b.alerts,native:b.native,marks}};
}
