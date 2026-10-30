export const DAY=86_400_000;
export const OWNER_KEY='flowtrack.account-owner.v1';
export const LEASE_KEY='flowtrack.subscription-lease.v1';
const decode=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export async function verifyLease(token,publicKey,{project,user,now=Date.now()}={}){
 try{
  if(typeof token!=='string'||token.length>8192)return null;
  const parts=token.split('.');if(parts.length!==3)return null;
  const [head,body,signature]=parts,header=JSON.parse(new TextDecoder().decode(decode(head)));
  if(header.alg!=='RS256'||header.typ!=='JWT')return null;
  const key=await crypto.subtle.importKey('jwk',publicKey,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(signature),new TextEncoder().encode(head+'.'+body)))return null;
  const claims=JSON.parse(new TextDecoder().decode(decode(body)));
  if(claims.iss!==project||claims.aud!=='flowtrack-offline'||claims.sub!==user||claims.write!==true)return null;
  if(!Number.isSafeInteger(claims.iat)||!Number.isSafeInteger(claims.exp)||claims.exp<=claims.iat||claims.exp-claims.iat>7*DAY/1000)return null;
  if(now<claims.iat*1000-60_000||now>=claims.exp*1000)return null;
  return claims;
 }catch{return null;}
}
export function writeAccess({enabled,owner,user,lease,now=Date.now(),clockFloor=0}){
 if(!enabled)return {allowed:true,reason:'Subscriptions are not enabled in this build.'};
 if(!owner)return {allowed:false,reason:'Create an account or sign in, then link this device. Your 30-day trial starts at registration.'};
 if(user&&owner!==user)return {allowed:false,reason:'This device’s ledger is linked to a different account. Sign out and use the linked account. You can still view and export with your PIN.'};
 if(now+60_000<clockFloor)return {allowed:false,reason:'The device clock changed. Connect to the internet to check your subscription.'};
 if(!lease||lease.sub!==owner||lease.write!==true||now>=lease.exp*1000||now<lease.iat*1000-60_000)return {allowed:false,reason:'Editing is paused. Connect and sign in to check your trial or renew for $1/month. Viewing and exports remain available.'};
 return {allowed:true,reason:'Editing available until '+new Date(lease.exp*1000).toLocaleString()+'. Connect at least every 7 days to refresh offline access.'};
}
