import {LedgerVault} from '../dist/vault-v7.mjs';
export const TEST_PIN='8392';
export async function finishRecovery(page){const key=await page.locator('#generated-recovery').inputValue();await page.locator('#recovery-saved').check();await page.locator('#recovery-finish').click();await page.locator('#save-recovery-dialog').waitFor({state:'hidden'});if(await page.locator('#device-offer-dialog').isVisible())await page.locator('#device-offer-later').click();return key;}
export async function openApp(page,pin=TEST_PIN){
 await page.waitForFunction(()=>!document.getElementById('app-shell').hidden||!document.getElementById('setup-screen').hidden||!document.getElementById('lock-screen').hidden);
 if(await page.locator('#setup-screen').isVisible()){await page.locator('#setup-pin').click();await page.locator('#pin-new').fill(pin);await page.locator('#pin-confirm').fill(pin);await page.locator('#pin-save').click();await page.locator('#app-shell').waitFor({state:'visible'});}
 if(await page.locator('#lock-screen').isVisible()){if(!await page.locator('#unlock-pin').isVisible())await page.locator('#pin-entry-summary').click();await page.locator('#unlock-pin').fill(pin);await page.locator('#unlock-button').click();}
 await page.locator('#app-shell').waitFor({state:'visible'});
}
export async function readLedger(page,pin=TEST_PIN){const raw=await page.evaluate(()=>localStorage.getItem('flowtrack.v1'));const vault=new LedgerVault({getItem:()=>raw});const value=vault.load();return vault.enabled?await vault.unlock(pin):value||{version:1,currency:'XAF',transactions:[]};}
export async function writeLedger(page,value,pin=TEST_PIN){const map=new Map([['flowtrack.v1',await page.evaluate(()=>localStorage.getItem('flowtrack.v1'))]]),vault=new LedgerVault({getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)});vault.load();if(vault.enabled)await vault.unlock(pin);await vault.save(value);await page.evaluate(raw=>localStorage.setItem('flowtrack.v1',raw),map.get('flowtrack.v1'));}
