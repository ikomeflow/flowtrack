import {createRequire} from 'node:module';import {join} from 'node:path';import assert from 'node:assert/strict';import {openApp,writeLedger,readLedger} from './helpers.mjs';
const require=createRequire(join(process.env.FLOWTRACK_QA_PACKAGE_ROOT,'package.json')),{chromium}=require('playwright'),browser=await chromium.launch({headless:true,executablePath:process.env.FLOWTRACK_QA_BROWSER});
const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.FLOWTRACK_QA_URL||'http://127.0.0.1:4173');await openApp(page);
 const rows=[['2026-11-02','income',10000],['2026-11-03','expense',1000],['2026-11-09','expense',2000],['2026-10-01','income',50000],['2026-01-01','income',70000]].map(([date,type,amount],i)=>({id:'test-'+i,date,type,amount,description:'Sample '+i,tags:['Work']}));
 await writeLedger(page,{version:1,currency:'BYN',transactions:rows});await page.reload();await openApp(page);const before=await page.evaluate(()=>localStorage.getItem('flowtrack.v1'));
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});for(const kind of ['day','week','month','year']){
  await page.locator('nav a[data-view=overview]').click();await page.locator('#usage-period').selectOption(kind);if(kind==='month')await page.locator('#overview-month').fill('2026-11');else await page.locator('#usage-date').fill('2026-11-02');
  const expected={day:'100.00',week:'90.00',month:'70.00',year:'1,270.00'}[kind];assert.ok((await page.locator('#net-value').innerText()).includes(expected),kind+' exact total');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'home width '+width+' '+kind);
  await page.locator('nav a[data-view=reports]').click();assert.ok((await page.locator('#report-totals').innerText()).includes(expected));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'reports width '+width+' '+kind);
 }}
 assert.equal(await page.evaluate(()=>localStorage.getItem('flowtrack.v1')),before);assert.deepEqual((await readLedger(page)).transactions,rows);
 await page.setViewportSize({width:390,height:844});await page.locator('nav a[data-view=overview]').click();await page.locator('#usage-period').selectOption('week');const decline=page.getByRole('button',{name:'No thanks',exact:true});if(await decline.isVisible())await decline.click();await page.screenshot({path:join(process.env.FLOWTRACK_QA_OUTPUT,'flowtrack-weekly.png'),fullPage:true});
 await context.setOffline(true);await page.reload();await openApp(page);await page.locator('#usage-period').selectOption('year');assert.equal((await readLedger(page)).currency,'BYN');assert.deepEqual(errors,[]);console.log('PASS all four periods: exact totals, matching reports, 320/390/768/1440 layouts, unchanged encrypted records and offline reopening.');
}finally{await browser.close();}
