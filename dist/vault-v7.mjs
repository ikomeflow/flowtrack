import {STORAGE_KEY,validateState} from './core.mjs';
const ITERATIONS=600000;
const enc=new TextEncoder(),dec=new TextDecoder();
const encode=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export const isVault=v=>!!v&&v.format==='flowtrack-vault';
function bytes(s,min,max=min){if(typeof s!=='string'||s.length>32*1024*1024||!/^[A-Za-z0-9+/]+={0,2}$/.test(s))throw Error('Damaged locked backup.');const b=decode(s);if(b.length<min||b.length>max)throw Error('Damaged locked backup.');return b;}
function wrapped(v){if(!v||typeof v!=='object')throw Error('Damaged recovery settings.');bytes(v.iv,12);bytes(v.ciphertext,48);return {iv:v.iv,ciphertext:v.ciphertext};}
function deviceDescriptor(v){
 if(!v||typeof v!=='object'||typeof v.id!=='string'||!/^[A-Za-z0-9_-]{1,2048}$/.test(v.id)||typeof v.salt!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(v.salt)||typeof v.rpId!=='string'||v.rpId.length>253||!/^[a-zA-Z0-9.-]+$/.test(v.rpId))throw Error('Damaged device unlock settings.');
 return {id:v.id,salt:v.salt,rpId:v.rpId,...wrapped(v)};
}
function deviceKey(secret){if(!(secret instanceof Uint8Array)||secret.length!==32)throw Error('Secure device unlock is unavailable. Use your PIN.');return aes(secret);}
const deviceLabel=d=>`FlowTrack device v1:${d.rpId}:${d.id}:${d.salt}`;
export function validateVault(v){
 if(!isVault(v)||![1,2].includes(v.version)||v.iterations!==ITERATIONS)throw Error('Unsupported locked backup.');
 bytes(v.salt,16);bytes(v.iv,12);bytes(v.ciphertext,16,24*1024*1024);
 const result={format:'flowtrack-vault',version:v.version,iterations:ITERATIONS,salt:v.salt,iv:v.iv,ciphertext:v.ciphertext};
 if(v.version===2){result.pin=wrapped(v.pin);result.recovery=v.recovery===null?null:wrapped(v.recovery);if(v.device!==undefined){try{result.device=deviceDescriptor(v.device);}catch{/* Damaged optional quick unlock must not disable PIN/recovery access. */}}}return result;
}
export function validatePin(pin){if(typeof pin!=='string'||!/^\d{4}$/.test(pin))throw Error('Use exactly 4 digits.');return pin;}
const aes=raw=>crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);
async function derive(pin,salt){
 if(typeof pin!=='string'||! /^(?:\d{4}|\d{6,12})$/.test(pin))throw Error('Enter your PIN.');if(!globalThis.crypto?.subtle)throw Error('PIN encryption needs HTTPS and a supported browser.');
 const material=await crypto.subtle.importKey('raw',enc.encode(pin),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function encrypt(raw,key,label){const iv=crypto.getRandomValues(new Uint8Array(12)),ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(label)},key,raw);return {iv:encode(iv),ciphertext:encode(new Uint8Array(ciphertext))};}
async function decrypt(value,key,label){return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(value.iv),additionalData:enc.encode(label)},key,decode(value.ciphertext)));}
const dataLabel=v=>`FlowTrack vault v${v}`;
async function readData(value,key){return validateState(JSON.parse(dec.decode(await decrypt(value,key,dataLabel(value.version)))));}
const writeData=(value,key,version=2)=>encrypt(enc.encode(JSON.stringify(validateState(value))),key,dataLabel(version));
function recoveryBytes(text){const normalized=String(text).replace(/[\s-]/g,'').toUpperCase();if(!/^[0-9A-F]{64}$/.test(normalized))throw Error('Enter the complete recovery key.');return Uint8Array.from(normalized.match(/../g),x=>parseInt(x,16));}
async function recoveryWrap(dataKey){const secret=crypto.getRandomValues(new Uint8Array(32));return {text:[...secret].map(x=>x.toString(16).padStart(2,'0').toUpperCase()).join('').match(/.{8}/g).join('-'),wrapped:await encrypt(dataKey,await aes(secret),'FlowTrack recovery v2')};}
export class LedgerVault {
 #key=null;#envelope=null;#snapshot=null;#epoch=0;#drafts=new WeakMap();
 constructor(storage){this.storage=storage;}
 get enabled(){return this.#envelope!==null;}
 get hasRecovery(){return !!this.#envelope?.recovery;}
 get device(){return this.#envelope?.device?{...this.#envelope.device}:null;}
 get locked(){return this.enabled&&!this.#key;}
 get raw(){return this.#snapshot;}
 load(){this.lock();this.#envelope=null;this.#snapshot=this.storage.getItem(STORAGE_KEY);if(this.#snapshot===null)return null;const value=JSON.parse(this.#snapshot);if(isVault(value)){this.#envelope=validateVault(value);return null;}return validateState(value);}
 #unchanged(snapshot,epoch){if(epoch!==this.#epoch||this.storage.getItem(STORAGE_KEY)!==snapshot)throw Error('The ledger changed or locked. Reopen it before continuing.');}
 async #credentials(pin){
  if(!this.enabled)throw Error('No PIN is set.');const envelope=this.#envelope,pinKey=await derive(pin,decode(envelope.salt));
  try{const rawKey=envelope.version===2?await decrypt(envelope.pin,pinKey,'FlowTrack PIN v2'):null,key=rawKey?await aes(rawKey):pinKey;return {value:await readData(envelope,key),rawKey,key,pinKey};}
  catch{throw Error('Incorrect PIN or damaged locked data.');}
 }
 async unlock(pin){const snapshot=this.#snapshot,epoch=this.#epoch,auth=await this.#credentials(pin);this.#unchanged(snapshot,epoch);this.#key=auth.key;return auth.value;}
 async enableDevice(pin,descriptor){
  if(this.#envelope?.version!==2)throw Error('Update your PIN before enabling device unlock.');
  const snapshot=this.#snapshot,epoch=this.#epoch,auth=await this.#credentials(pin);
  const metadata=deviceDescriptor({...descriptor,iv:encode(new Uint8Array(12)),ciphertext:encode(new Uint8Array(48))});
  const device={id:metadata.id,salt:metadata.salt,rpId:metadata.rpId,...await encrypt(auth.rawKey,await deviceKey(descriptor.secret),deviceLabel(metadata))};
  const envelope={...this.#envelope,device},raw=JSON.stringify(envelope);this.#unchanged(snapshot,epoch);this.storage.setItem(STORAGE_KEY,raw);this.#snapshot=raw;this.#envelope=envelope;this.#key=auth.key;return auth.value;
 }
 async unlockDevice(secret){
  if(!this.device)throw Error('Device unlock is not set up. Use your PIN.');const snapshot=this.#snapshot,epoch=this.#epoch,envelope=this.#envelope;
  let key,value;try{key=await aes(await decrypt(envelope.device,await deviceKey(secret),deviceLabel(envelope.device)));value=await readData(envelope,key);}catch{throw Error('Device unlock failed. Use your PIN.');}
  this.#unchanged(snapshot,epoch);this.#key=key;return value;
 }
 lock(){this.#epoch++;this.#key=null;this.#drafts=new WeakMap();}
 async save(value){
  value=validateState(value);const snapshot=this.#snapshot,epoch=this.#epoch;if(this.locked)throw Error('Unlock FlowTrack first.');
  const envelope=this.enabled?{...this.#envelope,...await writeData(value,this.#key,this.#envelope.version)}:null,raw=JSON.stringify(envelope||value);
  this.#unchanged(snapshot,epoch);this.storage.setItem(STORAGE_KEY,raw);this.#snapshot=raw;this.#envelope=envelope;
 }
 async checkPin(pin){const snapshot=this.#snapshot,epoch=this.#epoch,auth=await this.#credentials(pin);this.#unchanged(snapshot,epoch);return auth.value;}
 #draft(envelope,key,value,snapshot,epoch,recoveryKey){const handle=Object.freeze({recoveryKey:recoveryKey||null});this.#drafts.set(handle,{envelope,key,value:validateState(value),snapshot,epoch});return handle;}
 async prepareSimplePin(pin,value,currentPin){
  validatePin(pin);value=validateState(value);const snapshot=this.#snapshot,epoch=this.#epoch,auth=this.enabled?await this.#credentials(currentPin):null;
  const rawKey=auth?.rawKey||crypto.getRandomValues(new Uint8Array(32)),key=await aes(rawKey),salt=crypto.getRandomValues(new Uint8Array(16)),pinKey=await derive(pin,salt);
  const envelope={...(this.#envelope?.version===2?this.#envelope:{}),format:'flowtrack-vault',version:2,iterations:ITERATIONS,salt:encode(salt),...await writeData(value,key),pin:await encrypt(rawKey,pinKey,'FlowTrack PIN v2'),recovery:this.#envelope?.recovery||null};
  this.#unchanged(snapshot,epoch);return this.#draft(envelope,key,value,snapshot,epoch);
 }
 async prepareSimpleReset(recoveryKey,newPin){
  if(!this.hasRecovery)throw Error('Recovery was not set up. Use the original PIN or a backup.');validatePin(newPin);
  const snapshot=this.#snapshot,epoch=this.#epoch;let rawKey,key,value;
  try{rawKey=await decrypt(this.#envelope.recovery,await aes(recoveryBytes(recoveryKey)),'FlowTrack recovery v2');key=await aes(rawKey);value=await readData(this.#envelope,key);}catch{throw Error('Incorrect recovery key or damaged locked data.');}
  const salt=crypto.getRandomValues(new Uint8Array(16)),pinKey=await derive(newPin,salt),envelope={...this.#envelope,salt:encode(salt),pin:await encrypt(rawKey,pinKey,'FlowTrack PIN v2')};
  this.#unchanged(snapshot,epoch);return this.#draft(envelope,key,value,snapshot,epoch);
 }
 async preparePin(pin,value,currentPin){
  validatePin(pin);value=validateState(value);const snapshot=this.#snapshot,epoch=this.#epoch,auth=this.enabled?await this.#credentials(currentPin):null;
  const rawKey=crypto.getRandomValues(new Uint8Array(32)),key=await aes(rawKey),salt=crypto.getRandomValues(new Uint8Array(16)),pinKey=await derive(pin,salt);
  const recovery=await recoveryWrap(rawKey);
  const envelope={format:'flowtrack-vault',version:2,iterations:ITERATIONS,salt:encode(salt),...await writeData(value,key),pin:await encrypt(rawKey,pinKey,'FlowTrack PIN v2'),recovery:recovery.wrapped};
  this.#unchanged(snapshot,epoch);return this.#draft(envelope,key,value,snapshot,epoch,recovery.text);
 }
 async prepareRecovery(pin){
  const snapshot=this.#snapshot,epoch=this.#epoch,auth=await this.#credentials(pin),rawKey=crypto.getRandomValues(new Uint8Array(32)),key=await aes(rawKey),recovery=await recoveryWrap(rawKey);
  const envelope={format:'flowtrack-vault',version:2,iterations:ITERATIONS,salt:this.#envelope.salt,...await writeData(auth.value,key),pin:await encrypt(rawKey,auth.pinKey,'FlowTrack PIN v2'),recovery:recovery.wrapped};
  this.#unchanged(snapshot,epoch);return this.#draft(envelope,key,auth.value,snapshot,epoch,recovery.text);
 }
 async prepareReset(recoveryKey,newPin){
  if(!this.hasRecovery)throw Error('Recovery was not set up. Use the original PIN or a backup.');validatePin(newPin);
  const snapshot=this.#snapshot,epoch=this.#epoch;let rawKey,key,value;
  try{rawKey=await decrypt(this.#envelope.recovery,await aes(recoveryBytes(recoveryKey)),'FlowTrack recovery v2');key=await aes(rawKey);value=await readData(this.#envelope,key);}
  catch{throw Error('Incorrect recovery key or damaged locked data.');}
  rawKey=crypto.getRandomValues(new Uint8Array(32));key=await aes(rawKey);
  const salt=crypto.getRandomValues(new Uint8Array(16)),pinKey=await derive(newPin,salt),recovery=await recoveryWrap(rawKey);
  const {device:removedDevice,...previous}=this.#envelope;
  const envelope={...previous,...await writeData(value,key),salt:encode(salt),pin:await encrypt(rawKey,pinKey,'FlowTrack PIN v2'),recovery:recovery.wrapped};
  this.#unchanged(snapshot,epoch);return this.#draft(envelope,key,value,snapshot,epoch,recovery.text);
 }
 commitPrepared(handle){
  const draft=this.#drafts.get(handle);if(!draft)throw Error('Setup expired. Start again.');this.#unchanged(draft.snapshot,draft.epoch);
  const raw=JSON.stringify(draft.envelope);this.storage.setItem(STORAGE_KEY,raw);this.#snapshot=raw;this.#envelope=draft.envelope;this.#key=draft.key;this.#drafts.delete(handle);return validateState(draft.value);
 }
 discardPrepared(handle){if(handle)this.#drafts.delete(handle);}
 async setPin(pin,value,currentPin){const draft=await this.preparePin(pin,value,currentPin);this.commitPrepared(draft);return draft.recoveryKey;}
 async removePin(pin){const value=await this.checkPin(pin),raw=JSON.stringify(value);this.storage.setItem(STORAGE_KEY,raw);this.lock();this.#snapshot=raw;this.#envelope=null;return value;}
 replaceLocked(value){const envelope=validateVault(value),raw=JSON.stringify(envelope);this.#unchanged(this.#snapshot,this.#epoch);this.storage.setItem(STORAGE_KEY,raw);this.lock();this.#snapshot=raw;this.#envelope=envelope;}
 clear(){this.#unchanged(this.#snapshot,this.#epoch);this.storage.removeItem(STORAGE_KEY);this.lock();this.#snapshot=null;this.#envelope=null;}
}
