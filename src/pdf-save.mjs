// Keep a prepared PDF on this device until the user chooses a destination.
// Sharing starts directly from the button click, after asynchronous PDF creation.
export function initPDFSave({document=globalThis.document,navigator=globalThis.navigator,File=globalThis.File,download,notify}){
 const get=id=>document.getElementById(id),dialog=get('pdf-save-dialog'),save=get('pdf-save-mobile'),downloadButton=get('pdf-save-download'),status=get('pdf-save-status'),name=get('pdf-save-name');
 let pending=null,busy=false;
 function clear(){pending=null;busy=false;name.textContent='';status.textContent='';save.disabled=false;downloadButton.disabled=false;if(dialog.open)dialog.close();}
 function current(){if(!pending||!pending.isCurrent()){clear();return null;}return pending;}
 function delivered(record){if(!record.delivered){record.delivered=true;record.onDelivered();}}
 function prepare(bytes,filename,{isCurrent=()=>true,onDelivered=()=>{}}={}){
  clear();if(!isCurrent())return;
  let file=null,canShare=false;
  try{file=File?new File([bytes],filename,{type:'application/pdf'}):null;canShare=!!(file&&navigator?.share&&navigator?.canShare?.({files:[file]}));}catch{}
  pending={bytes,filename,file,isCurrent,onDelivered,delivered:false};name.textContent=filename;save.hidden=!canShare;
  get('pdf-save-hint').textContent=canShare?'Choose Save to mobile, then select a save location in your device’s share menu.':'Use Download PDF, then find the file in Downloads or Files.';
  downloadButton.className='button '+(canShare?'secondary':'primary');dialog.showModal();(canShare?save:downloadButton).focus();
 }
 downloadButton.addEventListener('click',()=>{
  const record=current();if(!record||busy)return;
  download(record.bytes,record.filename,'application/pdf');delivered(record);clear();notify('PDF download started. Keep it private.');
 });
 save.addEventListener('click',async()=>{
  const record=current();if(!record||busy)return;busy=true;save.disabled=true;downloadButton.disabled=true;status.textContent='Opening save options…';
  try{
   // No await before share: this tap supplies the required user activation.
   await navigator.share({files:[record.file]});
   if(pending===record&&record.isCurrent()){delivered(record);clear();notify('PDF handed to your device. Keep it private.');}
  }catch(error){if(pending===record)status.textContent=error?.name==='AbortError'?'Save cancelled. Your PDF is still ready.':'Mobile saving is unavailable here. Use Download PDF instead.';}
  finally{if(pending===record){busy=false;save.disabled=false;downloadButton.disabled=false;}}
 });
 get('pdf-save-close').addEventListener('click',clear);dialog.addEventListener('cancel',()=>clear());dialog.addEventListener('close',()=>{if(!dialog.open){pending=null;name.textContent='';status.textContent='';}});
 return {prepare,clear};
}
