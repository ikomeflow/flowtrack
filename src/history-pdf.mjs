import {jsPDF} from 'jspdf';
import font from './NotoSans-Regular.ttf';
import {totals} from '../dist/core-v2.mjs';

const ink=[23,43,77],muted=[95,111,135],blue=[21,87,232],line=[226,232,240];
const clean=value=>String(value).normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').replace(/\s+/g,' ').trim();
const localDate=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
// Format the two minor-unit digits separately to preserve exact large totals.
const number=cents=>`${cents<0?'-':''}${Math.floor(Math.abs(cents)/100).toLocaleString('en-GB')}.${String(Math.abs(cents)%100).padStart(2,'0')}`;

/** Generate a real, searchable PDF entirely on the device. No network requests. */
export async function createHistoryPDF(rows,currency,{period='All time',type='All types',query='',sample=false,generatedAt=new Date(),isCurrent=()=>true}={}){
 const doc=new jsPDF({unit:'pt',format:'a4',compress:true,putOnlyUsedFonts:true});
 doc.addFileToVFS('NotoSans.ttf',font);doc.addFont('NotoSans.ttf','NotoSans','normal');doc.setFont('NotoSans');
 doc.setProperties({title:'FlowTrack transaction history',subject:sample?'Sample transaction history':'Transaction history',author:'FlowTrack',creator:'FlowTrack'});
 const glyphs=doc.getFont().metadata.cmap.unicode.codeMap;
 const left=40,right=doc.internal.pageSize.getWidth()-40,bottom=doc.internal.pageSize.getHeight()-54,width=right-left;
 let y=0;
 const hasGlyphs=text=>[...text].every(char=>char===' '||glyphs[char.codePointAt(0)]);
 // Preserve text in other scripts and emoji using local system-font rendering
 // when the bundled font has no glyph. Normal text remains selectable.
 let canvas,context;
 function canvasContext(size){
  if(!context){if(typeof document==='undefined')throw Error('This text needs browser font rendering.');canvas=document.createElement('canvas');context=canvas.getContext('2d');if(!context)throw Error('Font rendering unavailable.');}
  context.font=`${size}px "Noto Sans", Arial, sans-serif`;return context;
 }
 function measure(text,size){doc.setFontSize(size);return hasGlyphs(text)?doc.getTextWidth(text):canvasContext(size).measureText(text).width;}
 function wrap(value,maxWidth,size){
  const text=clean(value);if(!text)return [];
  if(hasGlyphs(text)){doc.setFontSize(size);return doc.splitTextToSize(text,maxWidth);}
  const result=[];let current='';
  const chars=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text)].map(x=>x.segment):[...text];
  for(const char of chars){if(current&&measure(current+char,size)>maxWidth){result.push(current.trim());current=char.trimStart();}else current+=char;}
  if(current)result.push(current.trim());return result;
 }
 function text(value,x,baseline,size=10,color=ink,align='left'){
  const valueText=clean(value);if(!valueText)return;
  doc.setFontSize(size);doc.setTextColor(...color);
  if(hasGlyphs(valueText)){doc.text(valueText,x,baseline,{align});return;}
  const ctx=canvasContext(size),w=Math.ceil(ctx.measureText(valueText).width+4),h=Math.ceil(size*1.7),scale=3;
  canvas.width=w*scale;canvas.height=h*scale;ctx.scale(scale,scale);ctx.font=`${size}px "Noto Sans", Arial, sans-serif`;ctx.fillStyle=`rgb(${color.join(',')})`;ctx.textBaseline='alphabetic';ctx.fillText(valueText,0,size*1.15);
  doc.addImage(canvas.toDataURL('image/png'),'PNG',align==='right'?x-w:x,baseline-size*1.15,w,h);
 }
 function rule(at){doc.setDrawColor(...line);doc.setLineWidth(.5);doc.line(left,at,right,at);}
 function tableHeading(){
  doc.setFillColor(246,248,252);doc.rect(left,y-14,width,26,'F');
  text('Date',left+8,y,9,muted);text('Transaction / tags',112,y,9,muted);text('Type',358,y,9,muted);text(`Amount (${currency})`,right-8,y,9,muted,'right');y+=24;
 }
 function continuedPage(){doc.addPage();text('FlowTrack.',left,42,17,blue);text('Transaction history',right,42,10,muted,'right');y=76;tableHeading();}
 text('FlowTrack.',left,48,22,blue);
 if(sample)text('SAMPLE DATA',right,48,10,muted,'right');
 text('Transaction history',left,88,22);
 y=110;
 for(const heading of [`${period}  /  ${type}`,query?`Search: ${query}`:'']){
  for(const item of wrap(heading,width,10)){text(item,left,y,10,muted);y+=15;}
 }
 const count=`${rows.length.toLocaleString('en-GB')} ${rows.length===1?'transaction':'transactions'}`;
 const dates=rows.map(t=>t.date).sort();
 text(count+(dates.length?`  /  ${dates[0]} to ${dates.at(-1)}`:''),left,y+3,9,muted);y+=30;
 const sum=totals(rows),column=width/3;
 for(const [index,label,value] of [[0,'Income',sum.income],[1,'Expenses',sum.expense],[2,'Net change',sum.net]]){
  const x=left+index*column;text(label,x,y,9,muted);
  const total=`${currency} ${number(value)}`,size=Math.min(15,15*(column-12)/Math.max(column-12,measure(total,15)));
  text(total,x,y+24,size,index===2?blue:ink);
 }
 y+=45;text('Net change is income minus expenses in these results.',left,y,8,muted);y+=32;tableHeading();
 if(!rows.length){text('No transactions in these results.',left+8,y+8,10,muted);}
 for(let index=0;index<rows.length;index++){
  if(index%100===0){await new Promise(resolve=>setTimeout(resolve,0));if(!isCurrent())throw new DOMException('PDF cancelled','AbortError');}
  const row=rows[index],description=wrap(row.description,230,10),tags=wrap(row.tags.length?`Tags: ${row.tags.join(', ')}`:'',230,8);
  const height=Math.max(42,description.length*14+(tags.length?5+tags.length*12:0)+19);
  if(y+height>bottom)continuedPage();
  text(row.date,left+8,y+2,9,muted);
  let baseline=y+2;for(const item of description){text(item,112,baseline,10);baseline+=14;}
  if(tags.length){baseline+=3;for(const item of tags){text(item,112,baseline,8,muted);baseline+=12;}}
  text(row.type==='income'?'Income':'Expense',358,y+2,9,muted);
  text(`${row.type==='income'?'+':'-'}${number(row.amount)}`,right-8,y+2,10,row.type==='income'?[20,105,83]:ink,'right');
  y+=height;rule(y-14);
 }
 if(!isCurrent())throw new DOMException('PDF cancelled','AbortError');
 const pages=doc.getNumberOfPages();
 for(let page=1;page<=pages;page++){
  doc.setPage(page);rule(bottom+14);text(`Private / Generated on this device / ${localDate(generatedAt)}`,left,bottom+31,8,muted);text(`${page} / ${pages}`,right,bottom+31,8,muted,'right');
 }
 return doc.output('arraybuffer');
}
