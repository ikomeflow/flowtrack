import {clickAdd} from './helpers.mjs';
import {openApp,readLedger,writeLedger} from './helpers.mjs';
// Optional end-to-end tests: npm install --no-save playwright, then run npm start
// in another terminal and: node tests/browser.mjs
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
const require=createRequire(process.env.FLOWTRACK_QA_PACKAGE_ROOT ? join(process.env.FLOWTRACK_QA_PACKAGE_ROOT,'package.json') : import.meta.url);
const {chromium}=require('playwright');
const browser=await chromium.launch({headless:true,...(process.env.FLOWTRACK_QA_BROWSER?{executablePath:process.env.FLOWTRACK_QA_BROWSER}:{})});
const origin=process.env.FLOWTRACK_QA_URL||'http://127.0.0.1:4173';
const output=process.env.FLOWTRACK_QA_OUTPUT||'test-results';await mkdir(output,{recursive:true});
const errors=[];let passed=0;
const context=await browser.newContext({viewport:{width:1440,height:1080},acceptDownloads:true,colorScheme:'light'});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const check=(condition,message)=>{assert.ok(condition,message);passed++;console.log('PASS '+message);};
async function add(description,amount,type='expense',tags='Food'){
 await clickAdd(page);await page.locator('#description').fill(description);await page.locator('#amount').fill(amount);await page.locator(`input[name=type][value=${type}]`).check();await page.locator('#transaction-options summary').click();await page.locator('#tags').fill(tags);await page.locator('#save-button').click();await page.locator('#transaction-dialog').waitFor({state:'hidden'});
}
try{
 await page.goto(origin);await openApp(page);await page.waitForSelector('#net-value');
 check(await page.locator('#recent-list').innerText().then(s=>s.includes('No transactions')),'fresh install has honest empty state');
 check(await page.locator('nav a').count()===3,'only Home, History and Settings in primary navigation');check(await page.locator('.charts-grid').count()===0,'home shows balances and entries without charts');await clickAdd(page);check(await page.locator('#amount').evaluate(el=>el===document.activeElement),'add starts at amount with numeric keyboard');check(await page.locator('#date').inputValue()===new Date().toLocaleDateString('en-CA'),'new transaction defaults to today');check(await page.locator('#tags').isHidden()&&await page.locator('#date').isHidden(),'date and tags are tucked under More options');await page.locator('.close-transaction').first().click();
 await add('Design payment','1000.29','income','Work');await add('Lunch and bus','200.10','expense','Food, Transport');
 check((await page.locator('#net-value').innerText()).includes('800.19'),'exact dashboard income minus expenses');
 const ledgerBeforeTheme=await page.evaluate(()=>localStorage.getItem('flowtrack.v1'));
 await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();
 check(await page.locator('html').getAttribute('data-theme')==='dark','theme toggle enables dark mode');
 check(await page.locator('.settings-panel').first().evaluate(el=>getComputedStyle(el).backgroundColor)==='rgb(20, 22, 27)','dark mode changes panel surfaces');
 await page.reload();await openApp(page);
 check(await page.locator('html').getAttribute('data-theme')==='dark','dark preference survives reload');
 check(await page.evaluate(()=>localStorage.getItem('flowtrack.v1'))===ledgerBeforeTheme,'changing theme preserves the complete ledger');
 await clickAdd(page);
 check(await page.locator('#description').evaluate(el=>getComputedStyle(el).backgroundColor)==='rgb(20, 22, 27)','dark transaction inputs match the theme');
 await page.locator('.close-transaction').first().click();
 await page.getByRole('button',{name:'Switch to light mode',exact:true}).click();
 check(await page.locator('.settings-panel').first().evaluate(el=>getComputedStyle(el).backgroundColor)==='rgb(255, 255, 255)','toggle restores white surfaces');
 await page.reload();await openApp(page);check((await page.locator('#income-value').innerText()).includes('1,000.29'),'transactions persist after reload');
 await page.locator('nav a[data-view=transactions]').click();await page.locator('#search').fill('Transport');
 check(await page.locator('#transaction-list .entry-row').count()===1,'search finds optional tags');
 await page.locator('#history-filters summary').click();await page.locator('#type-filter').selectOption('income');check(await page.locator('#transaction-list .entry-row').count()===0,'combined type/search filters');
 await page.locator('#search').fill('');await page.locator('#type-filter').selectOption('all');
 await page.getByRole('button',{name:'Edit Lunch and bus',exact:true}).click();await page.locator('#amount').fill('250.10');await page.locator('#description').fill('Lunch edited');await page.locator('#save-button').click();
 check((await page.locator('#transaction-list').innerText()).includes('250.10'),'edit updates transaction amount and description');
 await page.getByRole('button',{name:'Edit Lunch edited',exact:true}).click();await page.locator('#delete-transaction').click();await page.locator('#transaction-dialog').waitFor({state:'hidden'});check(await page.locator('#transaction-list .entry-row').count()===1&&!await page.locator('#confirm-dialog').isVisible(),'delete immediately removes the entry without another confirmation');await page.locator('#undo-delete').click();await page.locator('#undo-delete').waitFor({state:'hidden'});check(await page.locator('#transaction-list .entry-row').count()===2,'Undo restores the deleted record');await page.getByRole('button',{name:'Edit Lunch edited',exact:true}).click();await page.locator('#delete-transaction').click();await page.locator('#transaction-dialog').waitFor({state:'hidden'});
 await page.locator('a[aria-label="Calendar view"]').click();check(await page.locator('.day').count()>=28,'calendar renders real month days');await page.locator('.day.today').click();check((await page.locator('#day-list').innerText()).includes('Design payment'),'calendar displays daily transactions');
 await page.locator('nav a[data-view=settings]').click();await page.locator('#currency').selectOption('NGN');await page.locator('#confirm-cancel').click();check(await page.locator('#currency').inputValue()==='XAF','currency cancellation keeps previous unit');
 await page.locator('#currency').selectOption('NGN');await page.locator('#confirm-ok').click();check(await page.locator('#currency').inputValue()==='NGN','currency change relabels ledger after confirmation');
 const backupEvent=page.waitForEvent('download');await page.locator('#backup-settings summary').click();await page.locator('#backup-button').click();const backup=await backupEvent;const backupPath=join(output,'backup.json');await backup.saveAs(backupPath);const saved=JSON.parse(await readFile(backupPath,'utf8'));
 check(saved.currency==='NGN'&&saved.transactions[0].amount===100029,'JSON backup preserves exact data and currency');
 const csvEvent=page.waitForEvent('download');await page.locator('#export-all').click();const csv=await csvEvent;const csvPath=join(output,'export.csv');await csv.saveAs(csvPath);check((await readFile(csvPath,'utf8')).includes('Design payment'),'CSV export downloads actual ledger');
 await page.locator('#advanced-settings summary').click();await page.locator('#clear-button').click();await page.locator('#confirm-ok').click();
 check((await readLedger(page)).transactions.length===0,'clear data removes stored ledger');
 await page.locator('#restore-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});await page.locator('#confirm-ok').click();await openApp(page);
 check((await readLedger(page)).transactions.length===1,'JSON restore recovers ledger');
 await page.locator('#restore-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"bad":true}')});await page.waitForTimeout(150);
 check((await readLedger(page)).transactions.length===1,'malformed restore preserves existing data');
 await page.locator('#demo-button').click();await page.locator('nav a[data-view=overview]').click();check(await page.locator('#demo-banner').isVisible(),'demo is clearly labeled');
 check((await readLedger(page)).transactions.length===1,'demo never overwrites personal data');
 await page.locator('#toast').waitFor({state:'hidden'});await page.screenshot({path:join(output,'desktop.png'),fullPage:true});
 await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();
 await page.screenshot({path:join(output,'desktop-dark.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(output,'mobile.png'),fullPage:true});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'390px mobile layout has no horizontal overflow');
 for(const width of [320,375,768,1024]){await page.setViewportSize({width,height:900});for(const view of ['overview','transactions','calendar','settings']){if(view==='calendar'){await page.locator('nav a[data-view=transactions]').click();await page.locator('a[aria-label="Calendar view"]').click();}else await page.locator(`nav a[data-view=${view}]`).click();check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${view} fits ${width}px`);}}
 await page.locator('#exit-demo').click();
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await openApp(page);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await context.setOffline(true);await page.reload();await openApp(page);await page.locator('nav a[data-view=overview]').click();check((await page.locator('#income-value').innerText()).includes('1,000.29'),'PWA reloads offline with saved data');
 check(await page.locator('html').getAttribute('data-theme')==='dark','saved theme works offline');
 await page.locator('nav a[data-view=overview]').click();await add('Offline entry','0.29');check((await page.locator('#net-value').innerText()).includes('1,000.00'),'offline add persists exact decimals');await context.setOffline(false);
 const second=await context.newPage();await second.goto(origin);await openApp(second);await writeLedger(second,{...(await readLedger(second)),transactions:[]});await page.locator('#lock-screen').waitFor({state:'visible'});await openApp(page);check((await page.locator('#net-value').innerText()).includes('0.00'),'another tab updates current ledger');await second.close();
 await page.evaluate(()=>localStorage.setItem('flowtrack.v1','unreadable-data'));await page.reload();await openApp(page);check(await page.locator('#storage-alert').isVisible()&&await page.locator('#add-button').isDisabled(),'corrupted storage visibly blocks accidental overwrite');check(await page.evaluate(()=>localStorage.getItem('flowtrack.v1'))==='unreadable-data','corrupt original is preserved');
 await context.close();
 const systemContext=await browser.newContext({colorScheme:'dark'});const systemPage=await systemContext.newPage();await systemPage.goto(origin);await openApp(systemPage);
 check(await systemPage.locator('html').getAttribute('data-theme')==='dark','first visit follows the device appearance');
 await systemPage.getByRole('button',{name:'Switch to light mode',exact:true}).click();await systemPage.reload();await openApp(systemPage);
 check(await systemPage.locator('html').getAttribute('data-theme')==='light','explicit light preference overrides dark device appearance');
 const themePeer=await systemContext.newPage();await themePeer.goto(origin);await openApp(themePeer);await themePeer.getByRole('button',{name:'Switch to dark mode',exact:true}).click();await systemPage.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
 check(await systemPage.locator('html').getAttribute('data-theme')==='dark','theme preference synchronizes between tabs');await systemContext.close();
 const blocked=await browser.newContext({colorScheme:'light'});await blocked.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}});});const bp=await blocked.newPage();await bp.goto(origin);await bp.locator('#setup-screen').waitFor({state:'visible'});check((await bp.locator('#setup-error').innerText()).includes('cannot securely save'),'blocked storage explains why PIN setup cannot proceed');check(await bp.locator('#setup-pin').isDisabled()&&await bp.locator('#app-shell').isHidden(),'unavailable storage cannot silently bypass required PIN protection');await blocked.close();
 check(errors.length===0,'no JavaScript runtime errors');console.log(`Browser QA complete: ${passed} assertions passed.`);
}finally{await browser.close();}

