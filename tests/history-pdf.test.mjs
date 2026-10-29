import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHistoryPDF} from '../dist/history-pdf-v1.mjs';

const entry={id:'one',date:'2026-10-29',description:'Café / São Tomé',tags:['Business','Office supplies'],type:'income',amount:123456};
const pdfText=bytes=>Buffer.from(bytes).toString('latin1');
test('history creates a genuine PDF with an embedded font and complete document trailer',async()=>{
 const bytes=await createHistoryPDF([entry],'XAF');const text=pdfText(bytes);
 assert.ok(text.startsWith('%PDF-'));assert.match(text,/\/FontFile2/);assert.match(text,/\/ToUnicode/);assert.match(text,/startxref\s+\d+\s+%%EOF/);assert.match(text,/\/Count 1\b/);
});
test('a long history exports all pages rather than the first 100 visible entries',async()=>{
 const rows=Array.from({length:125},(_,i)=>({...entry,id:String(i),description:'Long description '.repeat(9),tags:['One','Two','Three','Four','Five']}));
 const text=pdfText(await createHistoryPDF(rows,'NGN'));
 const pages=[...text.matchAll(/\/Type \/Page\b/g)].length;assert.ok(pages>10);assert.match(text,new RegExp(`/Count ${pages}\\b`));
});
test('locking or changing the ledger cancels PDF generation before a file is returned',async()=>{
 let checks=0;const rows=Array.from({length:250},(_,i)=>({...entry,id:String(i)}));
 await assert.rejects(createHistoryPDF(rows,'EUR',{isCurrent:()=>++checks<2}),{name:'AbortError'});assert.equal(checks,2);
});
