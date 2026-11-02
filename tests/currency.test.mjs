import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CURRENCIES as savedCurrencies,STORAGE_KEY} from '../dist/core.mjs';
import {CURRENCIES,parseAmount,money,validateState,csvExport,emptyState} from '../dist/core-v2.mjs';
import {LedgerVault} from '../dist/vault-v8.mjs';

const entry={id:'byn-record',description:'Belarus payment',amount:12345,type:'income',date:'2026-11-02',tags:['Work']};
const ledger={version:1,currency:'BYN',transactions:[entry]};
function setup(){const records=new Map(),store={getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value)};return {store,records,vault:new LedgerVault(store)};}

test('BYN is available to both visible currency selection and saved-state validation',()=>{
 assert.equal(CURRENCIES.BYN,'Belarusian ruble');assert.equal(savedCurrencies.BYN,'Belarusian ruble');
 assert.equal(emptyState().currency,'XAF');
 assert.deepEqual(validateState(JSON.parse(JSON.stringify(ledger))),ledger);
 assert.equal(parseAmount('123.45'),entry.amount);assert.equal(parseAmount('0.01'),1);
 assert.match(money(entry.amount,'BYN'),/BYN/);assert.match(money(entry.amount,'BYN'),/123[.,]45/);
 const csv=csvExport(ledger.transactions,'BYN');assert.ok(csv.includes('"123.45","BYN"'));
});

test('a BYN preference saves under the current PIN and reopens with exact existing amounts',async()=>{
 const {store,vault}=setup();vault.load();
 const original={...ledger,currency:'XAF'};
 vault.commitPrepared(await vault.prepareSimplePin('8392',original));
 const first=store.getItem(STORAGE_KEY);await vault.save(ledger);
 const saved=store.getItem(STORAGE_KEY);assert.notEqual(saved,first);assert.ok(!saved.includes(entry.description));
 const reopened=new LedgerVault(store);assert.equal(reopened.load(),null);
 assert.deepEqual(await reopened.unlock('8392'),ledger);assert.equal(store.getItem(STORAGE_KEY),saved);
 reopened.lock();await assert.rejects(reopened.unlock('0000'),/Incorrect PIN/);assert.equal(store.getItem(STORAGE_KEY),saved);
});

test('a failed BYN preference save preserves the prior encrypted ledger and currency',async()=>{
 const {store,vault}=setup();vault.load();const original={...ledger,currency:'XAF'};
 vault.commitPrepared(await vault.prepareSimplePin('8392',original));const saved=store.getItem(STORAGE_KEY);
 store.setItem=()=>{throw new Error('Quota exceeded');};
 await assert.rejects(vault.save(ledger),/Quota/);assert.equal(store.getItem(STORAGE_KEY),saved);
 const reopened=new LedgerVault(store);reopened.load();assert.deepEqual(await reopened.unlock('8392'),original);
});
