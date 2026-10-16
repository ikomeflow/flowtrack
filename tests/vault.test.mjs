import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LedgerVault,validateVault,validatePin} from '../dist/vault-v7.mjs';
import {STORAGE_KEY} from '../dist/core.mjs';
import {LedgerVault as PreviousVault} from '../dist/vault-v5.mjs';
const ledger={version:1,currency:'GHS',transactions:[{id:'private-id',description:'Private description',amount:12345,type:'income',date:'2026-10-16',tags:['Secret']}]};
function storage(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
function setup(){const store=storage();store.setItem(STORAGE_KEY,JSON.stringify(ledger));const vault=new LedgerVault(store);assert.deepEqual(vault.load(),ledger);return {store,vault};}

test('existing six-digit v2 PINs unlock and migrate to four digits without losing records',async()=>{
 const store=storage(),old=new PreviousVault(store);old.load();await old.setPin('839271',ledger);const before=store.getItem(STORAGE_KEY),vault=new LedgerVault(store);vault.load();assert.deepEqual(await vault.unlock('839271'),ledger);assert.equal(store.getItem(STORAGE_KEY),before);
 for(const pin of ['123','12345','839271'])await assert.rejects(vault.preparePin(pin,ledger,'839271'),/exactly 4/);
 assert.equal(store.getItem(STORAGE_KEY),before);vault.commitPrepared(await vault.preparePin('0012',ledger,'839271'));vault.lock();assert.deepEqual(await vault.unlock('0012'),ledger);await assert.rejects(vault.unlock('839271'),/Incorrect PIN/);
});
test('PIN encryption replaces plaintext atomically and unlocks the exact ledger',async()=>{
 const {store,vault}=setup();await vault.setPin('8392',ledger);const raw=store.getItem(STORAGE_KEY);
 assert.ok(!raw.includes('Private description')&&!raw.includes('8392')&&!raw.includes('private-id'));assert.equal(JSON.parse(raw).format,'flowtrack-vault');
 const reopened=new LedgerVault(store);assert.equal(reopened.load(),null);assert.equal(reopened.locked,true);assert.deepEqual(await reopened.unlock('8392'),ledger);
});
test('incorrect PIN and altered ciphertext do not change or reveal records',async()=>{
 const {store,vault}=setup();await vault.setPin('8392',ledger);const raw=store.getItem(STORAGE_KEY);vault.lock();
 await assert.rejects(vault.unlock('0000'),/Incorrect PIN/);assert.equal(vault.locked,true);assert.equal(store.getItem(STORAGE_KEY),raw);
 const damaged=JSON.parse(raw);damaged.ciphertext=(damaged.ciphertext[0]==='A'?'B':'A')+damaged.ciphertext.slice(1);store.setItem(STORAGE_KEY,JSON.stringify(damaged));vault.load();await assert.rejects(vault.unlock('8392'),/Incorrect PIN/);
});
test('each encrypted save uses a new nonce and locking cancels pending writes',async()=>{
 const {store,vault}=setup();await vault.setPin('8392',ledger);const first=JSON.parse(store.getItem(STORAGE_KEY));await vault.save(ledger);const second=JSON.parse(store.getItem(STORAGE_KEY));assert.notEqual(first.iv,second.iv);assert.notEqual(first.ciphertext,second.ciphertext);
 const raw=store.getItem(STORAGE_KEY),pending=vault.save(ledger);vault.lock();await assert.rejects(pending,/changed or locked/);assert.equal(store.getItem(STORAGE_KEY),raw);
});
test('PIN change and removal require the current PIN and preserve every record',async()=>{
 const {vault,store}=setup();await vault.setPin('8392',ledger);const raw=store.getItem(STORAGE_KEY);
 await assert.rejects(vault.setPin('5284',ledger,'0000'),/Incorrect PIN/);assert.equal(store.getItem(STORAGE_KEY),raw);
 await vault.setPin('5284',ledger,'8392');vault.lock();await assert.rejects(vault.unlock('8392'),/Incorrect PIN/);assert.deepEqual(await vault.unlock('5284'),ledger);
 await assert.rejects(vault.removePin('0000'),/Incorrect PIN/);assert.equal(vault.enabled,true);assert.deepEqual(await vault.removePin('5284'),ledger);assert.equal(vault.enabled,false);assert.deepEqual(JSON.parse(store.getItem(STORAGE_KEY)),ledger);
});
test('storage failure during PIN setup leaves the original readable ledger intact',async()=>{
 const {store,vault}=setup(),raw=store.getItem(STORAGE_KEY);store.setItem=()=>{throw new Error('Quota exceeded');};await assert.rejects(vault.setPin('8392',ledger),/Quota/);assert.equal(store.getItem(STORAGE_KEY),raw);assert.equal(vault.enabled,false);
});
test('stale tabs and PIN changes cannot silently overwrite newer data',async()=>{
 const {store,vault}=setup();const peer=new LedgerVault(store);peer.load();await vault.setPin('8392',ledger);const raw=store.getItem(STORAGE_KEY);await assert.rejects(peer.save(ledger),/changed or locked/);assert.equal(store.getItem(STORAGE_KEY),raw);
});
test('locked copies restore with their original PIN and clearing removes the lock',async()=>{
 const {store,vault}=setup();await vault.setPin('8392',ledger);const copy=JSON.parse(store.getItem(STORAGE_KEY));vault.clear();assert.equal(store.getItem(STORAGE_KEY),null);assert.equal(vault.enabled,false);vault.replaceLocked(copy);assert.equal(vault.locked,true);assert.deepEqual(await vault.unlock('8392'),ledger);
});
test('malformed vaults and unsupported PIN lengths are rejected',()=>{
 for(const pin of ['','123','12345','123456','1234567890123','sixsix','12 34'])assert.throws(()=>validatePin(pin));assert.equal(validatePin('0012'),'0012');
 for(const value of [{},{format:'flowtrack-vault',version:1,iterations:1},{format:'flowtrack-vault',version:1,iterations:600000,salt:'bad',iv:'bad',ciphertext:'bad'}])assert.throws(()=>validateVault(value));
});
