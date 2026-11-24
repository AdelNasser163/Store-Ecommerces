import {createClient} from 'npm:@supabase/supabase-js@2.119.2';
import {processPaymentWebhook} from '../_shared/provider-contract.mjs';

// Intentionally empty until an actual provider protocol/credentials are supplied.
// Never accept frontend confirmation, a bearer token or a generic success payload.
const adapters: Record<string, never> = {};
Deno.serve(async(request: Request)=>{
 const adapter=adapters[Deno.env.get('PAYMENT_PROVIDER')||'none'];
 if(!adapter)return new Response('Payment provider is not configured',{status:503});
 const url=Deno.env.get('SUPABASE_URL'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!secret)return new Response('Server is not configured',{status:503});
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 return processPaymentWebhook(request,{adapter,settle:async(args: Record<string,unknown>)=>{const {error}=await admin.rpc('apply_verified_payment',args);if(error)throw error}});
});
