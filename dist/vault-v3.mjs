import {STORAGE_KEY,validateState} from './core.mjs';
const ITERATIONS=600000;
const aad=new TextEncoder().encode('FlowTrack vault v1');
const encode=bytes=>{let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);};
const decode=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
export const isVault=value=>!!value&&value.format==='flowtrack-vault';
export function validateVault(value){
  if(!isVault(value)||value.version!==1||value.iterations!==ITERATIONS||typeof value.salt!=='string'||typeof value.iv!=='string'||typeof value.ciphertext!=='string'||value.ciphertext.length>32*1024*1024)throw Error('Unsupported locked backup.');
  for(const field of ['salt','iv','ciphertext'])if(!/^[A-Za-z0-9+/]+={0,2}$/.test(value[field]))throw Error('Damaged locked backup.');
  if(decode(value.salt).length!==16||decode(value.iv).length!==12||decode(value.ciphertext).length<16)throw Error('Damaged locked backup.');
  return {format:'flowtrack-vault',version:1,iterations:ITERATIONS,salt:value.salt,iv:value.iv,ciphertext:value.ciphertext};
}
export function validatePin(pin){if(typeof pin!=='string'||!/^\d{6,12}$/.test(pin))throw Error('Use 6–12 digits. A longer PIN is stronger.');return pin;}
async function derive(pin,salt){
  validatePin(pin);
  if(!globalThis.crypto?.subtle)throw Error('PIN encryption needs HTTPS and a supported browser.');
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function seal(value,key,salt){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,new TextEncoder().encode(JSON.stringify(validateState(value))));
  return {format:'flowtrack-vault',version:1,iterations:ITERATIONS,salt:encode(salt),iv:encode(iv),ciphertext:encode(new Uint8Array(ciphertext))};
}
async function unseal(envelope,key){
  let plain;
  try{plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(envelope.iv),additionalData:aad},key,decode(envelope.ciphertext));}
  catch{throw Error('Incorrect PIN or damaged locked data.');}
  return validateState(JSON.parse(new TextDecoder().decode(plain)));
}
export class LedgerVault {
  #key=null;
  #salt=null;
  #envelope=null;
  #snapshot=null;
  #epoch=0;
  constructor(storage){this.storage=storage;}
  get enabled(){return this.#envelope!==null;}
  get locked(){return this.enabled&&!this.#key;}
  get raw(){return this.#snapshot;}
  load(){
    this.lock();this.#envelope=null;
    this.#snapshot=this.storage.getItem(STORAGE_KEY);
    if(this.#snapshot===null)return null;
    const value=JSON.parse(this.#snapshot);
    if(isVault(value)){this.#envelope=validateVault(value);return null;}
    return validateState(value);
  }
  #unchanged(snapshot,epoch){if(epoch!==this.#epoch||this.storage.getItem(STORAGE_KEY)!==snapshot)throw Error('The ledger changed or locked. Reopen it before continuing.');}
  async unlock(pin){
    if(!this.enabled)throw Error('No PIN is set.');
    const snapshot=this.#snapshot,epoch=this.#epoch,envelope=this.#envelope;
    const salt=decode(envelope.salt),key=await derive(pin,salt),value=await unseal(envelope,key);
    this.#unchanged(snapshot,epoch);this.#key=key;this.#salt=salt;return value;
  }
  lock(){this.#epoch++;this.#key=null;this.#salt=null;}
  async save(value){
    value=validateState(value);const snapshot=this.#snapshot,epoch=this.#epoch;
    if(this.locked)throw Error('Unlock FlowTrack first.');
    const envelope=this.enabled?await seal(value,this.#key,this.#salt):null;
    const raw=JSON.stringify(envelope||value);this.#unchanged(snapshot,epoch);
    this.storage.setItem(STORAGE_KEY,raw);this.#snapshot=raw;this.#envelope=envelope;
  }
  async checkPin(pin){
    if(!this.enabled)throw Error('No PIN is set.');
    const snapshot=this.#snapshot,epoch=this.#epoch,key=await derive(pin,decode(this.#envelope.salt));
    const value=await unseal(this.#envelope,key);this.#unchanged(snapshot,epoch);return value;
  }
  async setPin(pin,value,currentPin){
    const snapshot=this.#snapshot,epoch=this.#epoch;
    if(this.enabled)await this.checkPin(currentPin);
    const salt=crypto.getRandomValues(new Uint8Array(16)),key=await derive(pin,salt),envelope=await seal(value,key,salt),raw=JSON.stringify(envelope);
    this.#unchanged(snapshot,epoch);this.storage.setItem(STORAGE_KEY,raw);
    this.#snapshot=raw;this.#envelope=envelope;this.#key=key;this.#salt=salt;
  }
  async removePin(pin){
    const value=await this.checkPin(pin);const raw=JSON.stringify(value);
    this.storage.setItem(STORAGE_KEY,raw);this.lock();this.#snapshot=raw;this.#envelope=null;return value;
  }
  replaceLocked(value){
    const envelope=validateVault(value),raw=JSON.stringify(envelope);
    this.#unchanged(this.#snapshot,this.#epoch);this.storage.setItem(STORAGE_KEY,raw);this.lock();this.#snapshot=raw;this.#envelope=envelope;
  }
  clear(){this.#unchanged(this.#snapshot,this.#epoch);this.storage.removeItem(STORAGE_KEY);this.lock();this.#snapshot=null;this.#envelope=null;}
}
