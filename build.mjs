import {build,transform} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
await build({absWorkingDir:fileURLToPath(new URL('.',import.meta.url)),entryPoints:['./src/app.mjs'],bundle:true,minify:true,format:'esm',target:['es2022'],tsconfigRaw:{},outfile:'dist/app-v16.mjs',external:['./device-v1.mjs','./history-pdf-v1.mjs','./account-v1.mjs'],legalComments:'none'});
await build({entryPoints:['./src/account.mjs'],bundle:true,minify:true,format:'esm',target:['es2022'],outfile:'dist/account-v1.mjs',legalComments:'eof'});
// PDF creation loads only when requested; its font and code also work offline.
await build({entryPoints:['./src/history-pdf.mjs'],bundle:true,minify:true,format:'esm',target:['es2022'],outfile:'dist/history-pdf-v1.mjs',loader:{'.ttf':'base64'},external:['html2canvas','dompurify','canvg'],legalComments:'eof'});
await writeFile('dist/history-pdf-licenses.txt',await readFile('node_modules/jspdf/LICENSE','utf8')+'\n\nNoto Sans font:\n'+await readFile('src/NotoSans-OFL.txt','utf8'));
const css=await transform(await readFile('src/styles.css','utf8'),{loader:'css',minify:true,target:['es2022']});await writeFile('dist/styles-v13.css',css.code);
const theme=(await readFile('dist/theme.js','utf8')).replace(/\r\n?/g,'\n'),hash=createHash('sha256').update(theme).digest('base64');
const gate=await transform(await readFile('src/gate.css','utf8'),{loader:'css',minify:true,target:['es2022']});
const startup=await transform(await readFile('src/startup.mjs','utf8'),{loader:'js',format:'iife',minify:true,target:['es2020']});
const startupHash=createHash('sha256').update(startup.code).digest('base64');
const awaitAccount=await readFile('src/account-dialog.html','utf8');
const config=JSON.parse(await readFile('subscription.config.json','utf8'));
let connect='';if(config.enabled){const url=new URL(config.apiUrl);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||config.offlinePublicKey?.kty!=='RSA'||!config.offlinePublicKey?.n||!config.offlinePublicKey?.e||config.offlinePublicKey.d)throw Error('Invalid public subscription config');connect=' '+url.origin;}
let html=await readFile('src/index.html','utf8');html=html.replace('<!-- FLOWTRACK_ACCOUNT -->',()=>awaitAccount).replace('__ACCOUNT_CONNECT__',connect);html=html.replace('__STARTUP_CSP__',`'sha256-${startupHash}'`).replace('<!-- FLOWTRACK_GATE_STYLES -->',()=>`<style>${gate.code}</style>`).replace('<!-- FLOWTRACK_STARTUP -->',()=>`<script>${startup.code}</script>`).replace('__THEME_CSP__',`'sha256-${hash}'`).replace('<!-- FLOWTRACK_THEME -->',()=>`<script>${theme}</script>`);await writeFile('dist/index.html',html);await writeFile('dist/open.html',html);
console.log('Built the bundled app, compact styles and CSP-authorized theme bootstrap.');
await import('./build-account-portal.mjs');
