import {build,transform} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
await build({absWorkingDir:fileURLToPath(new URL('.',import.meta.url)),entryPoints:['./src/app.mjs'],bundle:true,minify:true,format:'esm',target:['es2022'],tsconfigRaw:{},outfile:'dist/app-v13.mjs',external:['./device-v1.mjs'],legalComments:'none'});
const css=await transform(await readFile('src/styles.css','utf8'),{loader:'css',minify:true,target:['es2022']});await writeFile('dist/styles-v10.css',css.code);
const theme=await readFile('dist/theme.js','utf8'),hash=createHash('sha256').update(theme).digest('base64');
let html=await readFile('src/index.html','utf8');html=html.replace('__THEME_CSP__',`'sha256-${hash}'`).replace('<!-- FLOWTRACK_THEME -->',()=>`<script>${theme}</script>`);await writeFile('dist/index.html',html);
console.log('Built the bundled app, compact styles and CSP-authorized theme bootstrap.');
