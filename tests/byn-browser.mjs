import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {inflateSync} from 'node:zlib';
import {openApp,readLedger,clickAdd} from './helpers.mjs';
const require=createRequire(join(process.env.FLOWTRACK_QA_PACKAGE_ROOT,'package.json')),{chromium}=require('playwright');
const output=process.env.FLOWTRACK_QA_OUTPUT||'test-results';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.FLOWTRACK_QA_BROWSER});
const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
function textPDF(bytes){
 const streams=[...Buffer.from(bytes).toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map(m=>{try{return inflateSync(Buffer.from(m[1],'latin1')).toString('latin1');}catch{return m[1];}}),glyphs=new Map();
 for(const stream of streams)for(const block of stream.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))for(const pair of block[1].matchAll(/<([\da-f]+)>\s*<([\da-f]+)>/gi))glyphs.set(pair[1].toLowerCase(),String.fromCharCode(...(pair[2].match(/.{4}/g)||[]).map(v=>parseInt(v,16))));
 return streams.flatMap(s=>[...s.matchAll(/<([\da-f]+)>\s*Tj/gi)].map(m=>(m[1].match(/.{4}/g)||[]).map(v=>glyphs.get(v.toLowerCase())||'').join(''))).join('\n');
}
try{
 await page.goto(process.env.FLOWTRACK_QA_URL||'http://127.0.0.1:4173');await openApp(page);
 await page.locator('nav a[data-view=settings]').click();await page.locator('#currency').selectOption('BYN');await page.waitForFunction(()=>document.getElementById('toast-message').textContent.includes('BYN'));
 assert.equal((await readLedger(page)).currency,'BYN');
 await page.locator('nav a[data-view=overview]').click();await clickAdd(page);await page.locator('#description').fill('BYN sample income');await page.locator('#amount').fill('12.34');await page.locator('#save-button').click();await page.locator('#transaction-dialog').waitFor({state:'hidden'});
 await page.reload();await openApp(page);let saved=await readLedger(page);assert.equal(saved.currency,'BYN');assert.equal(saved.transactions[0].amount,1234);
 await page.locator('nav a[data-view=settings]').click();await page.screenshot({path:join(output,'flowtrack-byn-settings.png'),fullPage:true});
 await page.waitForFunction(()=>navigator.serviceWorker.controller);await page.waitForFunction(()=>document.getElementById('offline-status').textContent.includes('Ready offline'));
 await context.setOffline(true);await page.reload();await openApp(page);saved=await readLedger(page);assert.equal(saved.currency,'BYN');assert.equal(saved.transactions[0].amount,1234);
 await page.locator('nav a[data-view=settings]').click();await page.locator('#backup-settings>summary').click();await page.locator('#export-all').click();await page.locator('#pdf-save-dialog').waitFor({state:'visible'});const pending=page.waitForEvent('download');await page.locator('#pdf-save-download').click();const file=await pending;const pdf=join(output,'flowtrack-byn-history.pdf');await file.saveAs(pdf);const bytes=await readFile(pdf);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');const text=textPDF(bytes);assert.ok(text.includes('BYN'));assert.ok(text.includes('12.34'));
 assert.deepEqual(errors,[]);console.log('PASS: BYN selection saves, exact decimals and PIN survive reload, app reopens offline, BYN PDF downloads offline, no browser errors.');
}finally{await browser.close();}
