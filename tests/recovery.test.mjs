import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LedgerVault} from '../dist/vault-v6.mjs';
import {LedgerVault as LegacyVault} from '../dist/vault-v3.mjs';
import {STORAGE_KEY} from '../dist/core.mjs';
const ledger={version:1,currency:'NGN',transactions:[{id:'first',description:'Recovery test entry',amount:78901,type:'income',date:'2026-10-16',tags:['Work']}]};
function storage(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
function setup(){const store=storage();store.setItem(STORAGE_KEY,JSON.stringify(ledger));const vault=new LedgerVault(store);vault.load();return {store,vault};}
test('setup is staged until recovery-key confirmation; cancellation preserves plaintext',async()=>{
 const {store,vault}=setup(),before=store.getItem(STORAGE_KEY),draft=await vault.preparePin('8392',ledger);
 assert.match(draft.recoveryKey,/^(?:[0-9A-F]{8}-){7}[0-9A-F]{8}$/);assert.equal(store.getItem(STORAGE_KEY),before);vault.discardPrepared(draft);assert.throws(()=>vault.commitPrepared(draft),/expired/);assert.equal(store.getItem(STORAGE_KEY),before);
});
test('recovery resets PIN with the exact latest records and rotates the recovery key',async()=>{
 const {store,vault}=setup(),recovery=await vault.setPin('8392',ledger);assert.equal(vault.hasRecovery,true);assert.ok(!store.getItem(STORAGE_KEY).includes(recovery.replaceAll('-','')));
 const latest={...ledger,transactions:[...ledger.transactions,{...ledger.transactions[0],id:'second',description:'Later record',amount:1299,type:'expense'}]};await vault.save(latest);vault.lock();const before=store.getItem(STORAGE_KEY);
 await assert.rejects(vault.prepareReset('00'.repeat(32),'5284'),/Incorrect recovery/);assert.equal(store.getItem(STORAGE_KEY),before);
 const reset=await vault.prepareReset(recovery.toLowerCase().replaceAll('-',' '),'5284');assert.equal(store.getItem(STORAGE_KEY),before);assert.deepEqual(vault.commitPrepared(reset),latest);assert.notEqual(reset.recoveryKey,recovery);
 vault.lock();await assert.rejects(vault.unlock('8392'),/Incorrect PIN/);assert.deepEqual(await vault.unlock('5284'),latest);await assert.rejects(vault.prepareReset(recovery,'1239'),/Incorrect recovery/);assert.ok((await vault.prepareReset(reset.recoveryKey,'1239')).recoveryKey);
});
test('changing the PIN rotates the recovery key and preserves the ledger',async()=>{
 const {vault}=setup(),recovery=await vault.setPin('8392',ledger);const change=await vault.preparePin('5284',ledger,'8392');assert.notEqual(change.recoveryKey,recovery);vault.commitPrepared(change);vault.lock();await assert.rejects(vault.prepareReset(recovery,'1239'),/Incorrect recovery/);const reset=await vault.prepareReset(change.recoveryKey,'1239');assert.deepEqual(vault.commitPrepared(reset),ledger);
});
test('a legacy PIN can gain recovery without changing its PIN or losing records',async()=>{
 const {store}=setup(),legacy=new LegacyVault(store);legacy.load();await legacy.setPin('839271',ledger);assert.equal(JSON.parse(store.getItem(STORAGE_KEY)).version,1);
 const vault=new LedgerVault(store);vault.load();assert.equal(vault.hasRecovery,false);await assert.rejects(vault.prepareReset('00'.repeat(32),'5284'),/not set up/);assert.deepEqual(await vault.unlock('839271'),ledger);
 const draft=await vault.prepareRecovery('839271');assert.equal(JSON.parse(store.getItem(STORAGE_KEY)).version,1);vault.commitPrepared(draft);vault.lock();assert.deepEqual(await vault.unlock('839271'),ledger);vault.lock();assert.deepEqual(vault.commitPrepared(await vault.prepareReset(draft.recoveryKey,'5284')),ledger);
});
test('replacing recovery requires the current PIN; old keys stop working on the current ledger',async()=>{
 const {store,vault}=setup(),old=await vault.setPin('8392',ledger),before=store.getItem(STORAGE_KEY);await assert.rejects(vault.prepareRecovery('0000'),/Incorrect PIN/);assert.equal(store.getItem(STORAGE_KEY),before);
 const draft=await vault.prepareRecovery('8392');vault.commitPrepared(draft);await assert.rejects(vault.prepareReset(old,'5284'),/Incorrect recovery/);assert.ok((await vault.prepareReset(draft.recoveryKey,'5284')).recoveryKey);
});
test('failed or stale recovery commits preserve the original PIN and recovery route',async()=>{
 const {store,vault}=setup(),key=await vault.setPin('8392',ledger);vault.lock();const draft=await vault.prepareReset(key,'5284'),before=store.getItem(STORAGE_KEY),write=store.setItem;store.setItem=()=>{throw Error('Quota exceeded');};assert.throws(()=>vault.commitPrepared(draft),/Quota/);assert.equal(store.getItem(STORAGE_KEY),before);store.setItem=write;assert.deepEqual(await vault.unlock('8392'),ledger);
 const stale=await vault.prepareReset(key,'5284');vault.lock();assert.throws(()=>vault.commitPrepared(stale),/expired/);assert.equal(store.getItem(STORAGE_KEY),before);
});
test('locked copies retain their matching recovery key and tampering cannot reset them',async()=>{
 const {vault,store}=setup(),key=await vault.setPin('8392',ledger),copy=JSON.parse(store.getItem(STORAGE_KEY));const replacement=await vault.prepareRecovery('8392');vault.commitPrepared(replacement);vault.replaceLocked(copy);assert.deepEqual(vault.commitPrepared(await vault.prepareReset(key,'5284')),ledger);
 const broken=JSON.parse(store.getItem(STORAGE_KEY));broken.recovery.ciphertext=(broken.recovery.ciphertext[0]==='A'?'B':'A')+broken.recovery.ciphertext.slice(1);vault.replaceLocked(broken);const before=store.getItem(STORAGE_KEY);await assert.rejects(vault.prepareReset(key,'1239'));assert.equal(store.getItem(STORAGE_KEY),before);
});
test('reusing an old key wrapper cannot unlock the current rotated ledger',async()=>{
 const {vault,store}=setup(),oldKey=await vault.setPin('8392',ledger),old=JSON.parse(store.getItem(STORAGE_KEY));vault.commitPrepared(await vault.prepareRecovery('8392'));const current=JSON.parse(store.getItem(STORAGE_KEY));assert.notEqual(current.ciphertext,old.ciphertext);current.recovery=old.recovery;vault.replaceLocked(current);await assert.rejects(vault.prepareReset(oldKey,'5284'),/Incorrect recovery/);
});
