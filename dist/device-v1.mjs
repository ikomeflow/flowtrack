// Device verification plus WebAuthn PRF. No account or biometric data is sent to a server.
const enc=new TextEncoder(),dec=new TextDecoder();
export const toBase64url=value=>btoa(String.fromCharCode(...new Uint8Array(value))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
export function fromBase64url(value){if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,2048}$/.test(value))throw Error('Invalid device credential.');return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));}
const random=()=>crypto.getRandomValues(new Uint8Array(32));
export async function deviceAvailable(){try{return !!(globalThis.isSecureContext&&globalThis.crypto?.subtle&&globalThis.PublicKeyCredential&&navigator.credentials?.create&&navigator.credentials?.get&&await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());}catch{return false;}}
function client(credential,challenge,type){
 if(!credential||credential.type!=='public-key'||!credential.rawId)throw Error('Device unlock was not completed.');
 const info=JSON.parse(dec.decode(credential.response.clientDataJSON));
 if(info.type!==type||info.challenge!==toBase64url(challenge)||info.origin!==location.origin||info.crossOrigin===true)throw Error('Device verification did not match this app.');
}
async function verifyAssertion(credential,challenge,descriptor){
 client(credential,challenge,'webauthn.get');if(toBase64url(credential.rawId)!==descriptor.id)throw Error('Use the device credential saved for this ledger.');
 const auth=new Uint8Array(credential.response.authenticatorData),rpHash=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(descriptor.rpId)));
 if(auth.length<37||!rpHash.every((b,i)=>b===auth[i])||(auth[32]&5)!==5)throw Error('Device verification is required.');
 const result=credential.getClientExtensionResults()?.prf?.results?.first;
 if(!result||result.byteLength!==32)throw Error('This device cannot securely unlock these records. Use your FlowTrack PIN.');
 return new Uint8Array(result);
}
export async function unlockWithDevice(descriptor,{signal}={}){
 if(!descriptor||descriptor.rpId!==location.hostname)throw Error('This device unlock belongs to another website. Use your PIN.');
 const challenge=random(),credential=await navigator.credentials.get({publicKey:{challenge,rpId:descriptor.rpId,allowCredentials:[{type:'public-key',id:fromBase64url(descriptor.id)}],userVerification:'required',timeout:60000,extensions:{prf:{evalByCredential:{[descriptor.id]:{first:fromBase64url(descriptor.salt)}}}}},signal});
 return verifyAssertion(credential,challenge,descriptor);
}
export async function createDeviceUnlock({signal}={}){
 if(!await deviceAvailable())throw Error('Device unlock is unavailable here. Use your FlowTrack PIN.');
 const challenge=random(),credential=await navigator.credentials.create({publicKey:{challenge,rp:{id:location.hostname,name:'FlowTrack'},user:{id:random(),name:'FlowTrack on this browser',displayName:'FlowTrack'},pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],authenticatorSelection:{authenticatorAttachment:'platform',residentKey:'required',userVerification:'required'},attestation:'none',timeout:60000,extensions:{prf:{}}},signal});
 client(credential,challenge,'webauthn.create');
 if(credential.authenticatorAttachment&&credential.authenticatorAttachment!=='platform')throw Error('Choose this device’s screen lock. Your ledger is unchanged.');
 if(credential.getClientExtensionResults()?.prf?.enabled!==true)throw Error('This device does not support encrypted quick unlock. Your PIN still works. A created passkey can be removed in your device settings.');
 const descriptor={id:toBase64url(credential.rawId),rpId:location.hostname,salt:toBase64url(random())};
 // A fresh assertion proves that this credential can produce the same secret on return.
 const secret=await unlockWithDevice(descriptor,{signal});return {...descriptor,secret};
}
export function deviceError(error){return error?.name==='NotAllowedError'||error?.name==='AbortError'?'Device unlock cancelled. Use your PIN or try again.':error?.message||'Device unlock failed. Use your PIN.';}
