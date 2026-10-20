// Test only local builds in disposable profiles; never use a user's app storage.
import {createRequire} from 'node:module';
import {readFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname,join} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const name=process.env.QA_APP||JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).name,root=new URL('../dist/',import.meta.url);
const output=process.env.QA_OUTPUT||'test-results';await mkdir(output,{recursive:true});
const gate=name==='biztrack'?'#security-gate':'#setup-screen';
const html=await readFile(new URL('index.html',root),'utf8');
const start=html.indexOf('<div id="startup"'),split=html.indexOf('</script>',start)+9;
assert.ok(split>start&&html.indexOf('id="app-entry"')>split,'recovery runs before module request and remaining HTML');
let release;
const server=createServer(async(req,res)=>{
 const [scope,...parts]=new URL(req.url,'http://localhost').pathname.split('/').filter(Boolean);
 const file=parts.join('/')||'index.html';
 if(file.includes('..')){res.writeHead(404).end();return;}
 try{
  const bytes=await readFile(new URL(file,root));
  res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'})[extname(file)]||'application/octet-stream');
  res.setHeader('Cache-Control','no-store');
  if(scope==='stream'&&file==='index.html'){
   res.write(html.slice(0,split));release=()=>res.end(html.slice(split));return;
  }
  if(scope==='crash'&&/^app-v\d+\.mjs$/.test(file)){res.end('throw new Error("Synthetic startup failure");');return;}
  if(scope==='failed'&&/^app-v\d+\.mjs$/.test(file)){res.writeHead(503).end();return;}
  res.end(bytes);
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:'dark',serviceWorkers:'block'});
 const page=await context.newPage();
 await page.goto(base+'/stream/',{waitUntil:'commit'});
 await page.locator('#startup').waitFor({state:'visible'});
 assert.equal(await page.evaluate(()=>document.readyState),'loading');
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
 await page.locator('#startup-retry').waitFor({state:'visible',timeout:12000});
 assert.equal(await page.locator('#startup-message').innerText(),'Slow connection. You can retry.');
 await page.screenshot({path:join(output,name+'-slow-first-visit.png')});
 console.log('PASS visible loading and Retry while the HTML download is stalled');
 release();await page.locator(gate).waitFor({state:'visible'});
 assert.equal(await page.evaluate(()=>localStorage.length),0);
 console.log('PASS delayed first visit resumes into PIN setup without writing records');
 for(const scope of ['failed','crash']){
  await page.goto(base+'/'+scope+'/');
  await page.locator('#startup-retry').waitFor({state:'visible',timeout:3000});
  assert.equal(await page.locator('#startup-message').innerText(),'Download interrupted. Retry to open.');
  console.log('PASS '+scope+' module exposes recovery immediately');
 }
 const slow=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 const p=await slow.newPage(),cdp=await slow.newCDPSession(p);
 await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:400,downloadThroughput:50*1024,uploadThroughput:20*1024});
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 const began=Date.now();await p.goto(base+'/throttled/',{waitUntil:'commit'});
 await p.locator('#startup').waitFor({state:'visible'});
 await p.locator(gate).waitFor({state:'visible',timeout:30000});
 console.log('PASS fresh PIN setup on 50 KB/s, 400 ms latency, 4x CPU: '+(Date.now()-began)+' ms');
 await browser.close();
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
