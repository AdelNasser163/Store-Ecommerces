import {createClient} from '@supabase/supabase-js';
const config=window.StoreBackendConfig||{};
let unsafe=String(config.publishableKey||'').startsWith('sb_secret_');
try{unsafe||=JSON.parse(atob(config.publishableKey.split('.')[1])).role==='service_role'}catch{}
const valid=!!(/^https:\/\/[^/]+$/.test(config.url||'')&&config.publishableKey&&!unsafe);
const storage={getItem:key=>sessionStorage.getItem(key)||localStorage.getItem(key),setItem:(key,value)=>{const remember=localStorage.getItem('store-auth-remember')!=='false';(remember?localStorage:sessionStorage).setItem(key,value);(remember?sessionStorage:localStorage).removeItem(key)},removeItem:key=>{sessionStorage.removeItem(key);localStorage.removeItem(key)}};
const listeners=new Set();
const client=config.enabled&&valid?(window.StoreSupabase?.client||createClient(config.url,config.publishableKey,{auth:{storage,storageKey:'almumez-supabase-'+new URL(config.url).hostname,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'},realtime:{params:{eventsPerSecond:5}}})):null;
let recovery=false;
if(client)client.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY')recovery=true;if(event==='SIGNED_OUT')recovery=false;queueMicrotask(()=>listeners.forEach(fn=>fn({event,session})))});
async function session(){if(!client)throw Error('Supabase configuration is missing');const {data,error}=await client.auth.getSession();if(error)throw error;return data.session}
async function request(path,options={},authenticated=true){
 if(!client)throw Error('Supabase configuration is missing');
 const current=authenticated?await session():null,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{const response=await fetch(config.url+path,{...options,signal:options.signal||controller.signal,headers:{apikey:config.publishableKey,...(options.body instanceof Blob?{}:{'Content-Type':'application/json'}),...(current?{Authorization:'Bearer '+current.access_token}:{}),...options.headers}});if(!response.ok){const value=await response.json().catch(()=>({}));const error=Error(value.message||value.msg||value.error_description||'Request failed');error.status=response.status;throw error}const text=await response.text();return text?JSON.parse(text):null}finally{clearTimeout(timer)}
}
window.StoreSupabase={client,enabled:!!config.enabled,configured:valid,config,request,session,isRecovery:()=>recovery,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},async rpc(name,args={}){if(!client)throw Error('Supabase configuration is missing');const {data,error}=await client.rpc(name,args);if(error)throw error;return data}};
