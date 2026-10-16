export const STORAGE_KEY = 'flowtrack.v1';
export const CURRENCIES = {
  NGN:'Nigerian naira', GHS:'Ghanaian cedi', XAF:'Central African CFA franc', XOF:'West African CFA franc', KES:'Kenyan shilling', ZAR:'South African rand', UGX:'Ugandan shilling', TZS:'Tanzanian shilling', RWF:'Rwandan franc', ETB:'Ethiopian birr', EGP:'Egyptian pound', MAD:'Moroccan dirham', DZD:'Algerian dinar', TND:'Tunisian dinar', BWP:'Botswana pula', ZMW:'Zambian kwacha', MWK:'Malawian kwacha', MZN:'Mozambican metical', AOA:'Angolan kwanza', NAD:'Namibian dollar', SZL:'Swazi lilangeni', LSL:'Lesotho loti', MUR:'Mauritian rupee', SCR:'Seychellois rupee', CVE:'Cape Verdean escudo', GMD:'Gambian dalasi', GNF:'Guinean franc', LRD:'Liberian dollar', SLE:'Sierra Leonean leone', SOS:'Somali shilling', DJF:'Djiboutian franc', BIF:'Burundian franc', CDF:'Congolese franc', MGA:'Malagasy ariary', KMF:'Comorian franc', STN:'São Tomé and Príncipe dobra', MRU:'Mauritanian ouguiya', SDG:'Sudanese pound', SSP:'South Sudanese pound', LYD:'Libyan dinar', ERN:'Eritrean nakfa', USD:'US dollar', EUR:'Euro', GBP:'British pound', CAD:'Canadian dollar', AUD:'Australian dollar', CHF:'Swiss franc', JPY:'Japanese yen', CNY:'Chinese yuan', INR:'Indian rupee', AED:'UAE dirham', SAR:'Saudi riyal', BRL:'Brazilian real'
};
export function today() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function validDate(s) { if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s)||s<'1900-01-01'||s>'9999-12-31')return false; const d=new Date(s+'T12:00:00Z'); return !isNaN(d)&&d.toISOString().slice(0,10)===s; }
export function parseAmount(value) {
  const s=String(value).trim();
  if(!/^\d+(\.\d{1,2})?$/.test(s)) throw Error('Enter a positive amount with up to two decimal places.');
  const [a,b='']=s.split('.'); const n=Number(a)*100+Number(b.padEnd(2,'0'));
  if(!Number.isSafeInteger(n)||n<=0||n>999999999999)throw Error('Amount must be between 0.01 and 9,999,999,999.99.');
  return n;
}
export function validateTransaction(t) {
  if(!t||typeof t!=='object'||typeof t.id!=='string'||!t.id||t.id.length>100)throw Error('Invalid transaction ID.');
  if(typeof t.description!=='string'||!t.description.trim()||t.description.length>160)throw Error('Description must contain 1–160 characters.');
  if(!['income','expense'].includes(t.type))throw Error('Choose income or expense.');
  if(!Number.isSafeInteger(t.amount)||t.amount<=0||t.amount>999999999999)throw Error('Invalid transaction amount.');
  if(!validDate(t.date))throw Error('Choose a valid date from 1900 onwards.');
  if(!Array.isArray(t.tags)||t.tags.length>5||t.tags.some(x=>typeof x!=='string'||!x.trim()||x.length>24))throw Error('Use up to 5 tags, each 1–24 characters.');
  return {id:t.id,description:t.description.trim(),amount:t.amount,type:t.type,date:t.date,tags:[...new Set(t.tags.map(x=>x.trim()))]};
}
export function validateState(s) {
  if(!s||s.version!==1||typeof s.currency!=='string'||!Object.hasOwn(CURRENCIES,s.currency)||!Array.isArray(s.transactions)||s.transactions.length>50000)throw Error('This is not a supported FlowTrack v1 backup.');
  const transactions=s.transactions.map(validateTransaction);
  if(new Set(transactions.map(t=>t.id)).size!==transactions.length)throw Error('Duplicate transaction IDs in backup.');
  let total=0; for(const t of transactions){total+=t.amount;if(!Number.isSafeInteger(total))throw Error('Total exceeds the supported amount.');}
  return {version:1,currency:s.currency,transactions};
}
export function emptyState(){return {version:1,currency:'XAF',transactions:[]};}
export function totals(rows){return rows.reduce((a,t)=>{a[t.type]+=t.amount;a.net+=t.type==='income'?t.amount:-t.amount;return a;},{income:0,expense:0,net:0});}
export function filterTransactions(rows,{month='',query='',type='all',date=''}={}) {
 const q=query.trim().toLocaleLowerCase();
 return rows.filter(t=>(!month||t.date.startsWith(month))&&(!date||t.date===date)&&(type==='all'||t.type===type)&&(!q||`${t.description} ${t.tags.join(' ')}`.toLocaleLowerCase().includes(q))).sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
}
export function money(cents,currency){return new Intl.NumberFormat(undefined,{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2,currencyDisplay:'code'}).format(cents/100);}
export function shiftMonth(month,offset){const [y,m]=month.split('-').map(Number);const d=new Date(y,m-1+offset,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
export function csvExport(rows,currency) {
  const cell=v=>{let s=String(v);if(/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
  return '\uFEFF'+[['Date','Description','Type','Amount','Currency','Tags'],...filterTransactions(rows).map(t=>[t.date,t.description,t.type,(t.amount/100).toFixed(2),currency,t.tags.join('; ')])].map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
}
